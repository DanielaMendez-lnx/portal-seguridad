

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload, joinedload
from pydantic import BaseModel
from app.database import get_db
from app.models import Dominio, Vulnerabilidad, Tecnica, TecnicaControl

router = APIRouter(prefix="/dominios", tags=["Dominios & Métricas"])

class VulnerabilidadOut(BaseModel):
    id: str
    descripcion: str
    fecha_publicacion: str
    cvss_score: Optional[float] = None
    cvss_severity: Optional[str] = None

    class Config:
        from_attributes = True

# 1. Endpoint de Vulnerabilidades (NVD)
@router.get("/{nombre}/vulnerabilidades", response_model=List[VulnerabilidadOut])
def listar_vulnerabilidades_por_dominio(nombre: str, db: Session = Depends(get_db)):
    dom = db.query(Dominio).filter(Dominio.nombre.ilike(nombre)).first()
    if not dom:
        raise HTTPException(status_code=404, detail="Dominio no encontrado")

    vulnerabilidades = (
        db.query(Vulnerabilidad)
        .join(Vulnerabilidad.dominios)
        .filter(Dominio.id == dom.id)
        .order_by(Vulnerabilidad.fecha_publicacion.desc())
        .all()
    )

    return [
        {
            "id": v.id,
            "descripcion": v.descripcion,
            "fecha_publicacion": str(v.fecha_publicacion),
            "cvss_score": v.cvss_score,
            "cvss_severity": v.cvss_severity,
        }
        for v in vulnerabilidades
    ]

# 2. Endpoint de Técnicas (ATT&CK + NIST + Sigma)
@router.get("/{nombre}/tecnicas")
def listar_tecnicas_por_dominio(nombre: str, db: Session = Depends(get_db)):
    dom = (
        db.query(Dominio)
        .options(
            selectinload(Dominio.tecnicas)
            .selectinload(Tecnica.controles_asociados)
            .joinedload(TecnicaControl.control),
            selectinload(Dominio.tecnicas)
            .selectinload(Tecnica.reglas),
        )
        .filter(Dominio.nombre.ilike(nombre))
        .first()
    )
    if not dom:
        raise HTTPException(status_code=404, detail="Dominio no encontrado")

    resultado = []
    for t in dom.tecnicas:
        resultado.append({
            "id": t.id,
            "nombre": t.nombre,
            "tactica": t.tactica,
            "descripcion": t.descripcion,
            "controles": [
                {
                    "codigo": tc.control.codigo,
                    "nombre": tc.control.nombre
                }
                for tc in t.controles_asociados if tc.control
            ],
            "reglas": [
                {
                    "id": r.id,
                    "nombre": r.nombre,
                    "formato": r.formato,
                    "log_source": r.log_source
                }
                for r in t.reglas
            ]
        })

    return resultado