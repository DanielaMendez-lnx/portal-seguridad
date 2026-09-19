
import os
import sys

import requests
from sqlalchemy.dialects.postgresql import insert

# Permitir importaciones relativas desde la carpeta app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models import Tecnica, tecnica_dominio
from etl.common import asegurar_dominio, asegurar_fuente, sesion_etl
from etl.config_fuentes import CONFIG_FUENTES

print(">>> Iniciando script de ingesta de MITRE ATT&CK...")

def ejecutar_etl_mitre():
    with sesion_etl() as db:
        print("[*] Verificando fuente y dominios base en Neon...")
        asegurar_fuente(db, "MITRE ATT&CK")
        dominio_dns_id = asegurar_dominio(db, "DNS")

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

        print("[OK] Pipeline de MITRE ATT&CK finalizado exitosamente.")

if __name__ == "__main__":
    ejecutar_etl_mitre()

