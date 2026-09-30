"""
Seed Script: Identity & Access Management (IAM) Domain and Flagship Techniques
=============================================================================

Decisión de diseño para Identity & Access Management (IAM):
A diferencia de Endpoint (enfocado en ejecución de procesos, evasión de host y memoria local)
y Network (enfocado en protocolos L2-L4 e interconexión), el dominio IAM representa
la arquitectura de directorio corporativo, autenticación, autorización y federación de identidades
(Active Directory, Kerberos, LDAP, SAML, PKI/AD CS).

A diferencia de Endpoint, IAM posee protocolos formales con implementaciones concretas
(KDC, Domain Controllers, servicios de federación, servidores de catálogo) donde las vulnerabilidades
(CVEs) representan fallas estructurales críticas (ej. Zerologon, bypass de Kerberos/SAML).
Por ello, este dominio integra plenamente la cuádrupla:
Técnica ATT&CK <-> Controles NIST SP 800-53 (CTID) <-> Reglas de Detección Sigma <-> CVEs (NVD).
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

IAM_TECHNIQUES_FLAGSHIP = [
    # 1. Credential Access (11)
    "T1558",      # Steal or Forge Kerberos Tickets (Parent)
    "T1558.003",  # Kerberoasting
    "T1558.004",  # AS-REP Roasting
    "T1003.003",  # OS Credential Dumping: NTDS
    "T1003.006",  # OS Credential Dumping: DCSync
    "T1003.005",  # OS Credential Dumping: Cached Domain Credentials
    "T1110",      # Brute Force
    "T1110.003",  # Password Spraying
    "T1649",      # Steal or Forge Authentication Certificates (AD CS)
    "T1528",      # Steal Application Access Token
    "T1552.006",  # Unsecured Credentials: Group Policy Preferences
    "T1212",      # Exploitation for Credential Access (Zerologon, Netlogon)

    # 2. Lateral Movement via Authentication Material (3)
    "T1550.002",  # Use Alternate Authentication Material: Pass the Hash
    "T1550.003",  # Use Alternate Authentication Material: Pass the Ticket
    "T1550.001",  # Use Alternate Authentication Material: Application Access Token

    # 3. Persistence & Privilege Escalation via Directory / Accounts (6)
    "T1078",      # Valid Accounts
    "T1078.002",  # Valid Accounts: Domain Accounts
    "T1098",      # Account Manipulation (Shadow Credentials, SPNs, AdminSDHolder)
    "T1136.002",  # Create Account: Domain Account
    "T1484.001",  # Domain or Tenant Policy Modification: Domain-Level Group Policy
    "T1556",      # Modify Authentication Process (Skeleton Key, DC auth)
    "T1134.005",  # Access Token Manipulation: SID-History Injection

    # 4. Discovery (2)
    "T1482",      # Domain Trust Discovery
    "T1087.002",  # Account Discovery: Domain Account
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
    "lateral-movement": "Lateral Movement",
    "discovery": "Discovery",
    "impact": "Impact",
}


def sembrar_dominio_iam():
    print(">>> Iniciando siembra de Dominio y Técnicas: 'Identity & Access Management (IAM)'...")

    with sesion_etl() as db:
        # 1. Asegurar la existencia del nuevo Dominio
        dom = db.query(Dominio).filter(
            (Dominio.nombre == "Identity & Access Management (IAM)") |
            (Dominio.slug == "iam")
        ).first()

        if not dom:
            dom = Dominio(
                nombre="Identity & Access Management (IAM)",
                slug="iam"
            )
            db.add(dom)
            db.flush()
            print(f"[+] Nuevo dominio creado: ID {dom.id} - '{dom.nombre}' (slug: {dom.slug})")
        else:
            if dom.nombre != "Identity & Access Management (IAM)" or dom.slug != "iam":
                dom.nombre = "Identity & Access Management (IAM)"
                dom.slug = "iam"
                db.flush()
            print(f"[*] Dominio existente confirmado: ID {dom.id} - '{dom.nombre}' (slug: {dom.slug})")

        dominio_id = dom.id

        # 2. Descargar o leer STIX oficial de MITRE ATT&CK desde caché local o remoto
        cache_path = os.path.join(
            os.path.dirname(__file__), "..", "..", ".gemini", "antigravity-ide",
            "brain", "65087c25-ce1c-413d-85f3-5a836c006093", "scratch", "cache", "enterprise-attack.json"
        )
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

        # 3. Extraer metadata de las técnicas objetivo
        tecnicas_data = {}
        target_set = set(IAM_TECHNIQUES_FLAGSHIP)
        for obj in bundle.get("objects", []):
            if obj.get("type") == "attack-pattern" and not obj.get("revoked", False) and not obj.get("x_mitre_deprecated", False):
                refs = obj.get("external_references", [])
                mitre_ref = next((r for r in refs if r.get("source_name") == "mitre-attack"), None)
                if not mitre_ref or not mitre_ref.get("external_id"):
                    continue

                tid = mitre_ref["external_id"].upper()
                if tid in target_set:
                    kill_chain = obj.get("kill_chain_phases", [])
                    raw_phase = kill_chain[0]["phase_name"] if kill_chain else "unknown"
                    tactic_clean = TACTIC_MAP.get(raw_phase.lower(), raw_phase.replace("-", " ").title())

                    tecnicas_data[tid] = {
                        "id": tid,
                        "nombre": obj.get("name", tid),
                        "descripcion": obj.get("description", "")[:1000] if obj.get("description") else "",
                        "tactica": tactic_clean
                    }

        print(f"[*] Se localizaron {len(tecnicas_data)}/{len(IAM_TECHNIQUES_FLAGSHIP)} técnicas en el catálogo STIX.")

        # 4. Inserción Idempotente (UPSERT) en tecnicas y tecnica_dominio
        insertadas = 0
        vinculadas = 0
        for tid in IAM_TECHNIQUES_FLAGSHIP:
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
        print(f"    - Dominio: '{dom.nombre}' (ID: {dominio_id}, slug: {dom.slug})")
        print(f"    - Técnicas procesadas en tabla 'tecnicas': {insertadas}")
        print(f"    - Técnicas vinculadas en 'tecnica_dominio': {vinculadas}")


if __name__ == "__main__":
    sembrar_dominio_iam()
