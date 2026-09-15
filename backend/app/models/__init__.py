from sqlalchemy import (
    Column, Integer, String, Text, Date, 
    ForeignKey, Table, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base

# ==========================================
# 1. TABLAS INTERMEDIAS (Muchos a Muchos puros)
# ==========================================

# Relación Técnica <-> Dominio
tecnica_dominio = Table(
    "tecnica_dominio",
    Base.metadata,
    Column("tecnica_id", String(20), ForeignKey("tecnicas.id", ondelete="CASCADE"), primary_key=True),
    Column("dominio_id", Integer, ForeignKey("dominios.id", ondelete="CASCADE"), primary_key=True)
)

# Relación Técnica <-> Regla de Detección
tecnica_regla = Table(
    "tecnica_regla",
    Base.metadata,
    Column("tecnica_id", String(20), ForeignKey("tecnicas.id", ondelete="CASCADE"), primary_key=True),
    Column("regla_id", Integer, ForeignKey("reglas_deteccion.id", ondelete="CASCADE"), primary_key=True)
)

# Relación Técnica <-> Reporte de Amenaza
tecnica_reporte = Table(
    "tecnica_reporte",
    Base.metadata,
    Column("tecnica_id", String(20), ForeignKey("tecnicas.id", ondelete="CASCADE"), primary_key=True),
    Column("reporte_id", Integer, ForeignKey("reportes_amenaza.id", ondelete="CASCADE"), primary_key=True)
)


# ==========================================
# 2. ENTIDADES PRINCIPALES
# ==========================================

class Dominio(Base):
    __tablename__ = "dominios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), unique=True, nullable=False)  # ej. DNS, Cloud, Autenticacion

    # Relación inversa
    tecnicas = relationship("Tecnica", secondary=tecnica_dominio, back_populates="dominios")


class MarcoNormativo(Base):
    __tablename__ = "marcos_normativos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)  # ej. NIST SP 800-53
    version = Column(String(20), nullable=True)   # ej. Rev. 5

    controles = relationship("Control", back_populates="marco_normativo")


class Fuente(Base):
    __tablename__ = "fuentes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), unique=True, nullable=False) # ej. CTID, SigmaHQ, CISA
    tipo_confianza = Column(String(30), nullable=False)       # Oficial, Comunidad, Propio
    url = Column(Text, nullable=True)
    fecha_ultima_actualizacion = Column(Date, nullable=True)

    reglas = relationship("ReglaDeteccion", back_populates="fuente")
    reportes = relationship("ReporteAmenaza", back_populates="fuente")
    mapeos_controles = relationship("TecnicaControl", back_populates="fuente")


class Tecnica(Base):
    __tablename__ = "tecnicas"

    id = Column(String(20), primary_key=True)     # ej. T1071.004
    nombre = Column(String(150), nullable=False)  # ej. DNS
    descripcion = Column(Text, nullable=True)
    tactica = Column(String(50), nullable=False)  # ej. Command and Control

    # Relaciones Muchos a Muchos
    dominios = relationship("Dominio", secondary=tecnica_dominio, back_populates="tecnicas")
    reglas = relationship("ReglaDeteccion", secondary=tecnica_regla, back_populates="tecnicas")
    reportes = relationship("ReporteAmenaza", secondary=tecnica_reporte, back_populates="tecnicas")
    
    # Relación con Controles a través de la tabla intermedia con metadatos
    controles_asociados = relationship("TecnicaControl", back_populates="tecnica")


class Control(Base):
    __tablename__ = "controles"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(30), nullable=False)   # ej. AC-17, SC-20
    nombre = Column(String(200), nullable=False)
    marco_id = Column(Integer, ForeignKey("marcos_normativos.id", ondelete="RESTRICT"), nullable=False)

    # Restricción: no puede repetirse el mismo código dentro del mismo marco
    __table_args__ = (UniqueConstraint("codigo", "marco_id", name="uq_control_marco"),)

    marco_normativo = relationship("MarcoNormativo", back_populates="controles")
    tecnicas_asociadas = relationship("TecnicaControl", back_populates="control")


# ==========================================
# 3. TABLA ASOCIATIVA CON ATRIBUTO FUENTE
# ==========================================

class TecnicaControl(Base):
    """
    Tabla intermedia entre Técnica y Control que registra 
    la fuente oficial que valida el mapeo de mitigación.
    """
    __tablename__ = "tecnica_control"

    tecnica_id = Column(String(20), ForeignKey("tecnicas.id", ondelete="CASCADE"), primary_key=True)
    control_id = Column(Integer, ForeignKey("controles.id", ondelete="CASCADE"), primary_key=True)
    fuente_id = Column(Integer, ForeignKey("fuentes.id", ondelete="RESTRICT"), nullable=False)

    tecnica = relationship("Tecnica", back_populates="controles_asociados")
    control = relationship("Control", back_populates="tecnicas_asociadas")
    fuente = relationship("Fuente", back_populates="mapeos_controles")


# ==========================================
# 4. REGLAS Y REPORTES
# ==========================================

class ReglaDeteccion(Base):
    __tablename__ = "reglas_deteccion"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False)
    formato = Column(String(30), nullable=False)  # Sigma, KQL, SPL
    log_source = Column(String(100), nullable=True)
    fuente_id = Column(Integer, ForeignKey("fuentes.id", ondelete="RESTRICT"), nullable=False)

    fuente = relationship("Fuente", back_populates="reglas")
    tecnicas = relationship("Tecnica", secondary=tecnica_regla, back_populates="reglas")


class ReporteAmenaza(Base):
    __tablename__ = "reportes_amenaza"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(250), nullable=False)
    fecha_publicacion = Column(Date, nullable=False)
    contador_incidencias = Column(Integer, default=1)
    fuente_id = Column(Integer, ForeignKey("fuentes.id", ondelete="RESTRICT"), nullable=False)

    fuente = relationship("Fuente", back_populates="reportes")
    tecnicas = relationship("Tecnica", secondary=tecnica_reporte, back_populates="reportes")
    