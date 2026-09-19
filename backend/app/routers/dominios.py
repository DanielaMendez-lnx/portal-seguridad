

from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Control, Dominio, Tecnica, TecnicaControl, Vulnerabilidad
from app.schemas import TendenciaMesOut

router = APIRouter(prefix="/dominios", tags=["Dominios & Métricas"])

class VulnerabilidadOut(BaseModel):
    id: str
    descripcion: str
    fecha_publicacion: str
    cvss_score: Optional[float] = None
    cvss_severity: Optional[str] = None

    class Config:
        from_attributes = True

class VulnerabilidadListOut(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[VulnerabilidadOut]

# 1. Endpoint de Vulnerabilidades (NVD)
@router.get("/{nombre}/vulnerabilidades", response_model=VulnerabilidadListOut)
def listar_vulnerabilidades_por_dominio(
    nombre: str,
    limit: Optional[int] = Query(default=40, ge=1, le=500, description="Cantidad máxima de registros a devolver (por defecto 40)"),
    offset: int = Query(default=0, ge=0, description="Número de registros a omitir para paginación"),
    db: Session = Depends(get_db)
):
    dom = db.query(Dominio).filter(Dominio.nombre.ilike(nombre)).first()
    if not dom:
        raise HTTPException(status_code=404, detail="Dominio no encontrado")

    base_query = (
        db.query(Vulnerabilidad)
        .join(Vulnerabilidad.dominios)
        .filter(Dominio.id == dom.id)
    )

    total = base_query.count()

    query = base_query.order_by(Vulnerabilidad.fecha_publicacion.desc())

    if offset > 0:
        query = query.offset(offset)
    if limit is not None and limit > 0:
        query = query.limit(limit)

    vulnerabilidades = query.all()

    return {
        "total": total,
        "limit": limit or total,
        "offset": offset,
        "items": [
            {
                "id": v.id,
                "descripcion": v.descripcion,
                "fecha_publicacion": str(v.fecha_publicacion),
                "cvss_score": v.cvss_score,
                "cvss_severity": v.cvss_severity,
            }
            for v in vulnerabilidades
        ],
    }

def calcular_meses_esperados(referencia: date, cant_meses: int) -> List[str]:
    """Genera lista cronológica de meses en formato YYYY-MM hacia atrás desde una fecha."""
    curr = date(referencia.year, referencia.month, 1)
    meses = []
    for _ in range(cant_meses):
        meses.append(curr.strftime("%Y-%m"))
        ultimo_dia_ant = curr - timedelta(days=1)
        curr = date(ultimo_dia_ant.year, ultimo_dia_ant.month, 1)
    meses.reverse()
    return meses

# 2. Endpoint de Tendencia de Vulnerabilidades por Mes
@router.get("/{nombre}/vulnerabilidades/tendencia", response_model=List[TendenciaMesOut])
def obtener_tendencia_vulnerabilidades(
    nombre: str,
    rango: str = Query(default="6m", pattern="^(6m|1y)$", description="Rango temporal: '6m' (últimos 6 meses) o '1y' (último año)"),
    db: Session = Depends(get_db)
):
    dom = db.query(Dominio).filter(Dominio.nombre.ilike(nombre)).first()
    if not dom:
        raise HTTPException(status_code=404, detail="Dominio no encontrado")

    cant_meses = 6 if rango == "6m" else 12
    meses_esperados = calcular_meses_esperados(date.today(), cant_meses)

    primer_mes_str = meses_esperados[0]
    y_ini, m_ini = map(int, primer_mes_str.split("-"))
    fecha_inicio = date(y_ini, m_ini, 1)

    mes_col = func.to_char(Vulnerabilidad.fecha_publicacion, "YYYY-MM")
    resultados = (
        db.query(
            mes_col.label("mes"),
            func.count(Vulnerabilidad.id).label("total")
        )
        .join(Vulnerabilidad.dominios)
        .filter(
            Dominio.id == dom.id,
            Vulnerabilidad.fecha_publicacion >= fecha_inicio
        )
        .group_by(mes_col)
        .all()
    )

    conteo_db = {r.mes: r.total for r in resultados}
    return [
        {"mes": m, "total": conteo_db.get(m, 0)}
        for m in meses_esperados
    ]

# 3. Endpoint de Técnicas (ATT&CK + NIST + Sigma)
@router.get("/{nombre}/tecnicas")
def listar_tecnicas_por_dominio(nombre: str, db: Session = Depends(get_db)):
    dom = (
        db.query(Dominio)
        .options(
            selectinload(Dominio.tecnicas)
            .selectinload(Tecnica.controles_asociados)
            .joinedload(TecnicaControl.control)
            .joinedload(Control.marco_normativo),
            selectinload(Dominio.tecnicas)
            .selectinload(Tecnica.controles_asociados)
            .joinedload(TecnicaControl.fuente),
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
                    "nombre": tc.control.nombre,
                    "marco": tc.control.marco_normativo.nombre if tc.control.marco_normativo else "NIST SP 800-53",
                    "tipo_confianza": tc.fuente.tipo_confianza if tc.fuente else "Propio",
                    "fuente_nombre": tc.fuente.nombre if tc.fuente else None,
                    "fuente_url": tc.fuente.url if tc.fuente else None,
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
