import argparse
import logging
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import requests
from pydantic import BaseModel, Field
from sqlalchemy.dialects.postgresql import insert

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models import Dominio, Vulnerabilidad, vulnerabilidad_dominio
from etl.common import asegurar_dominio, asegurar_fuente, sesion_etl
from etl.config_fuentes import CONFIG_FUENTES

logger = logging.getLogger("etl_nvd")

# ==============================================================================
# 1. CONTRATO DE DATOS (Validación de API con Pydantic)
# ==============================================================================

class NvdCveData(BaseModel):
    cve_id: str = Field(..., alias="id")
    descripcion: str
    fecha_publicacion: datetime
    cvss_score: Optional[float] = None
    cvss_severity: Optional[str] = "UNKNOWN"


def parsear_vulnerabilidad(item: dict) -> Optional[NvdCveData]:
    """Valida y extrae los campos clave del JSON crudo de NVD."""
    cve_obj = item.get("cve", {})
    cve_id = cve_obj.get("id")
    if not cve_id:
        return None

    descriptions = cve_obj.get("descriptions", [])
    desc_en = next((d.get("value") for d in descriptions if d.get("lang") == "en"), "")
    if not desc_en and descriptions:
        desc_en = descriptions[0].get("value", "")

    published_str = cve_obj.get("published")
    if not published_str:
        return None
    published_dt = datetime.fromisoformat(published_str.replace("Z", "+00:00"))

    metrics = cve_obj.get("metrics", {})
    cvss_score = None
    cvss_severity = "UNKNOWN"

    if "cvssMetricV31" in metrics and metrics["cvssMetricV31"]:
        data_metric = metrics["cvssMetricV31"][0].get("cvssData", {})
        cvss_score = data_metric.get("baseScore")
        cvss_severity = data_metric.get("baseSeverity")
    elif "cvssMetricV30" in metrics and metrics["cvssMetricV30"]:
        data_metric = metrics["cvssMetricV30"][0].get("cvssData", {})
        cvss_score = data_metric.get("baseScore")
        cvss_severity = data_metric.get("baseSeverity")

    return NvdCveData(
        id=cve_id,
        descripcion=desc_en,
        fecha_publicacion=published_dt,
        cvss_score=cvss_score,
        cvss_severity=cvss_severity,
    )


# ==============================================================================
# 2. CONFIGURACIÓN Y VENTANA DE FECHAS
# ==============================================================================

NVD_MAX_RANGO_DIAS = 120
PROTOCOLOS_DEFAULT = ["DNS", "SMB", "FTP", "DHCP", "ARP"]


def calcular_ventana_fechas(modo: str, dias_override: Optional[int] = None) -> tuple[datetime, datetime]:
    """
    Calcula el rango pubStartDate/pubEndDate a consultar.
    - 'backfill': trae los últimos 120 días completos (el máximo permitido por NVD).
    - 'incremental': trae los últimos días especificados (por defecto 15 días para capturar
      un volumen representativo de CVEs recientes de todos los protocolos).
    """
    end_date = datetime.now(timezone.utc)
    if dias_override is not None and dias_override > 0:
        dias = min(dias_override, NVD_MAX_RANGO_DIAS)
    elif modo == "backfill":
        dias = NVD_MAX_RANGO_DIAS
    else:
        dias = 15

    start_date = end_date - timedelta(days=dias)
    return start_date, end_date


def formatear_fecha_nvd(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000")


def consultar_nvd_con_reintento(
    url: str,
    headers: dict,
    params: dict,
    max_reintentos: int = 3,
    delay_base: int = 6
) -> dict:
    """Ejecuta una petición a la API de NVD con manejo de reintentos y rate limit (403/429)."""
    for intento in range(1, max_reintentos + 1):
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=30)
            if resp.status_code in (403, 429):
                tiempo_espera = delay_base * intento * 2
                print(f"[!] Rate limit NVD alcanzado (HTTP {resp.status_code}). Esperando {tiempo_espera}s antes de reintentar ({intento}/{max_reintentos})...")
                time.sleep(tiempo_espera)
                continue
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.RequestException as err:
            if intento == max_reintentos:
                raise
            tiempo_espera = delay_base * intento
            print(f"[!] Error de red en petición NVD ({err}). Reintentando en {tiempo_espera}s ({intento}/{max_reintentos})...")
            time.sleep(tiempo_espera)
    return {}


# ==============================================================================
# 3. LÓGICA DE INGESTA Y PERSISTENCIA (UPSERT)
# ==============================================================================

