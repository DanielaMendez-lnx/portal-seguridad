from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Tecnica
from app.schemas import TecnicaDetalleOut, ControlOut, ReglaOut

router = APIRouter(prefix="/tecnicas", tags=["Técnicas de Detección"])

@router.get("/{tecnica_id}", response_model=TecnicaDetalleOut)
def obtener_tecnica(tecnica_id: str, db: Session = Depends(get_db)):
    tecnica = db.query(Tecnica).filter(Tecnica.id == tecnica_id).first()
    
    if not tecnica:
        raise HTTPException(status_code=404, detail="Técnica no encontrada")

    # Mapeo manual limpio hacia el esquema Pydantic
    controles_dto = [
        ControlOut(
            codigo=rel.control.codigo,
            nombre=rel.control.nombre,
            marco=rel.control.marco_normativo.nombre
        )
        for rel in tecnica.controles_asociados
    ]

    reglas_dto = [
        ReglaOut(
            id=r.id,
            nombre=r.nombre,
            formato=r.formato,
            log_source=r.log_source
        )
        for r in tecnica.reglas
    ]

    return TecnicaDetalleOut(
        id=tecnica.id,
        nombre=tecnica.nombre,
        descripcion=tecnica.descripcion,
        tactica=tecnica.tactica,
        controles=controles_dto,
        reglas=reglas_dto
    )