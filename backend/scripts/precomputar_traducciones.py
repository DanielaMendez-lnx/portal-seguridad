"""
Script de Precomputación Batch de Traducciones SIEM (Splunk, Elastic, KQL)
========================================================================
Convierte las 1,285 reglas de detección registradas en Neon a consultas
optimizadas para Splunk (SPL), Elasticsearch (Lucene / ECS) y KQL
(Microsoft 365 Defender XDR y Azure Sentinel / Log Analytics).

Las traducciones se precomputan y persisten de forma definitiva en la tabla
'reglas_traducciones' de Neon mediante inserciones idempotentes (UPSERT).
"""

import os
import sys
import copy
import re
import zipfile
import time
import requests
import dotenv

# Configurar rutas y entorno
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
dotenv.load_dotenv(os.path.join(BASE_DIR, ".env"))
sys.path.append(BASE_DIR)

from sqlalchemy.dialects.postgresql import insert
from app.database import SessionLocal
from app.models import ReglaDeteccion, ReglaTraduccion

# Librerías pySigma
from sigma.collection import SigmaCollection
from sigma.backends.splunk import SplunkBackend
from sigma.pipelines.splunk import splunk_windows_pipeline
from sigma.backends.elasticsearch import LuceneBackend
from sigma.pipelines.elasticsearch import ecs_windows
from sigma.backends.kusto import KustoBackend
from sigma.pipelines.microsoft365defender import microsoft_365_defender_pipeline

# 1. Catálogo estricto de campos booleanos Sysmon para normalizar solo en Elastic
SYSMON_BOOLEAN_FIELDS = [
    "Initiated",
    "SourceIsIpv6",
    "DestinationIsIpv6",
    "Signed",
    "IsExecutable",
    "Archived"
]

def normalizar_para_elastic(yaml_text: str) -> str:
    """Normaliza exclusivamente campos booleanos Sysmon de 'true'/'false' a true/false nativo para Elastic ECS."""
    res = yaml_text
    for field in SYSMON_BOOLEAN_FIELDS:
        res = re.sub(rf"(\b{field}\b\s*:\s*)['\"]true['\"]", r"\1true", res, flags=re.IGNORECASE)
        res = re.sub(rf"(\b{field}\b\s*:\s*)['\"]false['\"]", r"\1false", res, flags=re.IGNORECASE)
    return res

