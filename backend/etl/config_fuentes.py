
from datetime import date

CONFIG_FUENTES = {
    "MITRE ATT&CK": {
        "nombre": "MITRE ATT&CK",
        "tipo_confianza": "Oficial",
        "url": "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json",
        "fecha_ultima_actualizacion": date.today()
    },
    "CTID": {
        "nombre": "Mappings Explorer (CTID)",
        "tipo_confianza": "Oficial",
        "url": "https://center-for-threat-informed-defense.github.io/mappings-explorer/",
        "fecha_ultima_actualizacion": date.today()
    },
    "SigmaHQ": {
        "nombre": "SigmaHQ",
        "tipo_confianza": "Comunidad",
        "url": "https://github.com/SigmaHQ/sigma",
        "fecha_ultima_actualizacion": date.today()
    },
    "CISA": {
        "nombre": "CISA Advisories",
        "tipo_confianza": "Oficial",
        "url": "https://www.cisa.gov/news-events/cybersecurity-advisories",
        "fecha_ultima_actualizacion": date.today()
    }
}