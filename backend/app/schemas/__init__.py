from pydantic import BaseModel
from typing import List, Optional

class ControlOut(BaseModel):
    codigo: str
    nombre: str
    marco: str

    class Config:
        from_attributes = True

class ReglaOut(BaseModel):
    id: int
    nombre: str
    formato: str
    log_source: Optional[str]

    class Config:
        from_attributes = True

class TecnicaDetalleOut(BaseModel):
    id: str
    nombre: str
    descripcion: Optional[str]
    tactica: str
    controles: List[ControlOut] = []
    reglas: List[ReglaOut] = []

    class Config:
        from_attributes = True