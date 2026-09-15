
import sys
import os
from sqlalchemy.dialects.postgresql import insert

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models import Fuente, Tecnica, ReglaDeteccion, tecnica_regla
from etl.config_fuentes import CONFIG_FUENTES

# Reglas oficiales de detección de la comunidad SigmaHQ enfocadas en DNS y exfiltración
SIGMA_RULES_DATA = [
    {
        "nombre": "Suspicious DNS TXT Query Volume (DNS Tunneling)",
        "formato": "Sigma",
        "log_source": "dns_query_logs",
        "tecnicas": ["T1071.004", "T1048.003"]
    },
    {
        "nombre": "High Frequency of Unique Subdomains Queried (DGA / Fast Flux)",
        "formato": "Sigma",
        "log_source": "dns_query_logs",
        "tecnicas": ["T1568.001", "T1568.002"]
    },
    {
        "nombre": "Excessive DNS Query Failures (NXDOMAIN Anomalies)",
        "formato": "Sigma",
        "log_source": "dns_server_logs",
        "tecnicas": ["T1568", "T1568.002"]
    },
    {
        "nombre": "DNS Request with Anomalous Protocol Header Length",
        "formato": "Sigma",
        "log_source": "zeek_dns",
        "tecnicas": ["T1001.003", "T1071.004"]
    }
]

def asegurar_fuente_sigma(db):
    meta = CONFIG_FUENTES["SigmaHQ"]
    stmt = insert(Fuente).values(
        nombre=meta["nombre"],
        tipo_confianza=meta["tipo_confianza"],
        url=meta["url"],
        fecha_ultima_actualizacion=meta["fecha_ultima_actualizacion"]
    ).on_conflict_do_update(
        index_elements=["nombre"],
        set_={"tipo_confianza": meta["tipo_confianza"]}
    ).returning(Fuente.id)
    
    fuente_id = db.execute(stmt).scalar()
    db.commit()
    return fuente_id

def ejecutar_etl_sigma():
    db = SessionLocal()
    try:
        print("[*] Verificando fuente SigmaHQ...")
        fuente_id = db.ensure_sigma_id if hasattr(db, "ensure_sigma_id") else asegurar_fuente_sigma(db)

        tecnicas_locales = set(r[0] for r in db.query(Tecnica.id).all())
        reglas_insertadas = 0

        for r in SIGMA_RULES_DATA:
            # 1. Insertar regla de detección
            stmt_regla = insert(ReglaDeteccion).values(
                nombre=r["nombre"],
                formato=r["formato"],
                log_source=r["log_source"],
                fuente_id=fuente_id
            ).on_conflict_do_nothing().returning(ReglaDeteccion.id)
            
            regla_id = db.execute(stmt_regla).scalar()
            if not regla_id:
                regla_id = db.query(ReglaDeteccion.id).filter(
                    ReglaDeteccion.nombre == r["nombre"]
                ).scalar()

            # 2. Asociar con las técnicas existentes
            for t_id in r["tecnicas"]:
                if t_id in tecnicas_locales:
                    stmt_rel = insert(tecnica_regla).values(
                        tecnica_id=t_id,
                        regla_id=regla_id
                    ).on_conflict_do_nothing()
                    db.execute(stmt_rel)

            reglas_insertadas += 1

        db.commit()
        print(f"[✓] Pipeline Sigma finalizado: {reglas_insertadas} reglas de detección asociadas.")

    except Exception as e:
        db.rollback()
        print(f"[!] Error durante el ETL de Sigma: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    ejecutar_etl_sigma()
    