"""Integration tests use isolated transactions on the configured PostgreSQL DB.

    Alembic must be applied first. Every test rolls back its own data; ORM commits
    are nested savepoints, so user/demo records are never removed by the tests.
"""
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.services import TechnicalCapacity


@pytest.fixture
def client():
    with engine.connect() as connection:
        transaction = connection.begin()
        session = Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
        app.dependency_overrides[get_db] = lambda: session
        try:
            with TestClient(app) as client:
                yield client
        finally:
            app.dependency_overrides.clear()
            session.close()
            transaction.rollback()


def test_management_and_persistence(client):
    assert client.get("/api/health").json()["database"] == "postgresql"
    payload = {"code": "TEST-" + uuid.uuid4().hex, "triage_level": 2}
    response = client.post("/api/patients", json=payload)
    assert response.status_code == 201
    patient = response.json()
    assert patient["synthetic"] is True
    assert client.post("/api/patients", json=payload).status_code == 409
    a = client.post("/api/attentions", json={"patient_id": patient["id"]})
    assert a.status_code == 201
    attention = a.json()
    assert client.patch(f'/api/attentions/{attention["id"]}', json={"stage": "discharged"}).status_code == 409
    for stage in ["triage", "waiting", "consultation", "observation", "discharged"]:
        assert client.patch(f'/api/attentions/{attention["id"]}', json={"stage": stage}).status_code == 200
    assert client.post("/api/attentions", json={"patient_id": patient["id"]}).status_code == 409
    assert client.get("/api/patients").status_code == 200
    assert client.get("/api/attentions").status_code == 200
    assert client.get("/api/resources").json()
    assert client.patch('/api/resources/1',json={"doctors":3,"triage_staff":2,"observation_beds":5}).status_code == 200
    assert client.get("/api/telemetry").json()["technical"]["internal_queue_capacity"] == 0


def test_simulation_history_comparison_and_separation(client):
    before = client.get("/api/patients").json()
    a = client.post("/api/simulations/run", json={"seed": 42})
    assert a.status_code == 201
    saved = a.json()
    replay = client.get('/api/simulations/' + saved['id'])
    assert replay.status_code == 200
    assert replay.json() == saved
    comparison = client.post("/api/simulations/compare", json={"seed": 42})
    assert comparison.status_code == 201
    scenarios = comparison.json()["scenarios"]
    assert [r["config"]["doctors"] for r in scenarios] == [1, 2, 3, 4]
    assert scenarios[1]["metrics"] == saved["metrics"]
    assert client.get("/api/patients").json() == before
    assert client.get("/api/simulations").status_code == 200
    assert client.get("/api/telemetry").json()["simulations"]


def test_validation_and_missing_records(client):
    assert client.post('/api/patients', json={"code":"", "triage_level":6}).status_code == 422
    assert client.post('/api/simulations/run', json={"doctors":0}).status_code == 422
    assert client.post('/api/attentions', json={"patient_id":2147483647}).status_code == 404
    assert client.get('/api/simulations/missing').status_code == 404
    response = client.post('/api/theory/mmc', json={"arrival_per_hour":4,"service_mean_minutes":15,"servers":1})
    assert response.status_code == 200
    assert response.json()["stable"] is False


def test_technical_capacity_admission_and_release():
    capacity = TechnicalCapacity(1)
    entered, release = Event(), Event()
    def hold():
        with capacity.slot():
            entered.set()
            assert release.wait(timeout=5)
    with ThreadPoolExecutor() as pool:
        future = pool.submit(hold)
        assert entered.wait(timeout=5)
        try:
            with pytest.raises(HTTPException) as exc:
                with capacity.slot():
                    pass
            assert exc.value.status_code == 429
        finally:
            release.set()
        future.result()
    assert capacity.snapshot()["active_simulations"] == 0
    assert capacity.snapshot()["rejected_simulations"] == 1
    with pytest.raises(ValueError):
        with capacity.slot():
            raise ValueError("intentional failure")
    with capacity.slot():
        assert capacity.snapshot()["active_simulations"] == 1
