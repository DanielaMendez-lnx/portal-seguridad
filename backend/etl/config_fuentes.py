
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
        "dataset_url": "https://raw.githubusercontent.com/center-for-threat-informed-defense/mappings-explorer/main/mappings/nist_800_53/attack-16.1/nist_800_53-rev5/enterprise/nist_800_53-rev5_attack-16.1-enterprise.json",
        "fecha_ultima_actualizacion": date.today()
    },
    "SigmaHQ": {
        "nombre": "SigmaHQ",
        "tipo_confianza": "Comunidad",
        "url": "https://github.com/SigmaHQ/sigma",
        "dataset_url": "https://github.com/SigmaHQ/sigma/releases/latest/download/sigma_all_rules.zip",
        "fecha_ultima_actualizacion": date.today()
    },
    "CISA": {
        "nombre": "CISA Advisories",
        "tipo_confianza": "Oficial",
        "url": "https://www.cisa.gov/news-events/cybersecurity-advisories",
        "feed_url": "https://www.cisa.gov/cybersecurity-advisories/all.xml",
        "fecha_ultima_actualizacion": date.today()
    },
    "NVD": {
        "nombre": "National Vulnerability Database (NVD)",
        "tipo_confianza": "Oficial",
        "url": "https://services.nvd.nist.gov/rest/json/cves/2.0",
        "fecha_ultima_actualizacion": date.today()
    },
}
