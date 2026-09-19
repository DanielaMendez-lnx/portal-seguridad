from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Tecnica
from app.schemas import ControlOut, ReglaOut, TecnicaDetalleOut

router = APIRouter(prefix="/tecnicas", tags=["Técnicas de Detección"])

@router.get("/{tecnica_id}", response_model=TecnicaDetalleOut)
def obtener_tecnica(
    tecnica_id: str = Path(
        ...,
        pattern=r"^T\d{4}(\.\d{3})?$",
        description="Identificador oficial de técnica MITRE ATT&CK (ej. T1071 o T1071.004)"
    ),
    db: Session = Depends(get_db)
):
    tecnica = db.query(Tecnica).filter(Tecnica.id == tecnica_id).first()

    if not tecnica:
        raise HTTPException(status_code=404, detail="Técnica no encontrada")

    # Deduplicar controles por código
    controles_vistos = set()
    controles_dto = []
    for rel in tecnica.controles_asociados:
        if rel.control.codigo not in controles_vistos:
            controles_dto.append(
                ControlOut(
                    codigo=rel.control.codigo,
                    nombre=rel.control.nombre,
                    marco=rel.control.marco_normativo.nombre if rel.control.marco_normativo else "NIST SP 800-53",
                    tipo_confianza=rel.fuente.tipo_confianza if rel.fuente else "Propio",
                    fuente_nombre=rel.fuente.nombre if rel.fuente else None,
                    fuente_url=rel.fuente.url if rel.fuente else None,
                )
            )
            controles_vistos.add(rel.control.codigo)

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
