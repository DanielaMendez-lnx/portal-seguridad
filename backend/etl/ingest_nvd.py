
import sys
import os
import requests
from datetime import datetime
from typing import Optional, List
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
    
    # 1. Descripción en inglés
    descriptions = cve_obj.get("descriptions", [])
    desc_en = next((d.get("value") for d in descriptions if d.get("lang") == "en"), "")
    if not desc_en and descriptions:
        desc_en = descriptions[0].get("value", "")

    # 2. Fecha de publicación
    published_str = cve_obj.get("published")
    if not published_str:
        return None
    published_dt = datetime.fromisoformat(published_str.replace("Z", "+00:00"))

    # 3. Métricas CVSS v3.1 / v3.0 / v2
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
        cvss_severity=cvss_severity
    )

# ==============================================================================
# 2. LÓGICA DE INGESTA Y PERSISTENCIA (UPSERT)
# ==============================================================================

def asegurar_entidades_base(db):
    meta_fuente = CONFIG_FUENTES["NVD"]
    stmt_fuente = insert(Fuente).values(
        nombre=meta_fuente["nombre"],
        tipo_confianza=meta_fuente["tipo_confianza"],
        url=meta_fuente["url"],
        fecha_ultima_actualizacion=meta_fuente["fecha_ultima_actualizacion"]
    ).on_conflict_do_update(
        index_elements=["nombre"],
        set_={"fecha_ultima_actualizacion": meta_fuente["fecha_ultima_actualizacion"]}
    ).returning(Fuente.id)
    
    fuente_id = db.execute(stmt_fuente).scalar()

    stmt_dominio = insert(Dominio).values(nombre="DNS").on_conflict_do_nothing().returning(Dominio.id)
    dominio_id = db.execute(stmt_dominio).scalar()

    if not dominio_id:
        dominio_id = db.query(Dominio.id).filter(Dominio.nombre == "DNS").scalar()

    db.commit()
    return fuente_id, dominio_id

def ejecutar_etl_nvd():
    db = SessionLocal()
    try:
        print("[*] Sincronizando fuente NVD y dominio DNS...")
        fuente_id, dominio_id = asegurar_entidades_base(db)

        api_url = CONFIG_FUENTES["NVD"]["url"]
        api_key = os.getenv("NVD_API_KEY")

        headers = {}
        if api_key:
            headers["apiKey"] = api_key
            print("[*] Usando NVD API Key provista en el entorno.")
        else:
            print("[!] API Key no detectada. Usando modo público con límites estándar.")

        # Parámetros: filtra vulnerabilidades con palabra clave DNS (máximo 20 recientes para el MVP)
        # Filtrar vulnerabilidades DNS recientes (ej. desde 2024 en adelante)
        params = {
            "keywordSearch": "DNS",
            "pubStartDate": "2024-01-01T00:00:00.000",
            "pubEndDate": "2024-12-31T23:59:59.000",
            "resultsPerPage": 20
        }

        print(f"[*] Consultando API 2.0 de NVD ({api_url})...")
        resp = requests.get(api_url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        vulnerabilities_raw = data.get("vulnerabilities", [])
        print(f"[*] Recibidos {len(vulnerabilities_raw)} registros de NVD. Validando con Pydantic...")

        cves_insertados = 0

        for item in vulnerabilities_raw:
            try:
                cve_validado = parsear_vulnerabilidad(item)
                if not cve_validado:
                    continue

                # 1. Upsert en tabla 'vulnerabilidades'
                stmt_cve = insert(Vulnerabilidad).values(
                    id=cve_validado.cve_id,
                    descripcion=cve_validado.descripcion,
                    fecha_publicacion=cve_validado.fecha_publicacion.date(),
                    cvss_score=cve_validado.cvss_score,
                    cvss_severity=cve_validado.cvss_severity,
                    fuente_id=fuente_id
                ).on_conflict_do_update(
                    index_elements=["id"],
                    set_={
                        "descripcion": cve_validado.descripcion,
                        "cvss_score": cve_validado.cvss_score,
                        "cvss_severity": cve_validado.cvss_severity
                    }
                )
                db.execute(stmt_cve)

                # 2. Relación directa con el Dominio DNS
                stmt_rel = insert(vulnerabilidad_dominio).values(
                    vulnerabilidad_id=cve_validado.cve_id,
                    dominio_id=dominio_id
                ).on_conflict_do_nothing()
                db.execute(stmt_rel)

                cves_insertados += 1

            except Exception as item_err:
                print(f"[!] Error procesando registro CVE individual: {item_err}")
                continue

        db.commit()
        print(f"[✓] Pipeline NVD finalizado: {cves_insertados} CVEs persistidos y asociados al dominio DNS.")

    except Exception as e:
        db.rollback()
        print(f"[!] Error crítico en ETL NVD: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    ejecutar_etl_nvd()
