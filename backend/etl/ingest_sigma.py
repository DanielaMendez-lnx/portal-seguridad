import io
import os
import sys
import zipfile

import requests
import yaml
from sqlalchemy.dialects.postgresql import insert

# Permitir importaciones desde la carpeta app y etl
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models import ReglaDeteccion, tecnica_regla
from etl.common import (
    asegurar_fuente,
    obtener_ids_tecnicas_locales,
    sesion_etl,
)
from etl.config_fuentes import CONFIG_FUENTES

print(">>> Iniciando script de ingesta oficial de SigmaHQ (Comunidad)...")

def formatear_log_source(logsource_dict):
    """Extrae una descripción legible de la fuente de logs de una regla Sigma."""
    if not isinstance(logsource_dict, dict):
        return "generic"

    category = logsource_dict.get("category")
    product = logsource_dict.get("product")
    service = logsource_dict.get("service")

    parts = []
    if product:
        parts.append(product)
    if service:
        parts.append(service)
    if category and not parts:
        parts.append(category)

    res = " / ".join(parts) if parts else str(category or "generic")
    return res[:100]

def ejecutar_etl_sigma():
    with sesion_etl() as db:
        print("[*] Sincronizando fuente SigmaHQ en Neon...")
        fuente_id = asegurar_fuente(db, "SigmaHQ")

        tecnicas_locales = {t.upper() for t in obtener_ids_tecnicas_locales(db)}
        print(f"[*] Base local contiene {len(tecnicas_locales)} técnicas registradas para cruzar reglas.")

        dataset_url = CONFIG_FUENTES["SigmaHQ"].get(
            "dataset_url",
            "https://github.com/SigmaHQ/sigma/releases/latest/download/sigma_all_rules.zip"
        )
        print(f"[*] Descargando paquete oficial de reglas Sigma ({dataset_url[:55]}...)...")

        resp = requests.get(dataset_url, timeout=60)
        resp.raise_for_status()

        zf = zipfile.ZipFile(io.BytesIO(resp.content))

        reglas_insertadas = 0
        vinculos_creados = 0
        tecnicas_cubiertas = set()

        for filename in zf.namelist():
            if not filename.endswith((".yml", ".yaml")):
                continue

            try:
                content = zf.read(filename).decode("utf-8", errors="ignore")
                rule_data = yaml.safe_load(content)

                if not isinstance(rule_data, dict):
                    continue

                tags = rule_data.get("tags", [])
                if not isinstance(tags, list):
                    continue

                attack_tags = [
                    t.replace("attack.", "").upper()
                    for t in tags
                    if isinstance(t, str) and t.startswith("attack.t")
                ]

                tecnicas_coincidentes = [t for t in attack_tags if t in tecnicas_locales]

                if not tecnicas_coincidentes:
                    continue

                nombre_regla = rule_data.get("title", filename.split("/")[-1])
                log_source = formatear_log_source(rule_data.get("logsource", {}))

                regla = db.query(ReglaDeteccion).filter(ReglaDeteccion.nombre == nombre_regla).first()
                if not regla:
                    regla = ReglaDeteccion(
                        nombre=nombre_regla,
                        formato="Sigma",
                        log_source=log_source,
                        fuente_id=fuente_id
                    )
                    db.add(regla)
                    db.flush()
                    reglas_insertadas += 1

                for t_id in tecnicas_coincidentes:
                    stmt_rel = insert(tecnica_regla).values(
                        tecnica_id=t_id,
                        regla_id=regla.id
                    ).on_conflict_do_nothing()
                    db.execute(stmt_rel)
                    vinculos_creados += 1
                    tecnicas_cubiertas.add(t_id)

            except Exception:
                continue

        print(f"[OK] Pipeline Sigma finalizado: {reglas_insertadas} reglas nuevas creadas, {vinculos_creados} vínculos establecidos.")
        print(f"[*] Cobertura defensiva: {len(tecnicas_cubiertas)}/{len(tecnicas_locales)} técnicas DNS cuentan con reglas de detección activas.")

if __name__ == "__main__":
    ejecutar_etl_sigma()
