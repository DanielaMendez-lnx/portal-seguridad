import sys
import os
import requests
from sqlalchemy.dialects.postgresql import insert

# Permitir importaciones desde la carpeta app y etl
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models import Fuente, MarcoNormativo, Control, Tecnica, TecnicaControl
from etl.config_fuentes import CONFIG_FUENTES

print(">>> Iniciando script de ingesta oficial de CTID Mappings Explorer...")

def asegurar_entidades_base(db):
    """Garantiza la existencia de la fuente CTID y el marco NIST SP 800-53 Rev. 5."""
    meta_fuente = CONFIG_FUENTES["CTID"]
    stmt_fuente = insert(Fuente).values(
        nombre=meta_fuente["nombre"],
        tipo_confianza=meta_fuente["tipo_confianza"],
        url=meta_fuente["url"],
        fecha_ultima_actualizacion=meta_fuente["fecha_ultima_actualizacion"]
    ).on_conflict_do_update(
        index_elements=["nombre"],
        set_={
            "tipo_confianza": meta_fuente["tipo_confianza"],
            "url": meta_fuente["url"],
            "fecha_ultima_actualizacion": meta_fuente["fecha_ultima_actualizacion"]
        }
    ).returning(Fuente.id)
    fuente_id = db.execute(stmt_fuente).scalar()

    # Marco normativo NIST SP 800-53 Rev. 5 (utiliza restricción única uq_marco_nombre_version)
    stmt_marco = insert(MarcoNormativo).values(
        nombre="NIST SP 800-53",
        version="Rev. 5"
    ).on_conflict_do_nothing(
        index_elements=["nombre", "version"]
    ).returning(MarcoNormativo.id)
    marco_id = db.execute(stmt_marco).scalar()

    if not marco_id:
        marco_id = db.query(MarcoNormativo.id).filter(
            MarcoNormativo.nombre == "NIST SP 800-53",
            MarcoNormativo.version == "Rev. 5"
        ).scalar()

    db.commit()
    return fuente_id, marco_id

def ejecutar_etl_ctid():
    db = SessionLocal()
    try:
        print("[*] Sincronizando fuente CTID y marco normativo base en Neon...")
        fuente_id, marco_id = asegurar_entidades_base(db)

        # Identificar las técnicas registradas en Neon para el cruce
        tecnicas_locales = set(r[0] for r in db.query(Tecnica.id).all())
        print(f"[*] Base local contiene {len(tecnicas_locales)} técnicas registradas.")

        dataset_url = CONFIG_FUENTES["CTID"].get(
            "dataset_url",
            "https://raw.githubusercontent.com/center-for-threat-informed-defense/mappings-explorer/main/mappings/nist_800_53/attack-16.1/nist_800_53-rev5/enterprise/nist_800_53-rev5_attack-16.1-enterprise.json"
        )
        print(f"[*] Descargando dataset completo de CTID Mappings Explorer ({dataset_url[:65]}...)...")

        resp = requests.get(dataset_url, timeout=40)
        resp.raise_for_status()
        data = resp.json()

        mapping_objects = data.get("mapping_objects", [])
        print(f"[*] Recibidos {len(mapping_objects)} mapeos globales en el dataset. Filtrando para técnicas locales...")

        mapeos_insertados = 0
        controles_vistos = set()

        for item in mapping_objects:
            tecnica_id = item.get("attack_object_id")
            control_code = item.get("capability_id")
            control_name = item.get("capability_description") or control_code
            status = item.get("status")

            # Filtrar solo mapeos mapeables de técnicas que existen en nuestra base
            if (tecnica_id in tecnicas_locales 
                and control_code 
                and status != "non_mappable"):

                # 1. Upsert del Control normativo en NIST SP 800-53
                stmt_ctrl = insert(Control).values(
                    codigo=control_code,
                    nombre=control_name,
                    marco_id=marco_id
                ).on_conflict_do_update(
                    index_elements=["codigo", "marco_id"],
                    set_={"nombre": control_name}
                ).returning(Control.id)

                ctrl_id = db.execute(stmt_ctrl).scalar()
                if not ctrl_id:
                    ctrl_id = db.query(Control.id).filter(
                        Control.codigo == control_code,
                        Control.marco_id == marco_id
                    ).scalar()

                controles_vistos.add(control_code)

                # 2. Upsert de la relación Tecnica-Control con fuente trazable (Oficial)
                stmt_rel = insert(TecnicaControl).values(
                    tecnica_id=tecnica_id,
                    control_id=ctrl_id,
                    fuente_id=fuente_id
                ).on_conflict_do_update(
                    index_elements=["tecnica_id", "control_id"],
                    set_={"fuente_id": fuente_id}
                )
                db.execute(stmt_rel)
                mapeos_insertados += 1

        db.commit()
        print(f"[OK] Pipeline CTID finalizado: {mapeos_insertados} mapeos procesados ({len(controles_vistos)} controles normativos únicos vinculados).")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error durante la ejecución del ETL de CTID: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    ejecutar_etl_ctid()