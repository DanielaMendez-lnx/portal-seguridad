

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List
from datetime import date
from typing import Optional

from app.database import get_db
from app.models import Dominio, Tecnica, Control, ReglaDeteccion, ReporteAmenaza, tecnica_dominio

router = APIRouter(prefix="/dominios", tags=["Dominios & Métricas"])

class SerieReporteOut(BaseModel):
    fecha: str
    incidencias: int

class DominioMetricasOut(BaseModel):
    dominio: str
    total_tecnicas: int
    total_controles_mitigacion: int
    total_reglas_deteccion: int
    historial_amenazas: List[SerieReporteOut] = []

@router.get("/{nombre}/metricas", response_model=DominioMetricasOut)
def obtener_metricas_dominio(nombre: str, db: Session = Depends(get_db)):
    dom = db.query(Dominio).filter(Dominio.nombre.ilike(nombre)).first()
    if not dom:
        raise HTTPException(status_code=404, detail="Dominio no encontrado")

    # 1. Total de técnicas asociadas
    total_tecnicas = len(dom.tecnicas)

    # 2. Total de controles normativos únicos vinculados a esas técnicas
    ids_tecnicas = [t.id for t in dom.tecnicas]
    
    controles_unicos = set()
    for t in dom.tecnicas:
        for rel in t.controles_asociados:
            controles_unicos.add(rel.control_id)

    # 3. Total de reglas de detección únicas
    reglas_unicas = set()
    for t in dom.tecnicas:
        for r in t.reglas:
            reglas_unicas.add(r.id)

    # 4. Tendencia de reportes para los gráficos
    reportes = (
        db.query(ReporteAmenaza)
        .join(ReporteAmenaza.tecnicas)
        .filter(Tecnica.id.in_(ids_tecnicas))
        .order_by(ReporteAmenaza.fecha_publicacion.asc())
        .all()
    )

    serie = [
        SerieReporteOut(
            fecha=rep.fecha_publicacion.strftime("%b %Y"),
            incidencias=rep.contador_incidencias
        )
        for rep in reportes
    ]

    return DominioMetricasOut(
        dominio=dom.nombre,
        total_tecnicas=total_tecnicas,
        total_controles_mitigacion=len(controles_unicos),
        total_reglas_deteccion=len(reglas_unicas),
        historial_amenazas=serie
    )

    from datetime import date
from typing import Optional

class VulnerabilidadOut(BaseModel):
    id: str
    descripcion: str
    fecha_publicacion: date
    cvss_score: Optional[float] = None
    cvss_severity: Optional[str] = None

    class Config:
        from_attributes = True

@router.get("/{nombre}/vulnerabilidades", response_model=List[VulnerabilidadOut])
def listar_vulnerabilidades_por_dominio(nombre: str, db: Session = Depends(get_db)):
    dom = db.query(Dominio).filter(Dominio.nombre.ilike(nombre)).first()
    if not dom:
        raise HTTPException(status_code=404, detail="Dominio no encontrado")

    return dom.vulnerabilidades