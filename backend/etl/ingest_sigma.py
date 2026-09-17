import sys
import os
import io
import zipfile
import requests
import yaml
from sqlalchemy.dialects.postgresql import insert

# Permitir importaciones desde la carpeta app y etl
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models import Fuente, Tecnica, ReglaDeteccion, tecnica_regla
from etl.config_fuentes import CONFIG_FUENTES

print(">>> Iniciando script de ingesta oficial de SigmaHQ (Comunidad)...")

def asegurar_fuente_sigma(db):
    """Garantiza la existencia de la fuente comunitaria SigmaHQ."""
    meta = CONFIG_FUENTES["SigmaHQ"]
    stmt = insert(Fuente).values(
        nombre=meta["nombre"],
        tipo_confianza=meta["tipo_confianza"],
        url=meta["url"],
        fecha_ultima_actualizacion=meta["fecha_ultima_actualizacion"]
    ).on_conflict_do_update(
        index_elements=["nombre"],
        set_={
            "tipo_confianza": meta["tipo_confianza"],
            "url": meta["url"],
            "fecha_ultima_actualizacion": meta["fecha_ultima_actualizacion"]
        }
    ).returning(Fuente.id)
    
    fuente_id = db.execute(stmt).scalar()
    db.commit()
    return fuente_id

def formatear_log_source(logsource_dict):
    """Extrae una descripción legible de la fuente de logs de una regla Sigma."""
    if not isinstance(logsource_dict, dict):
        return "generic"
    
    category = logsource_dict.get("category")
    product = logsource_dict.get("product")
    service = logsource_dict.get("service")

    parts = []
    if product:
        parts.append(product)
    if service:
        parts.append(service)
    if category and not parts:
        parts.append(category)

    res = " / ".join(parts) if parts else str(category or "generic")
    return res[:100]

def ejecutar_etl_sigma():
    db = SessionLocal()
    try:
        print("[*] Sincronizando fuente SigmaHQ en Neon...")
        fuente_id = asegurar_fuente_sigma(db)

        tecnicas_locales = set(r[0].upper() for r in db.query(Tecnica.id).all())
        print(f"[*] Base local contiene {len(tecnicas_locales)} técnicas registradas para cruzar reglas.")

        dataset_url = CONFIG_FUENTES["SigmaHQ"].get(
            "dataset_url",
            "https://github.com/SigmaHQ/sigma/releases/latest/download/sigma_all_rules.zip"
        )
        print(f"[*] Descargando archivo compilado de SigmaHQ ({dataset_url[:65]}...)...")

        resp = requests.get(dataset_url, timeout=60)
        resp.raise_for_status()

        print(f"[*] Archivo ZIP descargado ({len(resp.content) / (1024*1024):.2f} MB). Extrayendo reglas en memoria...")
        zf = zipfile.ZipFile(io.BytesIO(resp.content))

        reglas_insertadas = 0
        vinculos_creados = 0
        tecnicas_cubiertas = set()

        for filename in zf.namelist():
            if not (filename.endswith(".yml") or filename.endswith(".yaml")):
                continue

            content = zf.read(filename).decode("utf-8", errors="ignore")
            try:
                data = yaml.safe_load(content)
                if not isinstance(data, dict):
                    continue

                tags = data.get("tags", [])
                tecnicas_encontradas = set()

                for tag in tags:
                    tag_lower = str(tag).lower().strip()
                    if "attack.t" in tag_lower:
                        part = tag_lower.split("attack.")[-1].upper()
                        if part in tecnicas_locales:
                            tecnicas_encontradas.add(part)

                # Si la regla mapea a al menos una técnica local de DNS
                if tecnicas_encontradas:
                    rule_title = (data.get("title") or filename)[:200]
                    log_source_str = formatear_log_source(data.get("logsource", {}))

                    # 1. Upsert / Buscar o crear regla
                    regla = db.query(ReglaDeteccion).filter(
                        ReglaDeteccion.nombre == rule_title,
                        ReglaDeteccion.fuente_id == fuente_id
                    ).first()

                    if not regla:
                        regla = ReglaDeteccion(
                            nombre=rule_title,
                            formato="Sigma",
                            log_source=log_source_str,
                            fuente_id=fuente_id
                        )
                        db.add(regla)
                        db.flush()
                        reglas_insertadas += 1

                    # 2. Vincular con cada técnica ATT&CK que coincida
                    for t_id in tecnicas_encontradas:
                        stmt_rel = insert(tecnica_regla).values(
                            tecnica_id=t_id,
                            regla_id=regla.id
                        ).on_conflict_do_nothing()
                        db.execute(stmt_rel)
                        vinculos_creados += 1
                        tecnicas_cubiertas.add(t_id)

            except Exception as item_err:
                continue

        db.commit()
        print(f"[OK] Pipeline Sigma finalizado: {reglas_insertadas} reglas nuevas creadas, {vinculos_creados} vínculos establecidos.")
        print(f"[*] Cobertura defensiva: {len(tecnicas_cubiertas)}/{len(tecnicas_locales)} técnicas DNS cuentan con reglas de detección activas.")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error durante el ETL de Sigma: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    ejecutar_etl_sigma()