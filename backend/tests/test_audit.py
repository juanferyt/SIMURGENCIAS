"""Independent KPI reconstructions and deterministic admission/priority evidence."""
from concurrent.futures import ThreadPoolExecutor
from threading import Event, Lock
import random

import pytest
from fastapi.testclient import TestClient

from app.main import app
import app.main as routes
from app.database import get_db
from app.services import TechnicalCapacity
from app.services import stored_config
from app.simulation.domain import Patient, SimulationConfig
from app.simulation.engine import EmergencyDepartment
from app.simulation.randomness import stream_seed
from app.simulation.reference import run_mmc_reference
from app.simulation.statistics import percentile
from app.simulation.theory import mmc


def test_priority_arrives_after_service_started_and_cannot_interrupt():
    ed = EmergencyDepartment(SimulationConfig(doctors=1, triage_staff=1))
    patients = [Patient(1, 0, 3, .5, 10, 1, False),
                Patient(2, 1, 5, .5, 1, 1, False),
                Patient(3, 2, 1, .5, 1, 1, False)]
    def introduce(p):
        yield ed.env.timeout(p.arrival)
        yield ed.env.process(ed.patient_process(p))
    for p in patients:
        ed.env.process(introduce(p))
    ed.env.run()
    assert [(p.consultation_start, p.consultation_end) for p in patients] == [(0.5, 10.5), (11.5, 12.5), (10.5, 11.5)]
    assert ed.max_doctor_queue == 2


def test_kpis_reconstructed_from_individual_records():
    r = EmergencyDepartment(SimulationConfig()).run()
    h = r.config.duration_minutes
    starts = [p for p in r.patients if p['consultation_start'] is not None]
    waits = sorted(p['consultation_start'] - p['triage_end'] for p in starts)
    def independent_percentile(prob):
        index = (len(waits) - 1) * prob
        i = int(index)
        return waits[i] + (index - i) * (waits[min(i + 1, len(waits) - 1)] - waits[i])
    for prob, key in [(0.5,'p50_wait_minutes'),(.95,'p95_wait_minutes'),(.99,'p99_wait_minutes')]:
        assert r.metrics[key] == pytest.approx(independent_percentile(prob))
    assert r.metrics['mean_wait_minutes'] == pytest.approx(sum(waits) / len(waits))
    departed = [p for p in r.patients if p['departure'] is not None]
    assert r.metrics['mean_system_minutes'] == pytest.approx(sum(p['departure']-p['arrival'] for p in departed)/len(departed))
    assert r.metrics['throughput_per_hour'] == pytest.approx(len(departed) / (h / 60))
    assert r.metrics['probability_wait'] == pytest.approx(sum(w>1e-9 for w in waits)/len(waits))
    queue_area = sum((p['consultation_start'] if p['consultation_start'] is not None else h) - p['triage_end'] for p in r.patients if p['triage_end'] is not None)
    assert r.metrics['mean_queue_length'] == pytest.approx(queue_area/h)
    service_area = sum(min(p['consultation_end'] or h, h) - p['consultation_start'] for p in starts)
    assert r.metrics['doctor_utilization'] == pytest.approx(service_area/(h*r.config.doctors))
    q = r.little['queue']
    assert q['difference'] == pytest.approx(q['censored_contribution'], abs=1e-9)


def test_percentile_small_samples_and_no_observations():
    assert percentile([], .95) is None
    assert percentile([10], .95) == 10
    assert percentile([0, 10, 20, 30, 40], .95) == 38
    assert percentile([0, 10], .5) == 5


def test_rng_streams_do_not_reuse_adjacent_replication_sequences():
    keys = [stream_seed(seed, role) for seed in range(42,72) for role in ('arrivals','patients')]
    assert len(set(keys)) == 60
    # Demonstrates the old issue and explicit backwards-compatible replay.
    old = EmergencyDepartment(SimulationConfig(seed=42, rng_scheme='legacy-v1'))
    next_replica = EmergencyDepartment(SimulationConfig(seed=43, rng_scheme='legacy-v1'))
    assert old.patient_rng.getstate() == next_replica.arrival_rng.getstate()
    assert old.run().metrics['treated'] == 122
    assert random.Random(stream_seed(42,'arrivals')).getstate() != random.Random(stream_seed(43,'patients')).getstate()


