from datetime import date

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.database import engine
from app.models import Fuente


def test_idempotencia_upsert_fuente():
    # Ejecuta dentro de una transacción aislada que siempre hace rollback al finalizar
    with engine.connect() as connection:
        trans = connection.begin()
        db = Session(bind=connection)
        try:
            nombre_test = "FUENTE_TEST_IDEMPOTENCIA"
            meta = {
                "nombre": nombre_test,
                "tipo_confianza": "Prueba",
                "url": "https://test.example.com",
                "fecha_ultima_actualizacion": date(2026, 1, 1)
            }

            # Primer UPSERT
            stmt1 = insert(Fuente).values(
                nombre=meta["nombre"],
                tipo_confianza=meta["tipo_confianza"],
                url=meta["url"],
                fecha_ultima_actualizacion=meta["fecha_ultima_actualizacion"]
            ).on_conflict_do_update(
                index_elements=["nombre"],
                set_={"tipo_confianza": "Prueba_Actualizada"}
            ).returning(Fuente.id)
            id_1 = db.execute(stmt1).scalar()
            assert id_1 is not None

            # Segundo UPSERT idéntico (debe actualizar y no insertar duplicado)
            stmt2 = insert(Fuente).values(
                nombre=meta["nombre"],
                tipo_confianza=meta["tipo_confianza"],
                url=meta["url"],
                fecha_ultima_actualizacion=meta["fecha_ultima_actualizacion"]
            ).on_conflict_do_update(
                index_elements=["nombre"],
                set_={"tipo_confianza": "Prueba_Actualizada"}
            ).returning(Fuente.id)
            id_2 = db.execute(stmt2).scalar()
            assert id_2 == id_1

            # Verificar que solo existe un único registro en la base de datos
            conteo = db.query(Fuente).filter(Fuente.nombre == nombre_test).count()
            assert conteo == 1

        finally:
            db.close()
            trans.rollback()  # Garantizar que la base de datos quede exactamente como estaba
