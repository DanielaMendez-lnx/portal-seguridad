

from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Control, Dominio, Tecnica, TecnicaControl, Vulnerabilidad
from app.schemas import (
    CoberturaResumen,
    DominioCoberturaOut,
    TecnicaCoberturaItem,
    TendenciaMesOut,
)

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

def resolver_dominio(db: Session, identificador: str) -> Optional[Dominio]:
    """Busca el dominio por slug, por nombre o por alias retrocompatible (ej. 'DNS', 'Endpoint')."""
    identificador_limpio = identificador.strip()
    dom = db.query(Dominio).filter(
        (Dominio.slug.ilike(identificador_limpio)) |
        (Dominio.nombre.ilike(identificador_limpio))
    ).first()

    if not dom and identificador_limpio.lower() in (
        "dns", "network", "network-infrastructure", "network-infrastructure-protocols"
    ):
        dom = db.query(Dominio).filter(
            (Dominio.nombre.ilike("Network Infrastructure & Protocols")) |
            (Dominio.slug.ilike("network-infrastructure-protocols")) |
            (Dominio.nombre.ilike("DNS"))
        ).first()

    if not dom and identificador_limpio.lower() in (
        "endpoint", "endpoint-security", "host", "host-security", "endpoint-host-security"
    ):
        dom = db.query(Dominio).filter(
            (Dominio.nombre.ilike("Endpoint & Host Security")) |
            (Dominio.slug.ilike("endpoint-host-security"))
        ).first()

    return dom

# 1. Endpoint de Vulnerabilidades (NVD)
@router.get("/{nombre}/vulnerabilidades", response_model=VulnerabilidadListOut)
def listar_vulnerabilidades_por_dominio(
    nombre: str,
    limit: Optional[int] = Query(default=40, ge=1, le=500, description="Cantidad máxima de registros a devolver (por defecto 40)"),
    offset: int = Query(default=0, ge=0, description="Número de registros a omitir para paginación"),
    db: Session = Depends(get_db)
):
    dom = resolver_dominio(db, nombre)
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
    dom = resolver_dominio(db, nombre)
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
    dom_ref = resolver_dominio(db, nombre)
    if not dom_ref:
        raise HTTPException(status_code=404, detail="Dominio no encontrado")

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
        .filter(Dominio.id == dom_ref.id)
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
            "protocolo": t.protocolo or "GENERAL",
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
                    "log_source": r.log_source,
                    "url_fuente": r.url_fuente,
                }
                for r in t.reglas
            ]
        })

    return resultado


# 4. Endpoint de Cobertura y Métricas de Detección del Dominio
@router.get("/{nombre}/cobertura", response_model=DominioCoberturaOut)
def obtener_cobertura_dominio(nombre: str, db: Session = Depends(get_db)):
    dom = resolver_dominio(db, nombre)
    if not dom:
        raise HTTPException(status_code=404, detail="Dominio no encontrado")

    # Consulta pre-agregada por técnica para evitar producto cartesiano
    sql_tecnicas = text("""
        WITH reglas_agg AS (
            SELECT tr.tecnica_id, COUNT(tr.regla_id) AS total_reglas
            FROM tecnica_regla tr
            JOIN tecnica_dominio td ON tr.tecnica_id = td.tecnica_id
            WHERE td.dominio_id = :dom_id
            GROUP BY tr.tecnica_id
        ),
        controles_agg AS (
            SELECT tc.tecnica_id, COUNT(tc.control_id) AS total_controles
            FROM tecnica_control tc
            JOIN tecnica_dominio td ON tc.tecnica_id = td.tecnica_id
            WHERE td.dominio_id = :dom_id
            GROUP BY tc.tecnica_id
        )
        SELECT
            t.id AS tecnica_id,
            t.nombre AS tecnica_nombre,
            COALESCE(ra.total_reglas, 0) AS total_reglas,
            CASE WHEN COALESCE(ca.total_controles, 0) > 0 THEN true ELSE false END AS tiene_controles
        FROM tecnicas t
        JOIN tecnica_dominio td ON t.id = td.tecnica_id
        LEFT JOIN reglas_agg ra ON t.id = ra.tecnica_id
        LEFT JOIN controles_agg ca ON t.id = ca.tecnica_id
        WHERE td.dominio_id = :dom_id
        ORDER BY total_reglas DESC, t.nombre ASC
    """)
    rows = db.execute(sql_tecnicas, {"dom_id": dom.id}).fetchall()

    # Consulta directa de reglas únicas en el dominio
    sql_reglas_unicas = text("""
        SELECT COUNT(DISTINCT tr.regla_id)
        FROM tecnica_regla tr
        JOIN tecnica_dominio td ON tr.tecnica_id = td.tecnica_id
        WHERE td.dominio_id = :dom_id
    """)
    total_reglas_unicas = db.execute(sql_reglas_unicas, {"dom_id": dom.id}).scalar() or 0

    tecnicas_items = [
        TecnicaCoberturaItem(
            tecnica_id=r[0],
            tecnica_nombre=r[1],
            total_reglas=int(r[2]),
            tiene_controles=bool(r[3]),
        )
        for r in rows
    ]

    total_tecnicas = len(tecnicas_items)
    con_controles = sum(1 for t in tecnicas_items if t.tiene_controles)
    sin_controles = total_tecnicas - con_controles
    porcentaje = round((con_controles / total_tecnicas * 100), 1) if total_tecnicas > 0 else 0.0

    return DominioCoberturaOut(
        dominio_id=dom.id,
        dominio_nombre=dom.nombre,
        dominio_slug=dom.slug,
        resumen=CoberturaResumen(
            total_tecnicas=total_tecnicas,
            tecnicas_con_controles=con_controles,
            tecnicas_sin_controles=sin_controles,
            porcentaje_con_controles=porcentaje,
            total_reglas_unicas=int(total_reglas_unicas),
        ),
        tecnicas=tecnicas_items,
    )

