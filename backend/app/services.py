"""Application services; simulated patients never enter the management tables."""
import os
import threading
import time
import uuid
from contextlib import contextmanager

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .database import SimulationRun, TelemetrySnapshot
from .simulation.domain import SimulationConfig
from .simulation.engine import EmergencyDepartment


class TechnicalCapacity:
    """Admission control per process. No internal queue; rejects excess with 429."""
    def __init__(self, limit: int):
        if limit < 1:
            raise ValueError("MAX_CONCURRENT_SIMULATIONS debe ser positivo")
        self.limit = limit
        self.semaphore = threading.BoundedSemaphore(limit)
        self.lock = threading.Lock()
        self.active = self.completed = self.rejected = self.requests_processed = 0

    def snapshot(self):
        with self.lock:
            return dict(max_concurrent_simulations=self.limit, active_simulations=self.active,
                        completed_simulations=self.completed, rejected_simulations=self.rejected,
                        requests_processed=self.requests_processed, internal_queue_capacity=0,
                        scope="por proceso Uvicorn; capacidad técnica experimental, no capacidad hospitalaria")

    @contextmanager
    def slot(self):
        if not self.semaphore.acquire(blocking=False):
            with self.lock:
                self.rejected += 1
            raise HTTPException(429, "Capacidad técnica ocupada. Reintente después.", headers={"Retry-After": "2"})
        with self.lock:
            self.active += 1
        try:
            yield
        finally:
            with self.lock:
                self.active -= 1
            self.semaphore.release()


capacity = TechnicalCapacity(int(os.getenv("MAX_CONCURRENT_SIMULATIONS", "2")))


def run_simulation(config: SimulationConfig, db: Session):
    started = time.perf_counter()
    result = EmergencyDepartment(config).run().model_dump(mode="json")
    run = SimulationRun(id=str(uuid.uuid4()), config=config.model_dump(mode="json"),
                        result=result, elapsed_seconds=time.perf_counter() - started)
    db.add(run)
    db.flush()
    end = result["metrics"]["final_state"]
    db.add(TelemetrySnapshot(simulation_id=run.id, source="simulation", metrics={
        "active_patients": end["active"], "queued_patients": end["doctor_queue"] + end["triage_queue"] + end["observation_queue"],
        "busy_doctors": end["doctors_busy"], "available_doctors": end.get("doctors_available", config.doctors) - end["doctors_busy"],
        "duration_minutes": config.duration_minutes, "elapsed_seconds": run.elapsed_seconds,
        "technical": capacity.snapshot(), "main_metrics": result["metrics"], "synthetic": True}))
    db.commit()
    with capacity.lock:
        capacity.completed += 1
    return serialize_run(run)


def serialize_run(run):
    return {"id": run.id, "created_at": run.created_at, "elapsed_seconds": run.elapsed_seconds,
            **run.result, "config": stored_config(run.config)}


def stored_config(config):
    """Old persisted runs used seed/seed+1; expose that fact without rewriting them."""
    return {"rng_scheme": "legacy-v1", **config}
