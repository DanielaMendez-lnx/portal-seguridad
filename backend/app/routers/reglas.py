from typing import List

from fastapi import APIRouter, Depends, HTTPException, Path, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ReglaDeteccion, ReglaTraduccion
from app.schemas import ReglaTraduccionOut

router = APIRouter(prefix="/reglas", tags=["Reglas de Detección & Traducciones"])


@router.get("/{regla_id}/traducciones", response_model=List[ReglaTraduccionOut])
def obtener_traducciones_regla(
    request: Request,
    regla_id: int = Path(..., description="Identificador único de la regla de detección", ge=1),
    db: Session = Depends(get_db)
):
    """
    Retorna todas las traducciones precomputadas (Splunk SPL, Elastic Lucene/ECS, KQL Defender XDR / Sentinel)
    asociadas a la regla solicitada.

    - Si la regla no existe: retorna 404 (Regla no encontrada).
    - Si la regla existe pero no tiene traducciones: retorna 200 con un array vacío [].
    """
    regla = db.query(ReglaDeteccion).filter(ReglaDeteccion.id == regla_id).first()
    if not regla:
        raise HTTPException(status_code=404, detail="Regla no encontrada")

    traducciones = (
        db.query(ReglaTraduccion)
        .filter(ReglaTraduccion.regla_id == regla_id)
        .order_by(ReglaTraduccion.formato)
        .all()
    )

    return [
        ReglaTraduccionOut(
            formato=t.formato,
            query=t.query,
            flavor_label=t.flavor_label,
            target_table=t.target_table
        )
        for t in traducciones
    ]
