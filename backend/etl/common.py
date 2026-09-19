import logging
from contextlib import contextmanager
from typing import Set

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Dominio, Fuente, MarcoNormativo, Tecnica
from etl.config_fuentes import CONFIG_FUENTES

logger = logging.getLogger("etl")

@contextmanager
def sesion_etl():
    """
    Context manager para pipelines ETL.
    Garantiza commit atómico en caso de éxito, rollback automático ante excepciones
    y liberación obligatoria de la conexión a Neon en el bloque finally.
    """
    db: Session = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[ETL Error Crítico]: {e}", exc_info=True)
        raise
    finally:
        db.close()

def asegurar_fuente(db: Session, clave_fuente: str) -> int:
    """Garantiza la existencia y actualización de la metadata de una fuente en Neon."""
    meta = CONFIG_FUENTES[clave_fuente]
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
    return db.execute(stmt).scalar()

def asegurar_dominio(db: Session, nombre: str = "DNS") -> int:
    """Garantiza la existencia del dominio de ciberseguridad (por defecto DNS)."""
    stmt = insert(Dominio).values(nombre=nombre).on_conflict_do_nothing().returning(Dominio.id)
    dom_id = db.execute(stmt).scalar()
    if not dom_id:
        dom_id = db.query(Dominio.id).filter(Dominio.nombre.ilike(nombre)).scalar()
    return dom_id

def asegurar_marco_normativo(db: Session, nombre: str = "NIST SP 800-53", version: str = "Rev. 5") -> int:
    """Garantiza la existencia de un marco normativo con restricción uq_marco_nombre_version."""
    stmt = insert(MarcoNormativo).values(
        nombre=nombre,
        version=version
    ).on_conflict_do_nothing(
        index_elements=["nombre", "version"]
    ).returning(MarcoNormativo.id)
    marco_id = db.execute(stmt).scalar()
    if not marco_id:
        marco_id = db.query(MarcoNormativo.id).filter(
            MarcoNormativo.nombre == nombre,
            MarcoNormativo.version == version
        ).scalar()
    return marco_id

def obtener_ids_tecnicas_locales(db: Session) -> Set[str]:
    """Retorna un conjunto con todos los IDs de técnicas registradas localmente en Neon."""
    return set(r[0] for r in db.query(Tecnica.id).all())
