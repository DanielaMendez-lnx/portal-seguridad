from app.database import SessionLocal
from sqlalchemy import text

def ejecutar_limpieza():
    db = SessionLocal()
    try:
        print("[*] Iniciando limpieza y unificación en Neon...")

        # 1. Re-apuntar relación de T1568.001 con control 2 hacia control canónico 1
        db.execute(text("""
            UPDATE tecnica_control 
            SET control_id = 1 
            WHERE tecnica_id = 'T1568.001' AND control_id = 2;
        """))

        # 2. Borrar las 11 filas duplicadas de tecnica_control
        db.execute(text("""
            DELETE FROM tecnica_control 
            WHERE control_id IN (2, 12, 13, 14, 15, 16);
        """))

        # 3. Borrar los 6 controles duplicados sobrantes
        db.execute(text("""
            DELETE FROM controles 
            WHERE id IN (2, 12, 13, 14, 15, 16);
        """))

        # 4. Reasignar los controles canónicos 3, 4, 5, 6 al marco canónico 1
        db.execute(text("""
            UPDATE controles 
            SET marco_id = 1 
            WHERE id IN (3, 4, 5, 6);
        """))

        # 5. Borrar los marcos normativos duplicados (2, 3, 4, 5)
        db.execute(text("""
            DELETE FROM marcos_normativos 
            WHERE id IN (2, 3, 4, 5);
        """))

        db.commit()
        print("[OK] Limpieza completada con exito.")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error durante la limpieza: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    ejecutar_limpieza()
