
import sys
import os
from sqlalchemy.dialects.postgresql import insert

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models import Fuente, MarcoNormativo, Control, Tecnica, TecnicaControl
from etl.config_fuentes import CONFIG_FUENTES

# Mapeos oficiales de mitigación (CTID Mappings Explorer: ATT&CK -> NIST SP 800-53 Rev 5)
# enfocados en vectores de red, exfiltración, C2 y resolución de nombres (DNS).
MINT_CTID_DATA = [
    # T1071.004 - Application Layer Protocol: DNS
    {"tecnica_id": "T1071.004", "control_code": "SC-20", "control_name": "Secure Name / Address Resolution Service"},
    {"tecnica_id": "T1071.004", "control_code": "SC-7",  "control_name": "Boundary Protection"},
    {"tecnica_id": "T1071.004", "control_code": "SI-4",  "control_name": "System Monitoring"},
    {"tecnica_id": "T1071.004", "control_code": "AU-6",  "control_name": "Audit Record Review, Analysis, and Reporting"},
    {"tecnica_id": "T1071.004", "control_code": "AC-17", "control_name": "Remote Access"},

    # T1568 - Dynamic Resolution
    {"tecnica_id": "T1568", "control_code": "SC-20", "control_name": "Secure Name / Address Resolution Service"},
    {"tecnica_id": "T1568", "control_code": "SI-4",  "control_name": "System Monitoring"},
    {"tecnica_id": "T1568", "control_code": "SC-7",  "control_name": "Boundary Protection"},

    # T1568.001 - Fast Flux DNS
    {"tecnica_id": "T1568.001", "control_code": "SC-20", "control_name": "Secure Name / Address Resolution Service"},
    {"tecnica_id": "T1568.001", "control_code": "SI-4",  "control_name": "System Monitoring"},

    # T1568.002 - Domain Generation Algorithms (DGA)
    {"tecnica_id": "T1568.002", "control_code": "SC-20", "control_name": "Secure Name / Address Resolution Service"},
    {"tecnica_id": "T1568.002", "control_code": "SI-4",  "control_name": "System Monitoring"},
    {"tecnica_id": "T1568.002", "control_code": "SC-7",  "control_name": "Boundary Protection"},

    # T1048.003 - Exfiltration Over Alternative Protocol: DNS
    {"tecnica_id": "T1048.003", "control_code": "SC-7",  "control_name": "Boundary Protection"},
    {"tecnica_id": "T1048.003", "control_code": "SI-4",  "control_name": "System Monitoring"},
    {"tecnica_id": "T1048.003", "control_code": "AU-6",  "control_name": "Audit Record Review, Analysis, and Reporting"},

    # T1001.003 - Data Obfuscation: Protocol Impersonation
    {"tecnica_id": "T1001.003", "control_code": "SI-4",  "control_name": "System Monitoring"},
    {"tecnica_id": "T1001.003", "control_code": "SC-7",  "control_name": "Boundary Protection"}
]

def asegurar_entidades_base(db):
    """Garantiza la existencia de la fuente CTID y el marco NIST 800-53 Rev. 5."""
    meta_fuente = CONFIG_FUENTES["CTID"]
    stmt_fuente = insert(Fuente).values(
        nombre=meta_fuente["nombre"],
        tipo_confianza=meta_fuente["tipo_confianza"],
        url=meta_fuente["url"],
        fecha_ultima_actualizacion=meta_fuente["fecha_ultima_actualizacion"]
    ).on_conflict_do_update(
        index_elements=["nombre"],
        set_={"tipo_confianza": meta_fuente["tipo_confianza"]}
    ).returning(Fuente.id)
    fuente_id = db.execute(stmt_fuente).scalar()

    # Marco NIST SP 800-53 Rev. 5
    stmt_marco = insert(MarcoNormativo).values(
        nombre="NIST SP 800-53",
        version="Rev. 5"
    ).on_conflict_do_nothing().returning(MarcoNormativo.id)
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
        print("[*] Verificando fuente CTID y marco normativo base...")
        fuente_id, marco_id = asegurar_entidades_base(db)

        # Identificar las técnicas registradas en Neon
        tecnicas_locales = set(r[0] for r in db.query(Tecnica.id).all())
        print(f"[*] Base local contiene {len(tecnicas_locales)} técnicas para cruzar mapeos.")

        print(f"[*] Procesando mapeos oficiales de mitigación CTID...")
        mapeos_insertados = 0

        for item in MINT_CTID_DATA:
            tecnica_id = item["tecnica_id"]
            control_code = item["control_code"]
            control_name = item["control_name"]

            # Vincular solo si la técnica existe en la base de datos
            if tecnica_id in tecnicas_locales:
                # 1. Upsert del Control normativo en NIST
                stmt_ctrl = insert(Control).values(
                    codigo=control_code,
                    nombre=control_name,
                    marco_id=marco_id
                ).on_conflict_do_nothing(
                    index_elements=["codigo", "marco_id"]
                ).returning(Control.id)
                
                ctrl_id = db.execute(stmt_ctrl).scalar()
                if not ctrl_id:
                    ctrl_id = db.query(Control.id).filter(
                        Control.codigo == control_code,
                        Control.marco_id == marco_id
                    ).scalar()

                # 2. Upsert de la tabla asociativa con fuente trazable
                stmt_rel = insert(TecnicaControl).values(
                    tecnica_id=tecnica_id,
                    control_id=ctrl_id,
                    fuente_id=fuente_id
                ).on_conflict_do_nothing()
                db.execute(stmt_rel)
                
                mapeos_insertados += 1

        db.commit()
        print(f"[✓] Pipeline CTID finalizado: {mapeos_insertados} controles normativos vinculados exitosamente.")

    except Exception as e:
        db.rollback()
        print(f"[!] Error durante el ETL de CTID: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    ejecutar_etl_ctid()