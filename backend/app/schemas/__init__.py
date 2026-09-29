from typing import List, Optional

from pydantic import BaseModel


class ControlOut(BaseModel):
    codigo: str
    nombre: str
    marco: Optional[str] = None
    tipo_confianza: str
    fuente_nombre: Optional[str] = None
    fuente_url: Optional[str] = None

    class Config:
        from_attributes = True

class ReglaOut(BaseModel):
    id: int
    nombre: str
    formato: str
    log_source: Optional[str] = None
    url_fuente: Optional[str] = None

    class Config:
        from_attributes = True

class TecnicaDetalleOut(BaseModel):
    id: str
    nombre: str
    descripcion: Optional[str]
    tactica: str
    protocolo: Optional[str] = None
    controles: List[ControlOut] = []
    reglas: List[ReglaOut] = []

    class Config:
        from_attributes = True

class TendenciaMesOut(BaseModel):
    mes: str
    total: int

    class Config:
        from_attributes = True


class TecnicaCoberturaItem(BaseModel):
    tecnica_id: str
    tecnica_nombre: str
    total_reglas: int
    tiene_controles: bool


class CoberturaResumen(BaseModel):
    total_tecnicas: int
    tecnicas_con_controles: int
    tecnicas_sin_controles: int
    porcentaje_con_controles: float
    total_reglas_unicas: int


class DominioCoberturaOut(BaseModel):
    dominio_id: int
    dominio_nombre: str
    dominio_slug: Optional[str] = None
    resumen: CoberturaResumen
    tecnicas: List[TecnicaCoberturaItem]

