import os
import sys
import time

import requests
from sqlalchemy import text

# Permitir imports desde la carpeta backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal


def verificar_todas_las_urls():
    db = SessionLocal()
    try:
        reglas = db.execute(
            text("SELECT id, nombre, url_fuente FROM reglas_deteccion ORDER BY id")
        ).fetchall()

        print(f"[*] Iniciando verificación HEAD sobre {len(reglas)} reglas...")

        exitosas_200 = []
        rotas_404 = []
        otros_codigos = []

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }

        for idx, r in enumerate(reglas, 1):
            url = r.url_fuente
            if not url:
                rotas_404.append((r.id, r.nombre, "NULL", "Sin URL"))
                continue

            try:
                resp = requests.head(url, headers=headers, allow_redirects=True, timeout=10)
                status = resp.status_code

                if status == 200:
                    exitosas_200.append((r.id, r.nombre, url))
                elif status == 404:
                    rotas_404.append((r.id, r.nombre, url, 404))
                else:
                    otros_codigos.append((r.id, r.nombre, url, status))

                print(f"[{idx}/{len(reglas)}] id={r.id} -> HTTP {status}")
            except Exception as e:
                otros_codigos.append((r.id, r.nombre, url, f"Error: {e}"))
                print(f"[{idx}/{len(reglas)}] id={r.id} -> Error de conexión")

            # Rate limiting respetuoso con GitHub (7 peticiones por segundo máx)
            time.sleep(0.15)

        print("\n" + "="*60)
        print("RESUMEN DE VERIFICACIÓN:")
        print(f"Total analizadas: {len(reglas)}")
        print(f"HTTP 200 (Válidas y accesibles): {len(exitosas_200)}")
        print(f"HTTP 404 (Rotas): {len(rotas_404)}")
        print(f"Otros estados o errores: {len(otros_codigos)}")
        print("="*60 + "\n")

        if rotas_404:
            print("[!] REGLAS CON ENLACE ROTO (404):")
            for item in rotas_404:
                print(f"- ID {item[0]} | '{item[1]}'\n  URL: {item[2]}")
        else:
            print("[OK] ¡100% de las reglas tienen enlaces funcionales!")

    finally:
        db.close()

if __name__ == "__main__":
    verificar_todas_las_urls()
