import os
import sys

import requests
from sqlalchemy.dialects.postgresql import insert

# Permitir importaciones desde la carpeta app y etl
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models import Control, TecnicaControl
from etl.common import (
    asegurar_fuente,
    asegurar_marco_normativo,
    obtener_ids_tecnicas_locales,
    sesion_etl,
)
from etl.config_fuentes import CONFIG_FUENTES

print(">>> Iniciando script de ingesta oficial de CTID Mappings Explorer...")

def ejecutar_etl_ctid():
    with sesion_etl() as db:
        print("[*] Sincronizando fuente CTID y marco normativo base en Neon...")
        fuente_id = asegurar_fuente(db, "CTID")
        marco_id = asegurar_marco_normativo(db, "NIST SP 800-53", "Rev. 5")

        tecnicas_locales = obtener_ids_tecnicas_locales(db)
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

            if (
                tecnica_id in tecnicas_locales
                and control_code
                and status != "non_mappable"
            ):
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

        print(f"[OK] Pipeline CTID finalizado: {mapeos_insertados} mapeos procesados ({len(controles_vistos)} controles normativos únicos vinculados).")

if __name__ == "__main__":
    ejecutar_etl_ctid()
