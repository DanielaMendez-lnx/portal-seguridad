"""
Seed Script: Endpoint & Host Security Domain and Flagship Techniques
===================================================================

Decisión de diseño para Endpoint & Host Security:
A diferencia de dominios basados en protocolos de red específicos (como DNS o SMB),
el dominio de Endpoint representa una superficie de ejecución y comportamiento a nivel
de sistema operativo (Windows, Linux, macOS) y no un servicio de red cerrado con versiones.
Asociar CVEs genéricos de aplicaciones o parches del SO generaría ruido que no representa
debilidades estructurales del host. Por diseño de arquitectura, la fuente de CVEs (NVD)
queda excluida de este dominio en su fase inicial, concentrando el valor en la tríada:
Técnica ATT&CK <-> Controles NIST SP 800-53 (CTID) <-> Reglas de Detección Sigma (SigmaHQ).
"""

import os
import sys

import requests
from sqlalchemy.dialects.postgresql import insert

# Permitir importaciones de app y etl
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models import Dominio, Tecnica, tecnica_dominio
from etl.common import sesion_etl
from etl.config_fuentes import CONFIG_FUENTES

ENDPOINT_TECHNIQUES_FLAGSHIP = [
    # 1. Execution (4)
    "T1059.001",  # PowerShell
    "T1059.003",  # Windows Command Shell
    "T1047",      # Windows Management Instrumentation
    "T1059.004",  # Unix Shell

    # 2. Persistence (4)
    "T1547.001",  # Registry Run Keys / Startup Folder
    "T1543.003",  # Windows Service
    "T1053.005",  # Scheduled Task
    "T1546.003",  # WMI Event Subscription

    # 3. Privilege Escalation (4)
    "T1548.002",  # Bypass User Account Control
    "T1068",      # Exploitation for Privilege Escalation
    "T1055",      # Process Injection
    "T1134.001",  # Token Impersonation/Theft

    # 4. Defense Evasion (4)
    "T1218",      # System Binary Proxy Execution (LOLBins)
    "T1036",      # Masquerading
    "T1027",      # Obfuscated Files or Information
    "T1112",      # Modify Registry

    # 5. Credential Access (4)
    "T1003.001",  # LSASS Memory
    "T1003.002",  # Security Account Manager
    "T1003.004",  # LSA Secrets
    "T1552.001",  # Credentials In Files

    # 6. Discovery (3)
    "T1082",      # System Information Discovery
    "T1083",      # File and Directory Discovery
    "T1033",      # System Owner/User Discovery

    # 7. Impact (2)
    "T1486",      # Data Encrypted for Impact (Ransomware)
    "T1490",      # Inhibit System Recovery
]

# Normalización de tácticas MITRE ATT&CK
TACTIC_MAP = {
    "stealth": "Defense Evasion",
    "defense-impairment": "Defense Evasion",
    "defense-evasion": "Defense Evasion",
    "execution": "Execution",
    "persistence": "Persistence",
    "privilege-escalation": "Privilege Escalation",
    "credential-access": "Credential Access",
    "discovery": "Discovery",
    "impact": "Impact",
}