def test_historical_runs_keep_their_random_stream_scheme():
    original = {'seed':42, 'doctors':2}
    assert stored_config(original)['rng_scheme']=='legacy-v1'
    assert 'rng_scheme' not in original
    assert stored_config({'seed':42,'rng_scheme':'sha256-v1'})['rng_scheme']=='sha256-v1'


def test_observation_consumes_beds_and_precedes_discharge():
    r = EmergencyDepartment(SimulationConfig(observation_probability=1, observation_beds=1,
        observation_mean_minutes=120, doctors=4)).run()
    assert r.metrics['bed_utilization'] > 0
    assert r.metrics['mean_observation_queue_length'] > 0
    for p in r.patients:
        if p['departure'] is not None:
            assert p['consultation_end'] <= p['observation_start'] < p['departure']


def test_mmc_normalization_instability_and_reference_boundaries():
    for c in (1,2):
        r = mmc(9,18,c)
        assert not r['stable'] and all(r[k] is None for k in ('P0','Pq','Wq','W','L','Lq'))
    r = mmc(9,18,3)
    assert r['rho'] == pytest.approx(.9)
    assert r['P0'] == pytest.approx(1/(1+2.7+2.7**2/2+2.7**3/(6*.1)))
    assert r['Pq'] == r['P_wait']
    assert r['Lq'] == pytest.approx(r['lambda_per_minute']*r['Wq'])
    ref = run_mmc_reference(3,42,warmup_minutes=100,observation_minutes=1000)
    assert 0 <= ref['rho'] <= 1
    assert ref['L']-ref['lambda_W'] == pytest.approx(ref['boundary_L'],abs=1e-9)
    assert ref['Lq']-ref['lambda_Wq'] == pytest.approx(ref['boundary_Lq'],abs=1e-9)
    assert ref == run_mmc_reference(3,42,warmup_minutes=100,observation_minutes=1000)


def test_c6_real_route_two_slots_429_retry_after_and_error_release(monkeypatch):
    limiter = TechnicalCapacity(2)
    entered, release, lock = Event(), Event(), Lock()
    counter = 0
    def controlled_work(config, db):
        nonlocal counter
        with lock:
            counter += 1
            if counter == 2:
                entered.set()
        assert release.wait(10)
        return {'completed':True}
    monkeypatch.setattr(routes, 'capacity', limiter)
    monkeypatch.setattr(routes, 'run_simulation', controlled_work)
    app.dependency_overrides[get_db] = lambda: None
    try:
        with TestClient(app, raise_server_exceptions=False) as client, ThreadPoolExecutor() as pool:
            pending = [pool.submit(client.post, '/api/simulations/run', json={}) for _ in range(2)]
            try:
                assert entered.wait(10)
                assert limiter.snapshot()['active_simulations'] == 2
                response = client.post('/api/simulations/run',json={})
                assert response.status_code == 429
                assert response.headers['Retry-After'] == '2'
            finally:
                release.set()
            assert [f.result().status_code for f in pending] == [201,201]
            assert limiter.snapshot()['active_simulations'] == 0
            def failure(config, db):
                raise ValueError('intentional audit failure')
            monkeypatch.setattr(routes, 'run_simulation', failure)
            assert client.post('/api/simulations/run',json={}).status_code == 500
            assert limiter.snapshot()['active_simulations'] == 0
            monkeypatch.setattr(routes, 'run_simulation', lambda config, db: {'completed':True})
            assert client.post('/api/simulations/run',json={}).status_code == 201
    finally:
        app.dependency_overrides.clear()
