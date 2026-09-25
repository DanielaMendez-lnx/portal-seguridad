
import os
import sys

import requests
from sqlalchemy.dialects.postgresql import insert

# Permitir importaciones relativas desde la carpeta app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models import Tecnica, tecnica_dominio
from etl.common import asegurar_dominio, asegurar_fuente, sesion_etl
from etl.config_fuentes import CONFIG_FUENTES

# Clasificación formal de técnicas para el dominio "Network Infrastructure & Protocols"
TECNICAS_OBJETIVO = {
    # DNS
    "T1071.004": "DNS",
    "T1590.002": "DNS",
    "T1596.001": "DNS",
    "T1583.002": "DNS",
    "T1584.002": "DNS",
    "T1568.001": "DNS",
    # SMB
    "T1021.002": "SMB",
    "T1557.001": "SMB",
    # FTP / TFTP
    "T1071.002": "FTP",
    "T1542.005": "FTP",
    "T1048.003": "FTP",
    # Core L2/L3 (DHCP & ARP)
    "T1557.003": "DHCP",
    "T1557.002": "ARP",
    "T1016": "ARP",
    # General de Red
    "T1040": "GENERAL",
    "T1046": "GENERAL",
    "T1557": "GENERAL",
    "T1498": "GENERAL",
}

print(">>> Iniciando script de ingesta de MITRE ATT&CK para Network Infrastructure & Protocols...")

def ejecutar_etl_mitre():
    with sesion_etl() as db:
        print("[*] Verificando fuente y dominio base en Neon...")
        asegurar_fuente(db, "MITRE ATT&CK")
        dominio_id = asegurar_dominio(
            db,
            nombre="Network Infrastructure & Protocols",
            slug="network-infrastructure-protocols"
        )

        url_stix = CONFIG_FUENTES["MITRE ATT&CK"]["url"]
        print(f"[*] Descargando STIX oficial de MITRE ATT&CK ({url_stix[:50]}...)...")

        resp = requests.get(url_stix, timeout=60)
        resp.raise_for_status()
        bundle = resp.json()

        tecnicas_a_ingestar = []

        # Filtro de objetos tipo attack-pattern vinculados al dominio de infraestructura de red
        for obj in bundle.get("objects", []):
            if obj.get("type") == "attack-pattern" and not obj.get("revoked", False) and not obj.get("x_mitre_deprecated", False):
                external_refs = obj.get("external_references", [])
                mitre_ref = next((ref for ref in external_refs if ref.get("source_name") == "mitre-attack"), None)

                if not mitre_ref or not mitre_ref.get("external_id"):
                    continue

                tecnica_id = mitre_ref["external_id"]
                nombre = obj.get("name", "")
                descripcion = obj.get("description", "")

                protocolo = None
                if tecnica_id in TECNICAS_OBJETIVO:
                    protocolo = TECNICAS_OBJETIVO[tecnica_id]
                elif "DNS" in nombre or "DNS" in descripcion or tecnica_id == "T1071.004":
                    protocolo = "DNS"

                if protocolo:
                    # Extraer táctica principal
                    kill_chain = obj.get("kill_chain_phases", [])
                    tactica = kill_chain[0]["phase_name"].replace("-", " ").title() if kill_chain else "Unknown"

                    tecnicas_a_ingestar.append({
                        "id": tecnica_id,
                        "nombre": nombre,
                        "descripcion": descripcion[:1000] if descripcion else "",
                        "tactica": tactica,
                        "protocolo": protocolo,
                    })

        print(f"[*] Se identificaron {len(tecnicas_a_ingestar)} técnicas pertenecientes a Network Infrastructure & Protocols.")

        # Inserción Idempotente (UPSERT)
        for t in tecnicas_a_ingestar:
            stmt_tecnica = insert(Tecnica).values(
                id=t["id"],
                nombre=t["nombre"],
                descripcion=t["descripcion"],
                tactica=t["tactica"],
                protocolo=t["protocolo"],
            ).on_conflict_do_update(
                index_elements=["id"],
                set_={
                    "nombre": t["nombre"],
                    "descripcion": t["descripcion"],
                    "tactica": t["tactica"],
                    "protocolo": t["protocolo"],
                }
            )
            db.execute(stmt_tecnica)

            # Vincular con la tabla asociativa técnica_dominio
            stmt_rel = insert(tecnica_dominio).values(
                tecnica_id=t["id"],
                dominio_id=dominio_id
            ).on_conflict_do_nothing()
            db.execute(stmt_rel)

        print("[OK] Pipeline de MITRE ATT&CK finalizado exitosamente con clasificación de protocolos.")

if __name__ == "__main__":
    ejecutar_etl_mitre()

