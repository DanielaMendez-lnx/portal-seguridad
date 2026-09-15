from sqlalchemy import text
from app.database import engine

def test():
    try:
        with engine.connect() as conn:
            res = conn.execute(text("SELECT version();")).fetchone()
            print("\n==========================================")
            print(" ¡Conexión exitosa a PostgreSQL en Neon!")
            print(f"Versión: {res[0]}")
            print("==========================================\n")
    except Exception as e:
        print("\nError al conectar con la base de datos:")
        print(e)

if __name__ == "__main__":
    test()
    