from sqlalchemy import (
    Column, Integer, String, Text, Date, Float,
    ForeignKey, Table, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base

# ==========================================
# 1. TABLAS INTERMEDIAS
# ==========================================

tecnica_dominio = Table(
    "tecnica_dominio",
    Base.metadata,
    Column("tecnica_id", String(20), ForeignKey("tecnicas.id", ondelete="CASCADE"), primary_key=True),
    Column("dominio_id", Integer, ForeignKey("dominios.id", ondelete="CASCADE"), primary_key=True)
)

tecnica_regla = Table(
    "tecnica_regla",
    Base.metadata,
    Column("tecnica_id", String(20), ForeignKey("tecnicas.id", ondelete="CASCADE"), primary_key=True),
    Column("regla_id", Integer, ForeignKey("reglas_deteccion.id", ondelete="CASCADE"), primary_key=True)
)

tecnica_reporte = Table(
    "tecnica_reporte",
    Base.metadata,
    Column("tecnica_id", String(20), ForeignKey("tecnicas.id", ondelete="CASCADE"), primary_key=True),
    Column("reporte_id", Integer, ForeignKey("reportes_amenaza.id", ondelete="CASCADE"), primary_key=True)
)

vulnerabilidad_dominio = Table(
    "vulnerabilidad_dominio",
    Base.metadata,
    Column("vulnerabilidad_id", String(50), ForeignKey("vulnerabilidades.id", ondelete="CASCADE"), primary_key=True),
    Column("dominio_id", Integer, ForeignKey("dominios.id", ondelete="CASCADE"), primary_key=True)
)

# ==========================================
# 2. ENTIDADES PRINCIPALES
# ==========================================

class Dominio(Base):
    __tablename__ = "dominios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), unique=True, nullable=False)

    tecnicas = relationship("Tecnica", secondary=tecnica_dominio, back_populates="dominios")
    vulnerabilidades = relationship("Vulnerabilidad", secondary=vulnerabilidad_dominio, back_populates="dominios")


class MarcoNormativo(Base):
    __tablename__ = "marcos_normativos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    version = Column(String(20), nullable=True)

    controles = relationship("Control", back_populates="marco_normativo")


class Fuente(Base):
    __tablename__ = "fuentes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), unique=True, nullable=False)
    tipo_confianza = Column(String(30), nullable=False)
    url = Column(Text, nullable=True)
    fecha_ultima_actualizacion = Column(Date, nullable=True)

    reglas = relationship("ReglaDeteccion", back_populates="fuente")
    reportes = relationship("ReporteAmenaza", back_populates="fuente")
    mapeos_controles = relationship("TecnicaControl", back_populates="fuente")
    vulnerabilidades = relationship("Vulnerabilidad", back_populates="fuente")


class Tecnica(Base):
    __tablename__ = "tecnicas"

    id = Column(String(20), primary_key=True)
    nombre = Column(String(150), nullable=False)
    descripcion = Column(Text, nullable=True)
    tactica = Column(String(50), nullable=False)

    dominios = relationship("Dominio", secondary=tecnica_dominio, back_populates="tecnicas")
    reglas = relationship("ReglaDeteccion", secondary=tecnica_regla, back_populates="tecnicas")
    reportes = relationship("ReporteAmenaza", secondary=tecnica_reporte, back_populates="tecnicas")
    controles_asociados = relationship("TecnicaControl", back_populates="tecnica")


class Control(Base):
    __tablename__ = "controles"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(30), nullable=False)
    nombre = Column(String(200), nullable=False)
    marco_id = Column(Integer, ForeignKey("marcos_normativos.id", ondelete="RESTRICT"), nullable=False)

    __table_args__ = (UniqueConstraint("codigo", "marco_id", name="uq_control_marco"),)

    marco_normativo = relationship("MarcoNormativo", back_populates="controles")
    tecnicas_asociadas = relationship("TecnicaControl", back_populates="control")


class TecnicaControl(Base):
    __tablename__ = "tecnica_control"

    tecnica_id = Column(String(20), ForeignKey("tecnicas.id", ondelete="CASCADE"), primary_key=True)
    control_id = Column(Integer, ForeignKey("controles.id", ondelete="CASCADE"), primary_key=True)
    fuente_id = Column(Integer, ForeignKey("fuentes.id", ondelete="RESTRICT"), nullable=False)

    tecnica = relationship("Tecnica", back_populates="controles_asociados")
    control = relationship("Control", back_populates="tecnicas_asociadas")
    fuente = relationship("Fuente", back_populates="mapeos_controles")


class ReglaDeteccion(Base):
    __tablename__ = "reglas_deteccion"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False)
    formato = Column(String(30), nullable=False)
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


class Vulnerabilidad(Base):
    __tablename__ = "vulnerabilidades"

    id = Column(String(50), primary_key=True)
    descripcion = Column(Text, nullable=False)
    fecha_publicacion = Column(Date, nullable=False)
    cvss_score = Column(Float, nullable=True)
    cvss_severity = Column(String(20), nullable=True)

    fuente_id = Column(Integer, ForeignKey("fuentes.id", ondelete="RESTRICT"), nullable=False)

    fuente = relationship("Fuente", back_populates="vulnerabilidades")
    # Corrige aquí: debe apuntar al atributo 'vulnerabilidades' de Dominio
    dominios = relationship("Dominio", secondary=vulnerabilidad_dominio, back_populates="vulnerabilidades")