import os
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://simurgencias:simurgencias_demo@localhost:55440/simurgencias")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def utcnow():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class PatientRecord(Base):
    __tablename__ = "patients"
    __table_args__ = (CheckConstraint("triage_level BETWEEN 1 AND 5"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(60), unique=True)
    triage_level: Mapped[int] = mapped_column(Integer)
    synthetic: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AttentionRecord(Base):
    __tablename__ = "attentions"
    __table_args__ = (CheckConstraint("stage IN ('registered','triage','waiting','consultation','observation','discharged')"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), unique=True)
    stage: Mapped[str] = mapped_column(String(30), default="registered")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class ResourceConfiguration(Base):
    __tablename__ = "resource_configurations"
    __table_args__ = (CheckConstraint("doctors > 0 AND triage_staff > 0 AND observation_beds > 0"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    doctors: Mapped[int] = mapped_column(Integer)
    triage_staff: Mapped[int] = mapped_column(Integer)
    observation_beds: Mapped[int] = mapped_column(Integer)
    synthetic: Mapped[bool] = mapped_column(Boolean, default=True)


class SimulationRun(Base):
    __tablename__ = "simulation_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    config: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict] = mapped_column(JSON)
    elapsed_seconds: Mapped[float]
    synthetic: Mapped[bool] = mapped_column(Boolean, default=True)


class TelemetrySnapshot(Base):
    __tablename__ = "telemetry"
    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    simulation_id: Mapped[str | None] = mapped_column(ForeignKey("simulation_runs.id"), nullable=True)
    source: Mapped[str] = mapped_column(String(30))
    metrics: Mapped[dict] = mapped_column(JSON)


def get_db():
    with SessionLocal() as session:
        yield session
