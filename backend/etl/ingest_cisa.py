import os
import sys
import re
import hashlib
import requests
import xml.etree.ElementTree as ET
from datetime import date
from email.utils import parsedate_to_datetime
from sqlalchemy.dialects.postgresql import insert

# Permitir importaciones relativas desde app y etl
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models import (
    Fuente,
    Dominio,
    Tecnica,
    ReporteAmenaza,
    reporte_dominio,
    tecnica_reporte,
    vulnerabilidad_dominio
)
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


def asegurar_fuente_cisa(db):
    """Garantiza la existencia y actualización de la fuente CISA Advisories en Neon."""
    meta = CONFIG_FUENTES["CISA"]
    stmt = insert(Fuente).values(
        nombre=meta["nombre"],
        tipo_confianza=meta["tipo_confianza"],
        url=meta["url"],
        fecha_ultima_actualizacion=meta["fecha_ultima_actualizacion"]
    ).on_conflict_do_update(
        index_elements=["nombre"],
        set_={
            "tipo_confianza": meta["tipo_confianza"],
            "url": meta["url"],
            "fecha_ultima_actualizacion": meta["fecha_ultima_actualizacion"]
        }
    ).returning(Fuente.id)

    fuente_id = db.execute(stmt).scalar()
    db.commit()
    return fuente_id


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
    db = SessionLocal()
    try:
        print("[*] Sincronizando fuente CISA Advisories en Neon...")
        fuente_id = asegurar_fuente_cisa(db)

        # 1. Obtener dominio DNS
        dom = db.query(Dominio).filter(Dominio.nombre.ilike("DNS")).first()
        if not dom:
            raise ValueError("Dominio 'DNS' no encontrado en la base de datos.")

        # 2. Obtener conjunto de técnicas locales asociadas a DNS
        tecnicas_dns = set(
            r[0].upper()
            for r in db.query(Tecnica.id)
            .join(Tecnica.dominios)
            .filter(Dominio.id == dom.id)
            .all()
        )
        print(f"[*] Base local contiene {len(tecnicas_dns)} técnicas registradas para el dominio DNS.")

        # 3. Obtener CVEs locales asociados a DNS para enriquecer el cruce
        cves_dns = set(
            r[0].upper()
            for r in db.execute(
                vulnerabilidad_dominio.select().where(vulnerabilidad_dominio.c.dominio_id == dom.id)
            ).fetchall()
        )
        print(f"[*] Base local contiene {len(cves_dns)} CVEs asociados a DNS para correlación.")

        # 4. Descargar feed oficial de CISA
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
        channel = root.find("channel")
        items = channel.findall("item") if channel is not None else []
        print(f"[*] Feed parseado exitosamente: {len(items)} boletines/advisories recibidos.")

        total_procesados = len(items)
        calificados_dns = 0
        asociados_tecnica = 0
        vinculos_tecnicas_totales = 0

        for item in items:
            title_elem = item.find("title")
            pubdate_elem = item.find("pubDate")
            desc_elem = item.find("description")

            title = title_elem.text.strip() if title_elem is not None and title_elem.text else "Sin título"
            pubdate_str = pubdate_elem.text.strip() if pubdate_elem is not None and pubdate_elem.text else ""
            desc = desc_elem.text.strip() if desc_elem is not None and desc_elem.text else ""

            guid_ref = extraer_guid_robusto(item, title, pubdate_str)
            fecha_pub = parsear_fecha_rfc822(pubdate_str)

            texto_analisis = f"{title} {desc}"

            # Evaluar coincidencias
            dns_keywords_found = REGEX_DNS_KEYWORDS.findall(texto_analisis)
            cves_encontrados = set(c.upper() for c in REGEX_CVE.findall(texto_analisis) if c.upper() in cves_dns)
            tecnicas_mencionadas = set(t.upper() for t in REGEX_ATTACK_CODE.findall(texto_analisis) if t.upper() in tecnicas_dns)

            califica_para_dns = bool(dns_keywords_found or cves_encontrados or tecnicas_mencionadas)

            if not califica_para_dns:
                continue

            calificados_dns += 1

            # 1. UPSERT en reportes_amenaza por (fuente_ref_id, fuente_id)
            stmt_rep = insert(ReporteAmenaza).values(
                titulo=title[:250],
                fecha_publicacion=fecha_pub,
                contador_incidencias=1,
                fuente_id=fuente_id,
                fuente_ref_id=guid_ref
            ).on_conflict_do_update(
                index_elements=["fuente_ref_id", "fuente_id"],
                set_={
                    "titulo": title[:250],
                    "fecha_publicacion": fecha_pub
                }
            ).returning(ReporteAmenaza.id)

            rep_id = db.execute(stmt_rep).scalar()

            # 2. Vincular obligatoriamente al Dominio DNS en reporte_dominio
            stmt_dom = insert(reporte_dominio).values(
                reporte_id=rep_id,
                dominio_id=dom.id
            ).on_conflict_do_nothing()
            db.execute(stmt_dom)

            # 3. Vincular a técnica_reporte SOLO si se mencionaron técnicas ATT&CK explícitas
            if tecnicas_mencionadas:
                asociados_tecnica += 1
                for t_id in tecnicas_mencionadas:
                    stmt_tec = insert(tecnica_reporte).values(
                        tecnica_id=t_id,
                        reporte_id=rep_id
                    ).on_conflict_do_nothing()
                    db.execute(stmt_tec)
                    vinculos_tecnicas_totales += 1

        db.commit()

        print(f"\n[OK] Pipeline de CISA Advisories finalizado:")
        print(f" - Total boletines procesados en el feed: {total_procesados}")
        print(f" - Boletines calificados para dominio DNS (reporte_dominio): {calificados_dns}")
        print(f" - Boletines que además citaron técnicas ATT&CK explícitas (tecnica_reporte): {asociados_tecnica}")
        print(f" - Vínculos totales creados en tecnica_reporte: {vinculos_tecnicas_totales}")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error durante el ETL de CISA: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    ejecutar_etl_cisa()
