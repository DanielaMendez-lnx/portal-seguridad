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