def precomputar_todas_las_traducciones():
    t_inicio = time.time()
    print("="*70)
    print(">>> Iniciando precomputación batch de traducciones SIEM...")
    print("="*70)

    # Inicializar backends en memoria una sola vez
    print("[*] Inicializando backends y pipelines de pySigma...")
    sp_win = SplunkBackend(processing_pipeline=splunk_windows_pipeline())
    sp_gen = SplunkBackend()

    el_win = LuceneBackend(processing_pipeline=ecs_windows())
    el_gen = LuceneBackend()

    kql_m365 = KustoBackend(processing_pipeline=microsoft_365_defender_pipeline())
    kql_gen = KustoBackend()

    # Cargar archivo ZIP local con todas las reglas oficiales
    zip_path = os.path.join(BASE_DIR, "..", "temp_sigma_all.zip")
    if not os.path.exists(zip_path):
        print(f"[*] Descargando catálogo oficial de reglas SigmaHQ...")
        url = "https://github.com/SigmaHQ/sigma/releases/latest/download/sigma_all_rules.zip"
        r = requests.get(url, timeout=60)
        with open(zip_path, "wb") as f:
            f.write(r.content)

    zf = zipfile.ZipFile(zip_path)
    zip_files = set(zf.namelist())
    print(f"[*] Catálogo ZIP cargado: {len(zip_files)} reglas disponibles.")

    db = SessionLocal()
    session_http = requests.Session()

    try:
        reglas = db.query(ReglaDeteccion).order_by(ReglaDeteccion.id).all()
        total_reglas = len(reglas)
        print(f"[*] Total de reglas registradas en Neon a procesar: {total_reglas}\n")

        contador_splunk = 0
        contador_elastic = 0
        contador_kql_defender = 0
        contador_kql_sentinel = 0
        errores_conversion = 0

        lote_traducciones = []
        BATCH_SIZE = 100

        for idx, r in enumerate(reglas, 1):
            url_f = r.url_fuente or ""
            yaml_content = None

            # 1. Obtener contenido YAML desde ZIP
            if "/blob/master/" in url_f:
                rel_path = url_f.split("/blob/master/")[1]
                if rel_path in zip_files:
                    yaml_content = zf.read(rel_path).decode("utf-8", errors="replace")
                else:
                    fname = rel_path.split("/")[-1]
                    for zn in zip_files:
                        if zn.endswith("/" + fname):
                            yaml_content = zf.read(zn).decode("utf-8", errors="replace")
                            break

            # Fallback a GitHub Raw si no se encuentra en el ZIP
            if not yaml_content and url_f:
                try:
                    raw_u = url_f.replace("github.com/SigmaHQ/sigma/blob/master/", "raw.githubusercontent.com/SigmaHQ/sigma/master/")
                    resp = session_http.get(raw_u, timeout=10)
                    if resp.status_code == 200:
                        yaml_content = resp.text
                except Exception:
                    pass

            if not yaml_content:
                print(f"[!] No se pudo obtener YAML para ID {r.id}: {r.nombre}")
                errores_conversion += 1
                continue

            # Parsear colección Sigma original
            try:
                col_orig = SigmaCollection.from_yaml(yaml_content)
            except Exception as e:
                print(f"[!] Error de parseo YAML en regla ID {r.id}: {e}")
                errores_conversion += 1
                continue

            is_windows = "windows" in (r.log_source or "").lower()

            # ----------------------------------------------------
            # A. SPLUNK (SPL)
            # ----------------------------------------------------
            q_sp = None
            flavor_sp = "SPL (Windows / Sysmon)" if is_windows else "SPL (Genérico)"
            try:
                backend_sp = sp_win if is_windows else sp_gen
                res_sp = backend_sp.convert(copy.deepcopy(col_orig))
                if res_sp:
                    q_sp = res_sp[0].strip()
            except Exception:
                # Fallback sin pipeline
                try:
                    res_sp = sp_gen.convert(copy.deepcopy(col_orig))
                    if res_sp:
                        q_sp = res_sp[0].strip()
                        flavor_sp = "SPL (Genérico)"
                except Exception:
                    pass

            if q_sp:
                lote_traducciones.append({
                    "regla_id": r.id,
                    "formato": "splunk",
                    "query": q_sp,
                    "flavor_label": flavor_sp,
                    "target_table": None
                })
                contador_splunk += 1

            # ----------------------------------------------------
            # B. ELASTICSEARCH (Lucene / ECS)
            # ----------------------------------------------------
            q_el = None
            flavor_el = "Lucene (ECS)" if is_windows else "Lucene (Genérico)"
            try:
                if is_windows:
                    # Aplicar normalización Sysmon SOLO sobre copia de Elastic
                    yaml_el = normalizar_para_elastic(yaml_content)
                    col_el = SigmaCollection.from_yaml(yaml_el)
                    res_el = el_win.convert(col_el)
                else:
                    res_el = el_gen.convert(copy.deepcopy(col_orig))

                if res_el:
                    q_el = res_el[0].strip()
            except Exception:
                try:
                    res_el = el_gen.convert(copy.deepcopy(col_orig))
                    if res_el:
                        q_el = res_el[0].strip()
                        flavor_el = "Lucene (Genérico)"
                except Exception:
                    pass

            if q_el:
                lote_traducciones.append({
                    "regla_id": r.id,
                    "formato": "elastic",
                    "query": q_el,
                    "flavor_label": flavor_el,
                    "target_table": None
                })
                contador_elastic += 1

            # ----------------------------------------------------
            # C. KQL - DEFENDER XDR (si aplica)
            # ----------------------------------------------------
            try:
                res_kql_xdr = kql_m365.convert(copy.deepcopy(col_orig))
                if res_kql_xdr:
                    q_xdr = res_kql_xdr[0].strip()
                    first_line = q_xdr.splitlines()[0].strip()
                    table_name = first_line.split()[0] if first_line else "DeviceEvents"

                    lote_traducciones.append({
                        "regla_id": r.id,
                        "formato": "kql_defender",
                        "query": q_xdr,
                        "flavor_label": "KQL (Microsoft 365 Defender)",
                        "target_table": table_name
                    })
                    contador_kql_defender += 1
            except Exception:
                # No compatible con MDE XDR (esperado en proxy, cloud, linux, etc.)
                pass

            # ----------------------------------------------------
            # D. KQL - SENTINEL / LOG ANALYTICS (Genérico)
            # ----------------------------------------------------
            try:
                res_kql_gen = kql_gen.convert(copy.deepcopy(col_orig))
                if res_kql_gen:
                    q_gen = res_kql_gen[0].strip()
                    lote_traducciones.append({
                        "regla_id": r.id,
                        "formato": "kql_sentinel",
                        "query": q_gen,
                        "flavor_label": "KQL (Sentinel / Log Analytics)",
                        "target_table": None
                    })
                    contador_kql_sentinel += 1
            except Exception:
                pass

            # Inserción idempotente por lotes (UPSERT)
            if len(lote_traducciones) >= BATCH_SIZE or idx == total_reglas:
                if lote_traducciones:
                    stmt = insert(ReglaTraduccion).values(lote_traducciones)
                    stmt = stmt.on_conflict_do_update(
                        index_elements=["regla_id", "formato"],
                        set_={
                            "query": stmt.excluded.query,
                            "flavor_label": stmt.excluded.flavor_label,
                            "target_table": stmt.excluded.target_table
                        }
                    )
                    db.execute(stmt)
                    db.commit()
                    lote_traducciones = []

            if idx % 100 == 0 or idx == total_reglas:
                print(f"[{idx}/{total_reglas}] Procesadas... (Splunk: {contador_splunk} | Elastic: {contador_elastic} | Defender: {contador_kql_defender} | Sentinel: {contador_kql_sentinel})")

        duracion = time.time() - t_inicio
        print("\n" + "="*70)
        print("RESUMEN DE PRECOMPUTACIÓN BATCH:")
        print("="*70)
        print(f"Total de reglas analizadas:            {total_reglas}")
        print(f"Traducciones Splunk (SPL) generadas:   {contador_splunk} / {total_reglas} ({(contador_splunk/total_reglas)*100:.1f}%)")
        print(f"Traducciones Elastic (ECS) generadas:  {contador_elastic} / {total_reglas} ({(contador_elastic/total_reglas)*100:.1f}%)")
        print(f"Traducciones KQL (Defender) generadas: {contador_kql_defender} / {total_reglas} ({(contador_kql_defender/total_reglas)*100:.1f}%)")
        print(f"Traducciones KQL (Sentinel) generadas: {contador_kql_sentinel} / {total_reglas} ({(contador_kql_sentinel/total_reglas)*100:.1f}%)")
        print(f"Tiempo total de ejecución:             {duracion:.2f} segundos ({(duracion/total_reglas)*1000:.1f} ms por regla)")
        print("="*70)

    finally:
        db.close()

if __name__ == "__main__":
    precomputar_todas_las_traducciones()
