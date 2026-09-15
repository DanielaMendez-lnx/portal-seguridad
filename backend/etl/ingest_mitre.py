
import sys
import os
import requests

# Permitir importaciones relativas desde la carpeta app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.dialects.postgresql import insert
from app.database import SessionLocal
from app.models import Fuente, Dominio, Tecnica, tecnica_dominio
from etl.config_fuentes import CONFIG_FUENTES

print(">>> Iniciando script de ingesta de MITRE ATT&CK...")

def asegurar_fuente_y_dominio(db):
    """Garantiza que la fuente oficial y el dominio DNS existan en Neon."""
    meta_fuente = CONFIG_FUENTES["MITRE ATT&CK"]
    
    # 1. Upsert de la Fuente
    stmt_fuente = insert(Fuente).values(
        nombre=meta_fuente["nombre"],
        tipo_confianza=meta_fuente["tipo_confianza"],
        url=meta_fuente["url"],
        fecha_ultima_actualizacion=meta_fuente["fecha_ultima_actualizacion"]
    ).on_conflict_do_update(
        index_elements=["nombre"],
        set_={
            "tipo_confianza": meta_fuente["tipo_confianza"],
            "fecha_ultima_actualizacion": meta_fuente["fecha_ultima_actualizacion"]
        }
    ).returning(Fuente.id)
    
    fuente_id = db.execute(stmt_fuente).scalar()

    # 2. Upsert del Dominio 'DNS'
    stmt_dominio = insert(Dominio).values(nombre="DNS").on_conflict_do_nothing().returning(Dominio.id)
    dominio_id = db.execute(stmt_dominio).scalar()

    if not dominio_id:
        dominio_id = db.query(Dominio.id).filter(Dominio.nombre == "DNS").scalar()

    db.commit()
    return fuente_id, dominio_id

def ejecutar_etl_mitre():
    db = SessionLocal()
    try:
        print("[*] Verificando fuente y dominios base...")
        _, dominio_dns_id = asegurar_fuente_y_dominio(db)

        url_stix = CONFIG_FUENTES["MITRE ATT&CK"]["url"]
        print(f"[*] Descargando STIX oficial de MITRE ATT&CK ({url_stix[:50]}...)...")
        
        resp = requests.get(url_stix, timeout=30)
        resp.raise_for_status()
        bundle = resp.json()

        tecnicas_dns = []
        
        # Filtro de objetos tipo attack-pattern vinculados a DNS
        for obj in bundle.get("objects", []):
            if obj.get("type") == "attack-pattern" and not obj.get("revoked", False):
                external_refs = obj.get("external_references", [])
                mitre_ref = next((ref for ref in external_refs if ref.get("source_name") == "mitre-attack"), None)
                
                if not mitre_ref or not mitre_ref.get("external_id"):
                    continue

                tecnica_id = mitre_ref["external_id"]
                nombre = obj.get("name", "")
                descripcion = obj.get("description", "")
                
                # Filtrar técnicas asociadas al dominio de interés (DNS)
                es_dns = "DNS" in nombre or "DNS" in descripcion or tecnica_id == "T1071.004"
                
                if es_dns:
                    # Extraer táctica principal
                    kill_chain = obj.get("kill_chain_phases", [])
                    tactica = kill_chain[0]["phase_name"].replace("-", " ").title() if kill_chain else "Unknown"

                    tecnicas_dns.append({
                        "id": tecnica_id,
                        "nombre": nombre,
                        "descripcion": descripcion[:1000],  # Truncado de seguridad
                        "tactica": tactica
                    })

        print(f"[*] Se identificaron {len(tecnicas_dns)} técnicas relacionadas con DNS.")

        # Inserción Idempotente (UPSERT)
        for t in tecnicas_dns:
            stmt_tecnica = insert(Tecnica).values(
                id=t["id"],
                nombre=t["nombre"],
                descripcion=t["descripcion"],
                tactica=t["tactica"]
            ).on_conflict_do_update(
                index_elements=["id"],
                set_={
                    "nombre": t["nombre"],
                    "descripcion": t["descripcion"],
                    "tactica": t["tactica"]
                }
            )
            db.execute(stmt_tecnica)

            # Vincular con la tabla asociativa técnica_dominio
            stmt_rel = insert(tecnica_dominio).values(
                tecnica_id=t["id"],
                dominio_id=dominio_dns_id
            ).on_conflict_do_nothing()
            db.execute(stmt_rel)

        db.commit()
        print("[✓] Pipeline de MITRE ATT&CK finalizado exitosamente.")

    except Exception as e:
        db.rollback()
        print(f"[!] Error durante la ejecución del ETL: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    ejecutar_etl_mitre()
