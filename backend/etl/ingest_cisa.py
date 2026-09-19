import hashlib
import os
import re
import sys
import xml.etree.ElementTree as ET
from datetime import date
from email.utils import parsedate_to_datetime

import requests
from sqlalchemy.dialects.postgresql import insert

# Permitir importaciones relativas desde app y etl
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models import (
    Dominio,
    ReporteAmenaza,
    Tecnica,
    reporte_dominio,
    tecnica_reporte,
    vulnerabilidad_dominio,
)
from etl.common import asegurar_dominio, asegurar_fuente, sesion_etl
from etl.config_fuentes import CONFIG_FUENTES

print(">>> Iniciando script de ingesta oficial de CISA Advisories...")

# Expresión regular para palabras clave representativas de amenazas en infraestructura DNS
REGEX_DNS_KEYWORDS = re.compile(
    r"\b(dns|domain name system|bind|named|dnsmasq|unbound|dns tunneling|fast flux|dga|domain generation algorithm|dns poisoning|dns cache poisoning|zone transfer|doh|dot)\b",
    re.IGNORECASE
)

# Expresión regular para detectar códigos ATT&CK (ej. T1071, T1071.004, T1568)
REGEX_ATTACK_CODE = re.compile(r"\b(T\d{4}(?:\.\d{3})?)\b", re.IGNORECASE)

# Expresión regular para detectar identificadores CVE
REGEX_CVE = re.compile(r"\b(CVE-\d{4}-\d{4,7})\b", re.IGNORECASE)


def extraer_guid_robusto(item, title, pub_date_str):
    """
    Obtiene un identificador único para el item.
    Si el feed no incluye <guid>, recurre al <link>.
    Si tampoco existe <link>, genera un hash SHA256 determinista.
    Garantiza que fuente_ref_id nunca sea NULL.
    """
    guid_elem = item.find("guid")
    if guid_elem is not None and guid_elem.text and guid_elem.text.strip():
        return guid_elem.text.strip()[:200]

    link_elem = item.find("link")
    if link_elem is not None and link_elem.text and link_elem.text.strip():
        return link_elem.text.strip()[:200]

    raw_seed = f"{title}_{pub_date_str}".encode("utf-8")
    return f"cisa-hash-{hashlib.sha256(raw_seed).hexdigest()[:32]}"


def parsear_fecha_rfc822(pub_date_str):
    """Parsea una fecha RFC 822 de RSS a un objeto datetime.date."""
    if not pub_date_str:
        return date.today()
    try:
        dt = parsedate_to_datetime(pub_date_str)
        return dt.date()
    except Exception:
        return date.today()


def ejecutar_etl_cisa():
    with sesion_etl() as db:
        print("[*] Sincronizando fuente CISA Advisories en Neon...")
        fuente_id = asegurar_fuente(db, "CISA")
        dominio_dns_id = asegurar_dominio(db, "DNS")

        # 1. Obtener conjunto de técnicas locales asociadas a DNS
        tecnicas_dns = set(
            r[0].upper()
            for r in db.query(Tecnica.id)
            .join(Tecnica.dominios)
            .filter(Dominio.id == dominio_dns_id)
            .all()
        )
        print(f"[*] Base local contiene {len(tecnicas_dns)} técnicas registradas para el dominio DNS.")

        # 2. Obtener CVEs locales asociados a DNS para enriquecer el cruce
        cves_dns = set(
            r[0].upper()
            for r in db.execute(
                vulnerabilidad_dominio.select().where(vulnerabilidad_dominio.c.dominio_id == dominio_dns_id)
            ).fetchall()
        )
        print(f"[*] Base local contiene {len(cves_dns)} CVEs asociados a DNS para correlación.")

        # 3. Descargar feed oficial de CISA
        feed_url = CONFIG_FUENTES["CISA"].get(
            "feed_url",
            "https://www.cisa.gov/cybersecurity-advisories/all.xml"
        )
        print(f"[*] Descargando feed oficial de CISA ({feed_url})...")

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
        resp = requests.get(feed_url, headers=headers, timeout=20)
        resp.raise_for_status()

        root = ET.fromstring(resp.content)
        items = root.findall(".//item")
        print(f"[*] Analizando {len(items)} boletines recibidos en el feed XML...")

        total_procesados = 0
        calificados_dns = 0
        asociados_tecnica = 0
        vinculos_tecnicas_totales = 0

        for item in items:
            total_procesados += 1
            title = (item.findtext("title") or "").strip()
            description = (item.findtext("description") or "").strip()
            pub_date_str = (item.findtext("pubDate") or "").strip()

            fecha_pub = parsear_fecha_rfc822(pub_date_str)
            fuente_ref_id = extraer_guid_robusto(item, title, pub_date_str)

            texto_completo = f"{title}\n{description}"
            cves_mencionados = set(m.upper() for m in REGEX_CVE.findall(texto_completo))
            hay_cve_dns = any(cve in cves_dns for cve in cves_mencionados)
            hay_keyword_dns = bool(REGEX_DNS_KEYWORDS.search(texto_completo))

            if not (hay_keyword_dns or hay_cve_dns):
                continue

            calificados_dns += 1

            stmt_reporte = insert(ReporteAmenaza).values(
                titulo=title[:300],
                fecha_publicacion=fecha_pub,
                fuente_id=fuente_id,
                fuente_ref_id=fuente_ref_id,
                contador_incidencias=1
            ).on_conflict_do_update(
                index_elements=["fuente_id", "fuente_ref_id"],
                set_={
                    "titulo": title[:300],
                    "fecha_publicacion": fecha_pub
                }
            ).returning(ReporteAmenaza.id)

            rep_id = db.execute(stmt_reporte).scalar()
            if not rep_id:
                rep_id = db.query(ReporteAmenaza.id).filter(
                    ReporteAmenaza.fuente_id == fuente_id,
                    ReporteAmenaza.fuente_ref_id == fuente_ref_id
                ).scalar()

            stmt_rep_dom = insert(reporte_dominio).values(
                reporte_id=rep_id,
                dominio_id=dominio_dns_id
            ).on_conflict_do_nothing()
            db.execute(stmt_rep_dom)

            codigos_raw = REGEX_ATTACK_CODE.findall(texto_completo)
            tecnicas_mencionadas = set(
                c.upper() for c in codigos_raw if c.upper() in tecnicas_dns
            )

            if tecnicas_mencionadas:
                asociados_tecnica += 1
                for t_id in tecnicas_mencionadas:
                    stmt_tec = insert(tecnica_reporte).values(
                        tecnica_id=t_id,
                        reporte_id=rep_id
                    ).on_conflict_do_nothing()
                    db.execute(stmt_tec)
                    vinculos_tecnicas_totales += 1

        print("\n[OK] Pipeline de CISA Advisories finalizado:")
        print(f" - Total boletines procesados en el feed: {total_procesados}")
        print(f" - Boletines calificados para dominio DNS (reporte_dominio): {calificados_dns}")
        print(f" - Boletines que además citaron técnicas ATT&CK explícitas (tecnica_reporte): {asociados_tecnica}")
        print(f" - Vínculos totales creados en tecnica_reporte: {vinculos_tecnicas_totales}")


if __name__ == "__main__":
    ejecutar_etl_cisa()
