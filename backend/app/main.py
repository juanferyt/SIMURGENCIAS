import os
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import (AttentionRecord, PatientRecord, ResourceConfiguration, SessionLocal,
                       SimulationRun, TelemetrySnapshot, engine, get_db)
from .services import capacity, run_simulation, serialize_run, stored_config
from .simulation.domain import SimulationConfig
from .simulation.theory import mmc


@asynccontextmanager
async def lifespan(app):
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    yield


app = FastAPI(title="SIMURGENCIAS · Entrega 1", version="1.0.0", lifespan=lifespan,
              description="Modelo académico con datos sintéticos. Gestión y DES independientes. No es una herramienta clínica.")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:8080").split(","),
                   allow_methods=["GET", "POST", "PATCH"], allow_headers=["Content-Type"])
DB = Annotated[Session, Depends(get_db)]


@app.middleware("http")
async def request_metrics(request, call_next):
    response = await call_next(request)
    with capacity.lock:
        capacity.requests_processed += 1
    return response


class PatientInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    code: str = Field(min_length=1, max_length=60, pattern=r"^[A-Za-z0-9_-]+$")
    triage_level: int = Field(ge=1, le=5)


Stage = Literal["registered", "triage", "waiting", "consultation", "observation", "discharged"]


class AttentionInput(BaseModel):
    patient_id: int = Field(gt=0)


class AttentionUpdate(BaseModel):
    stage: Stage


class ResourceInput(BaseModel):
    doctors: int = Field(ge=1, le=20)
    triage_staff: int = Field(ge=1, le=10)
    observation_beds: int = Field(ge=1, le=50)


class TheoryInput(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    arrival_per_hour: float = Field(gt=0, le=120)
    service_mean_minutes: float = Field(gt=0, le=480)
    servers: int = Field(ge=1, le=50)


@app.get("/api/health", tags=["Sistema"])
def health(db: DB):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": db.bind.dialect.name}


@app.get("/api/patients", tags=["Gestión"])
def patients(db: DB, limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
    return db.scalars(select(PatientRecord).order_by(PatientRecord.id).limit(limit).offset(offset)).all()


@app.post("/api/patients", status_code=201, tags=["Gestión"])
def create_patient(body: PatientInput, db: DB):
    record = PatientRecord(**body.model_dump(), synthetic=True)
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe un paciente con ese código")
    return record


@app.get("/api/attentions", tags=["Gestión"])
def attentions(db: DB, limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
    return db.scalars(select(AttentionRecord).order_by(AttentionRecord.id).limit(limit).offset(offset)).all()


@app.post("/api/attentions", status_code=201, tags=["Gestión"])
def create_attention(body: AttentionInput, db: DB):
    if not db.get(PatientRecord, body.patient_id):
        raise HTTPException(404, "Paciente no encontrado")
    record = AttentionRecord(patient_id=body.patient_id, stage="registered")
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "El paciente ya tiene una atención en esta demostración")
    return record


TRANSITIONS = {"registered": ["triage"], "triage": ["waiting"], "waiting": ["consultation"],
               "consultation": ["observation", "discharged"], "observation": ["discharged"], "discharged": []}


@app.patch("/api/attentions/{attention_id}", tags=["Gestión"])
def update_attention(attention_id: int, body: AttentionUpdate, db: DB):
    record = db.scalar(select(AttentionRecord).where(AttentionRecord.id == attention_id).with_for_update())
    if record is None:
        raise HTTPException(404, "Atención no encontrada")
    if body.stage not in TRANSITIONS[record.stage]:
        raise HTTPException(409, "Transición de etapa no válida")
    record.stage = body.stage
    db.commit()
    return record


@app.get("/api/resources", tags=["Gestión"])
def resources(db: DB):
    return db.scalars(select(ResourceConfiguration).order_by(ResourceConfiguration.id)).all()


@app.patch("/api/resources/{resource_id}", tags=["Gestión"])
def update_resources(resource_id: int, body: ResourceInput, db: DB):
    record = db.get(ResourceConfiguration, resource_id)
    if record is None:
        raise HTTPException(404, "Configuración no encontrada")
    for key, value in body.model_dump().items():
        setattr(record, key, value)
    db.commit()
    return record


@app.get("/api/telemetry", tags=["Telemetría"])
def telemetry(db: DB):
    counts = dict(db.execute(select(AttentionRecord.stage, func.count()).group_by(AttentionRecord.stage)).all())
    resource = db.get(ResourceConfiguration, 1)
    busy = counts.get("consultation", 0)
    management = {"active_patients": sum(v for k, v in counts.items() if k != "discharged"),
                  "queued_patients": counts.get("waiting", 0), "busy_doctors": busy,
                  "available_doctors": max(0, resource.doctors - busy) if resource else 0,
                  "source": "etapas registradas en gestión; no asignación física", "synthetic": True}
    from .database import utcnow
    snapshot = TelemetrySnapshot(source="management", metrics=management)
    db.add(snapshot)
    db.commit()
    recent = db.scalars(select(TelemetrySnapshot).where(TelemetrySnapshot.source == "simulation")
                        .order_by(TelemetrySnapshot.id.desc()).limit(10)).all()
    return {"timestamp": utcnow(), "management": management, "technical": capacity.snapshot(), "simulations": recent}


@app.post("/api/simulations/run", status_code=201, tags=["Simulación"])
def simulate(body: SimulationConfig, db: DB):
    with capacity.slot():
        return run_simulation(body, db)


@app.post("/api/simulations/compare", status_code=201, tags=["Simulación"])
def compare(body: SimulationConfig, db: DB):
    with capacity.slot():
        return {"scenarios": [run_simulation(body.model_copy(update={"doctors": n}), db) for n in range(1, 5)],
                "note": "Misma semilla y demandas individuales. Una réplica por escenario; sin recomendación clínica ni inferencia estadística."}


@app.get("/api/simulations", tags=["Simulación"])
def list_simulations(db: DB, limit: int = Query(20, ge=1, le=100)):
    runs = db.scalars(select(SimulationRun).order_by(SimulationRun.created_at.desc()).limit(limit)).all()
    return [{"id": r.id, "created_at": r.created_at, "config": stored_config(r.config), "metrics": r.result["metrics"]} for r in runs]


@app.get("/api/simulations/{simulation_id}", tags=["Simulación"])
def get_simulation(simulation_id: str, db: DB):
    run = db.get(SimulationRun, simulation_id)
    if run is None:
        raise HTTPException(404, "Simulación no encontrada")
    return serialize_run(run)


@app.post("/api/theory/mmc", tags=["Análisis"])
def theory(body: TheoryInput):
    return mmc(**body.model_dump())