def ejecutar_etl_nvd(
    modo: str = "incremental",
    keywords: Optional[List[str]] = None,
    dias_override: Optional[int] = None,
    limit_per_keyword: int = 50,
):
    keywords_a_consultar = keywords or PROTOCOLOS_DEFAULT

    with sesion_etl() as db:
        print(f"[*] Modo de ejecución: {modo}")
        print(f"[*] Protocolos / Palabras clave a consultar: {', '.join(keywords_a_consultar)}")

        fuente_id = asegurar_fuente(db, "NVD")
        dominio_id = asegurar_dominio(
            db,
            nombre="Network Infrastructure & Protocols",
            slug="network-infrastructure-protocols",
        )
        print(f"[*] Sincronizando fuente NVD (ID: {fuente_id}) y dominio 'Network Infrastructure & Protocols' (ID: {dominio_id}) en Neon...")

        api_url = CONFIG_FUENTES["NVD"]["url"]
        api_key = os.getenv("NVD_API_KEY")

        headers = {}
        if api_key:
            headers["apiKey"] = api_key
            print("[*] Usando NVD API Key provista en el entorno.")
            delay_segundos = 2
        else:
            print("[!] API Key no detectada. Usando modo público con límites estándar (5 req/30s).")
            delay_segundos = 6

        start_date, end_date = calcular_ventana_fechas(modo, dias_override)
        str_start = formatear_fecha_nvd(start_date)
        str_end = formatear_fecha_nvd(end_date)
        print(f"[*] Ventana de fechas NVD: {str_start} a {str_end}")

        resumen_ingesta = {kw: {"obtenidos": 0, "insertados": 0} for kw in keywords_a_consultar}
        total_insertados_sesion = 0

        for idx, kw in enumerate(keywords_a_consultar, 1):
            print(f"\n[{idx}/{len(keywords_a_consultar)}] Consultando NVD para protocolo/keyword: '{kw}'...")

            vulnerabilities_raw = []
            start_index = 0
            pagina = 1
            total_paginas = 1

            params = {
                "keywordSearch": kw,
                "pubStartDate": str_start,
                "pubEndDate": str_end,
                "resultsPerPage": min(limit_per_keyword, 50),
            }

            while True:
                params["startIndex"] = start_index
                try:
                    data = consultar_nvd_con_reintento(
                        api_url,
                        headers=headers,
                        params=params,
                        delay_base=delay_segundos,
                    )
                except Exception as req_err:
                    print(f"[!] Error al consultar NVD para '{kw}': {req_err}")
                    break

                items = data.get("vulnerabilities", [])
                total_results = data.get("totalResults", len(items))
                results_per_page = data.get("resultsPerPage", params["resultsPerPage"])
                vulnerabilities_raw.extend(items)

                if total_results > 0 and results_per_page > 0:
                    total_paginas = (total_results + results_per_page - 1) // results_per_page

                print(f"    - Página {pagina}: {len(items)} CVEs devueltos. (Total disponible en NVD: {total_results})")

                # Criterio de parada para modo incremental o backfill
                if modo != "backfill" or len(vulnerabilities_raw) >= total_results or len(items) == 0:
                    break

                start_index += results_per_page
                pagina += 1

                print(f"    - Esperando {delay_segundos}s (rate limit)...")
                time.sleep(delay_segundos)

            # Validar y parsear con Pydantic
            cves_validados: List[NvdCveData] = []
            for item in vulnerabilities_raw:
                try:
                    cve = parsear_vulnerabilidad(item)
                    if cve:
                        cves_validados.append(cve)
                except Exception as item_err:
                    print(f"    [!] Registro descartado por error de validación: {item_err}")

            cves_validados.sort(key=lambda c: c.fecha_publicacion, reverse=True)
            resumen_ingesta[kw]["obtenidos"] = len(cves_validados)

            # Inserción / Upsert en base de datos
            insertados_kw = 0
            for cve in cves_validados:
                try:
                    stmt_cve = insert(Vulnerabilidad).values(
                        id=cve.cve_id,
                        descripcion=cve.descripcion,
                        fecha_publicacion=cve.fecha_publicacion.date(),
                        cvss_score=cve.cvss_score,
                        cvss_severity=cve.cvss_severity,
                        fuente_id=fuente_id,
                    ).on_conflict_do_update(
                        index_elements=["id"],
                        set_={
                            "descripcion": cve.descripcion,
                            "cvss_score": cve.cvss_score,
                            "cvss_severity": cve.cvss_severity,
                        },
                    )
                    db.execute(stmt_cve)

                    stmt_rel = insert(vulnerabilidad_dominio).values(
                        vulnerabilidad_id=cve.cve_id,
                        dominio_id=dominio_id,
                    ).on_conflict_do_nothing()
                    db.execute(stmt_rel)

                    insertados_kw += 1
                except Exception as db_err:
                    print(f"    [!] Error al persistir CVE {cve.cve_id}: {db_err}")
                    continue

            resumen_ingesta[kw]["insertados"] = insertados_kw
            total_insertados_sesion += insertados_kw
            print(f"    -> {insertados_kw} CVEs vinculados exitosamente a 'Network Infrastructure & Protocols'.")

            # Pausa de cortesía entre diferentes keywords
            if idx < len(keywords_a_consultar):
                print(f"    - Pausa de {delay_segundos}s antes de la siguiente keyword...")
                time.sleep(delay_segundos)

        print(f"\n[OK] Pipeline NVD finalizado: {total_insertados_sesion} CVEs procesados/vinculados en esta sesión.")

        # ==============================================================================
        # 4. REPORTE CONSOLIDADO POR PROTOCOLO EN NEON
        # ==============================================================================
        reportar_estado_consolidado(db, dominio_id)