def sembrar_dominio_endpoint():
    print(">>> Iniciando siembra de Dominio y Técnicas: 'Endpoint & Host Security'...")

    with sesion_etl() as db:
        # 1. Asegurar la existencia del nuevo Dominio
        dom = db.query(Dominio).filter(
            (Dominio.nombre == "Endpoint & Host Security") |
            (Dominio.slug == "endpoint-host-security")
        ).first()

        if not dom:
            dom = Dominio(
                nombre="Endpoint & Host Security",
                slug="endpoint-host-security"
            )
            db.add(dom)
            db.flush()
            print(f"[+] Nuevo dominio creado: ID {dom.id} - '{dom.nombre}' (slug: {dom.slug})")
        else:
            if dom.nombre != "Endpoint & Host Security" or dom.slug != "endpoint-host-security":
                dom.nombre = "Endpoint & Host Security"
                dom.slug = "endpoint-host-security"
                db.flush()
            print(f"[*] Dominio existente confirmado: ID {dom.id} - '{dom.nombre}' (slug: {dom.slug})")

        dominio_id = dom.id

        # 2. Descargar o leer STIX oficial de MITRE ATT&CK
        # Buscar copia local en caché primero
        cache_path = os.path.join(os.path.dirname(__file__), "..", "..", ".gemini", "antigravity-ide", "brain", "65087c25-ce1c-413d-85f3-5a836c006093", "scratch", "cache", "enterprise-attack.json")
        bundle = None
        if os.path.exists(cache_path):
            print(f"[*] Cargando catálogo STIX desde caché local: {cache_path}...")
            import json
            with open(cache_path, "r", encoding="utf-8") as f:
                bundle = json.load(f)
        else:
            url_stix = CONFIG_FUENTES["MITRE ATT&CK"]["url"]
            print(f"[*] Descargando STIX oficial desde {url_stix}...")
            resp = requests.get(url_stix, timeout=60)
            resp.raise_for_status()
            bundle = resp.json()

        # 3. Extraer metadata de las 25 técnicas objetivo
        tecnicas_data = {}
        for obj in bundle.get("objects", []):
            if obj.get("type") == "attack-pattern" and not obj.get("revoked", False) and not obj.get("x_mitre_deprecated", False):
                refs = obj.get("external_references", [])
                mitre_ref = next((r for r in refs if r.get("source_name") == "mitre-attack"), None)
                if not mitre_ref or not mitre_ref.get("external_id"):
                    continue

                tid = mitre_ref["external_id"]
                if tid in ENDPOINT_TECHNIQUES_FLAGSHIP:
                    kill_chain = obj.get("kill_chain_phases", [])
                    raw_phase = kill_chain[0]["phase_name"] if kill_chain else "unknown"
                    tactic_clean = TACTIC_MAP.get(raw_phase.lower(), raw_phase.replace("-", " ").title())

                    tecnicas_data[tid] = {
                        "id": tid,
                        "nombre": obj.get("name", tid),
                        "descripcion": obj.get("description", "")[:1000] if obj.get("description") else "",
                        "tactica": tactic_clean
                    }

        print(f"[*] Se localizaron {len(tecnicas_data)}/{len(ENDPOINT_TECHNIQUES_FLAGSHIP)} técnicas en el catálogo STIX.")

        # 4. Inserción Idempotente (UPSERT) en tecnicas y tecnica_dominio
        insertadas = 0
        vinculadas = 0
        for tid in ENDPOINT_TECHNIQUES_FLAGSHIP:
            data = tecnicas_data.get(tid)
            if not data:
                print(f"[!] Advertencia: Técnica {tid} no encontrada en STIX.")
                continue

            stmt_tecnica = insert(Tecnica).values(
                id=data["id"],
                nombre=data["nombre"],
                descripcion=data["descripcion"],
                tactica=data["tactica"],
                protocolo=None,
            ).on_conflict_do_update(
                index_elements=["id"],
                set_={
                    "nombre": data["nombre"],
                    "descripcion": data["descripcion"],
                    "tactica": data["tactica"],
                }
            )
            db.execute(stmt_tecnica)
            insertadas += 1

            stmt_rel = insert(tecnica_dominio).values(
                tecnica_id=data["id"],
                dominio_id=dominio_id
            ).on_conflict_do_nothing()
            db.execute(stmt_rel)
            vinculadas += 1

        print("[OK] Siembra finalizada con éxito:")
        print(f"    - Dominio: '{dom.nombre}' (ID: {dominio_id})")
        print(f"    - Técnicas procesadas en tabla 'tecnicas': {insertadas}")
        print(f"    - Técnicas vinculadas en 'tecnica_dominio': {vinculadas}")

if __name__ == "__main__":
    sembrar_dominio_endpoint()
