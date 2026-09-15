
import sys
import os
import argparse
import requests
from datetime import datetime, timedelta, timezone
from typing import Optional
from pydantic import BaseModel, Field
from sqlalchemy.dialects.postgresql import insert

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models import Fuente, Dominio, Vulnerabilidad, vulnerabilidad_dominio
from etl.config_fuentes import CONFIG_FUENTES

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

    if "cvssMetricV31" in metrics:
        data_metric = metrics["cvssMetricV31"][0].get("cvssData", {})
        cvss_score = data_metric.get("baseScore")
        cvss_severity = data_metric.get("baseSeverity")
    elif "cvssMetricV30" in metrics:
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
# 2. VENTANA DE FECHAS (respeta el máximo de 120 días de NVD)
# ==============================================================================

NVD_MAX_RANGO_DIAS = 120


def calcular_ventana_fechas(modo: str) -> tuple[datetime, datetime]:
    """
    Calcula el rango pubStartDate/pubEndDate a consultar.
    - 'backfill': trae los últimos 120 días completos (el máximo permitido por NVD),
      pensado para la primera carga del proyecto.
    - 'incremental': trae solo los últimos 3 días, pensado para la corrida diaria
      automatizada vía GitHub Actions (sync incremental, bajo volumen).
    """
    end_date = datetime.now(timezone.utc)
    dias = NVD_MAX_RANGO_DIAS if modo == "backfill" else 3
    start_date = end_date - timedelta(days=dias)
    return start_date, end_date


def formatear_fecha_nvd(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000")


# ==============================================================================
# 3. ENTIDADES BASE (Fuente y Dominio)
# ==============================================================================

def asegurar_entidades_base(db):
    meta_fuente = CONFIG_FUENTES["NVD"]
    stmt_fuente = insert(Fuente).values(
        nombre=meta_fuente["nombre"],
        tipo_confianza=meta_fuente["tipo_confianza"],
        url=meta_fuente["url"],
        fecha_ultima_actualizacion=meta_fuente["fecha_ultima_actualizacion"],
    ).on_conflict_do_update(
        index_elements=["nombre"],
        set_={"fecha_ultima_actualizacion": meta_fuente["fecha_ultima_actualizacion"]},
    ).returning(Fuente.id)

    fuente_id = db.execute(stmt_fuente).scalar()

    stmt_dominio = insert(Dominio).values(nombre="DNS").on_conflict_do_nothing().returning(Dominio.id)
    dominio_id = db.execute(stmt_dominio).scalar()

    if not dominio_id:
        dominio_id = db.query(Dominio.id).filter(Dominio.nombre == "DNS").scalar()

    db.commit()
    return fuente_id, dominio_id


# ==============================================================================
# 4. LÓGICA DE INGESTA Y PERSISTENCIA (UPSERT)
# ==============================================================================

def ejecutar_etl_nvd(modo: str = "incremental"):
    db = SessionLocal()
    try:
        print(f"[*] Modo de ejecución: {modo}")
        print("[*] Sincronizando fuente NVD y dominio DNS...")
        fuente_id, dominio_id = asegurar_entidades_base(db)

        api_url = CONFIG_FUENTES["NVD"]["url"]
        api_key = os.getenv("NVD_API_KEY")

        headers = {}
        if api_key:
            headers["apiKey"] = api_key
            print("[*] Usando NVD API Key provista en el entorno.")
        else:
            print("[!] API Key no detectada. Usando modo público con límites estándar (5 req/30s).")

        start_date, end_date = calcular_ventana_fechas(modo)
        params = {
            "keywordSearch": "DNS",
            "pubStartDate": formatear_fecha_nvd(start_date),
            "pubEndDate": formatear_fecha_nvd(end_date),
            "resultsPerPage": 50,
        }

        print(f"[*] Consultando NVD entre {params['pubStartDate']} y {params['pubEndDate']}...")
        resp = requests.get(api_url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        vulnerabilities_raw = data.get("vulnerabilities", [])
        print(f"[*] Recibidos {len(vulnerabilities_raw)} registros crudos de NVD. Validando con Pydantic...")

        # Validar y descartar inválidos
        cves_validados = []
        for item in vulnerabilities_raw:
            try:
                cve = parsear_vulnerabilidad(item)
                if cve:
                    cves_validados.append(cve)
            except Exception as item_err:
                print(f"[!] Registro descartado por error de validación: {item_err}")

        # NVD no garantiza el orden de los resultados: se ordena explícitamente
        # por fecha de publicación, del más reciente al más antiguo.
        cves_validados.sort(key=lambda c: c.fecha_publicacion, reverse=True)
        print(f"[*] {len(cves_validados)} CVEs válidos tras ordenar por fecha de publicación.")

        cves_insertados = 0
        for cve_validado in cves_validados:
            try:
                stmt_cve = insert(Vulnerabilidad).values(
                    id=cve_validado.cve_id,
                    descripcion=cve_validado.descripcion,
                    fecha_publicacion=cve_validado.fecha_publicacion.date(),
                    cvss_score=cve_validado.cvss_score,
                    cvss_severity=cve_validado.cvss_severity,
                    fuente_id=fuente_id,
                ).on_conflict_do_update(
                    index_elements=["id"],
                    set_={
                        "descripcion": cve_validado.descripcion,
                        "cvss_score": cve_validado.cvss_score,
                        "cvss_severity": cve_validado.cvss_severity,
                    },
                )
                db.execute(stmt_cve)

                stmt_rel = insert(vulnerabilidad_dominio).values(
                    vulnerabilidad_id=cve_validado.cve_id,
                    dominio_id=dominio_id,
                ).on_conflict_do_nothing()
                db.execute(stmt_rel)

                cves_insertados += 1

            except Exception as item_err:
                print(f"[!] Error procesando CVE {cve_validado.cve_id}: {item_err}")
                continue

        db.commit()
        print(f"[✓] Pipeline NVD finalizado: {cves_insertados} CVEs persistidos y asociados al dominio DNS.")

    except Exception as e:
        db.rollback()
        print(f"[!] Error crítico en ETL NVD: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ETL de ingesta de CVEs desde NVD.")
    parser.add_argument(
        "--modo",
        choices=["backfill", "incremental"],
        default="incremental",
        help="'backfill' trae los últimos 120 días (carga inicial); "
             "'incremental' trae solo los últimos 3 días (corrida diaria automatizada).",
    )
    args = parser.parse_args()
    ejecutar_etl_nvd(modo=args.modo)