def reportar_estado_consolidado(db, dominio_id: int):
    """Genera y muestra el desglose analítico de todos los CVEs catalogados en el dominio."""
    cves_dominio = (
        db.query(Vulnerabilidad)
        .join(Vulnerabilidad.dominios)
        .filter(Dominio.id == dominio_id)
        .all()
    )

    total_cves = len(cves_dominio)

    regexes = {
        "DNS": re.compile(r"\b(DNS|Domain Name System|BIND|DNSSEC)\b", re.IGNORECASE),
        "SMB": re.compile(r"\b(SMB|Server Message Block|Samba|NetBIOS)\b", re.IGNORECASE),
        "FTP": re.compile(r"\b(FTP|File Transfer Protocol|vsftpd|ProFTPD|Pure-FTPd)\b", re.IGNORECASE),
        "DHCP": re.compile(r"\b(DHCP|Dynamic Host Configuration Protocol)\b", re.IGNORECASE),
        "ARP": re.compile(r"\b(ARP|Address Resolution Protocol)\b", re.IGNORECASE),
    }

    conteos = {p: 0 for p in regexes}
    conteos["General / Otros"] = 0

    for c in cves_dominio:
        matched = False
        desc = c.descripcion or ""
        for proto, rgx in regexes.items():
            if rgx.search(desc):
                conteos[proto] += 1
                matched = True
        if not matched:
            conteos["General / Otros"] += 1

    print("\n" + "=" * 65)
    print(" ESTADO CONSOLIDADO DEL DOMINIO 'Network Infrastructure & Protocols'")
    print("=" * 65)
    print(f"Total CVEs catalogados en Neon: {total_cves}")
    print("-" * 65)
    print(f"{'Protocolo':<20} | {'CVEs Asignados':<15} | {'Porcentaje':<10}")
    print("-" * 65)
    for proto, cnt in conteos.items():
        pct = (cnt / total_cves * 100) if total_cves > 0 else 0
        print(f"{proto:<20} | {cnt:<15} | {pct:>6.1f}%")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ETL de ingesta de CVEs desde NVD para Network Infrastructure & Protocols.")
    parser.add_argument(
        "--modo",
        choices=["backfill", "incremental"],
        default="incremental",
        help="'backfill' trae los últimos 120 días; 'incremental' trae ventana reciente.",
    )
    parser.add_argument(
        "--dias",
        type=int,
        default=None,
        help="Número de días a consultar hacia atrás (ej. 30). Por defecto: 120 en backfill, 15 en incremental.",
    )
    parser.add_argument(
        "--keywords",
        nargs="+",
        default=None,
        help="Lista de palabras clave/protocolos a consultar (por defecto: DNS SMB FTP DHCP ARP).",
    )
    parser.add_argument(
        "--limit-per-keyword",
        type=int,
        default=50,
        help="Límite máximo de resultados por palabra clave en modo incremental.",
    )
    args = parser.parse_args()

    ejecutar_etl_nvd(
        modo=args.modo,
        keywords=args.keywords,
        dias_override=args.dias,
        limit_per_keyword=args.limit_per_keyword,
    )
