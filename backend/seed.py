from datetime import date

from app.database import SessionLocal
from app.models import (
    Control,
    Dominio,
    Fuente,
    MarcoNormativo,
    ReglaDeteccion,
    ReporteAmenaza,
    Tecnica,
    TecnicaControl,
)


def sembrar_datos():
    db = SessionLocal()
    try:
        print("Insertando datos iniciales de prueba...")

        # 1. Dominio
        dns_domain = Dominio(nombre="DNS")
        db.add(dns_domain)

        # 2. Marco Normativo
        nist = MarcoNormativo(nombre="NIST SP 800-53", version="Rev. 5")
        db.add(nist)
        db.flush()  # Genera el id de nist para usarlo como FK

        # 3. Fuentes
        ctid = Fuente(
            nombre="Mappings Explorer (CTID)",
            tipo_confianza="Oficial",
            url="https://center-for-threat-informed-defense.github.io/mappings-explorer/",
            fecha_ultima_actualizacion=date(2026, 1, 15)
        )
        sigma_src = Fuente(
            nombre="SigmaHQ",
            tipo_confianza="Comunidad",
            url="https://github.com/SigmaHQ/sigma",
            fecha_ultima_actualizacion=date(2026, 2, 1)
        )
        cisa_src = Fuente(
            nombre="CISA Advisories",
            tipo_confianza="Oficial",
            url="https://www.cisa.gov/news-events/cybersecurity-advisories",
            fecha_ultima_actualizacion=date(2026, 3, 1)
        )
        db.add_all([ctid, sigma_src, cisa_src])
        db.flush()

        # 4. Control
        sc20 = Control(
            codigo="SC-20",
            nombre="Secure Name / Address Resolution Service",
            marco_id=nist.id
        )
        db.add(sc20)
        db.flush()

        # 5. Técnica (DNS Tunneling) vinculada al dominio DNS
        t1071_004 = Tecnica(
            id="T1071.004",
            nombre="Application Layer Protocol: DNS",
            descripcion="Los adversarios pueden comunicarse usando el protocolo DNS para evadir la detección y exfiltrar datos.",
            tactica="Command and Control",
            dominios=[dns_domain]
        )
        db.add(t1071_004)
        db.flush()

        # 6. Mapeo Técnica <-> Control con Fuente
        mapeo = TecnicaControl(
            tecnica_id=t1071_004.id,
            control_id=sc20.id,
            fuente_id=ctid.id
        )
        db.add(mapeo)

        # 7. Regla de Detección
        regla = ReglaDeteccion(
            nombre="Suspicious High Volume DNS TXT Queries",
            formato="Sigma",
            log_source="dns_query_logs",
            url_fuente="https://github.com/SigmaHQ/sigma/blob/master/rules/network/dns/net_dns_susp_txt_query.yml",
            fuente_id=sigma_src.id,
            tecnicas=[t1071_004]
        )
        db.add(regla)

        # 8. Reporte de Amenaza (para las estadísticas históricas)
        reporte = ReporteAmenaza(
            titulo="Threat Actors Abusing DNS Tunneling in Cloud Environments",
            fecha_publicacion=date(2025, 11, 20),
            contador_incidencias=45,
            fuente_id=cisa_src.id,
            tecnicas=[t1071_004]
        )
        db.add(reporte)

        db.commit()
        print(" Datos insertados exitosamente en Neon.")
    except Exception as e:
        db.rollback()
        print(" Error al poblar la base de datos:", e)
    finally:
        db.close()

if __name__ == "__main__":
    sembrar_datos()
