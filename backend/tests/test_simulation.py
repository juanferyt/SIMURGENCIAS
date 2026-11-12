import math
import random

import pytest
from pydantic import ValidationError

from app.simulation.domain import Patient, SimulationConfig
from app.simulation.engine import EmergencyDepartment
from app.simulation.strategies import ServiceTimeStrategy, TimeVaryingArrivalStrategy
from app.simulation.theory import mmc


def test_reproducibility_and_capacity_experiment():
    config = SimulationConfig()
    results = [EmergencyDepartment(config.model_copy(update={"doctors": n})).run() for n in range(1, 5)]
    assert results[1] == EmergencyDepartment(config).run()
    demands = lambda r: [(p["arrival"], p["triage_level"], p["consultation_service"], p["needs_observation"]) for p in r.patients]
    assert all(demands(r) == demands(results[0]) for r in results)
    assert results[0].metrics["mean_wait_minutes"] > results[3].metrics["mean_wait_minutes"]
    assert results[0].metrics["treated"] < results[3].metrics["treated"]
    assert demands(results[0]) != demands(EmergencyDepartment(config.model_copy(update={"seed": 43})).run())


@pytest.mark.parametrize("doctors", [1, 2, 4])
def test_conservation_utilization_and_finite_horizon_little(doctors):
    result = EmergencyDepartment(SimulationConfig(doctors=doctors)).run()
    m = result.metrics
    assert m["generated"] == m["discharged"] + m["active_at_end"]
    assert m["generated"] >= m["treated"] >= m["discharged"]
    for key in ["doctor_utilization", "triage_utilization", "bed_utilization"]:
        assert 0 <= m[key] <= 1
    assert result.little["difference"] == pytest.approx(result.little["censored_contribution"], abs=1e-8)
    # Independent reconstruction of the time integral from patient records.
    occupied = sum(min(p["departure"] or 1440, 1440) - p["arrival"] for p in result.patients) / 1440
    assert occupied == pytest.approx(m["mean_active"])


class FixedHazard:
    def expovariate(self, rate):
        return 1.0


def test_arrivals_cross_boundaries_and_zero_rate_periods():
    strategy = TimeVaryingArrivalStrategy([0, 60, 0, 0])
    assert strategy.next_delay(0, FixedHazard()) == 361
    assert strategy.next_delay(719.5, FixedHazard()) == 1081


def test_nonstationary_profile_has_distinct_expected_counts():
    strategy = TimeVaryingArrivalStrategy([2, 5, 9, 6])
    rng = random.Random(81)
    counts = [0] * 4
    now = 0
    while True:
        now += strategy.next_delay(now, rng)
        if now >= 1440 * 200:
            break
        counts[int(now // 360) % 4] += 1
    for observed, rate in zip(counts, [2, 5, 9, 6]):
        assert observed == pytest.approx(rate * 6 * 200, rel=0.07)


def test_priority_is_nonpreemptive_and_fifo_can_be_injected():
    def order(policy):
        ed = EmergencyDepartment(SimulationConfig(doctors=1, triage_staff=3, priority_policy=policy))
        patients = [Patient(i, 0, level, 0.01, 5, 0, False) for i, level in enumerate([3, 5, 1], 1)]
        for p in patients:
            ed.env.process(ed.patient_process(p))
        ed.env.run()
        return [p.id for p in sorted(patients, key=lambda p: p.consultation_start)]
    assert order("triage") == [1, 3, 2]
    assert order("fifo") == [1, 2, 3]


class FixedService(ServiceTimeStrategy):
    def sample(self, mean, rng):
        return mean


def test_strategy_injection_and_no_departures():
    config = SimulationConfig(duration_minutes=60, arrival_rates_per_hour=(60, 60, 60, 60),
                              consultation_mean_minutes=120)
    result = EmergencyDepartment(config, service=FixedService()).run()
    assert result.metrics["generated"] > 0
    assert result.metrics["discharged"] == 0
    assert result.metrics["mean_system_minutes"] is None
    assert result.little["lambda_W"] is None


def test_mmc_known_mm1_and_instability():
    result = mmc(2, 15, 1)
    assert result["rho"] == pytest.approx(0.5)
    assert result["Wq"] == pytest.approx(15)
    assert result["W"] == pytest.approx(30)
    assert result["L"] == pytest.approx(1)
    assert not mmc(4, 15, 1)["stable"]
    assert mmc(4, 15, 1)["W"] is None
    assert math.isfinite(mmc(0.1, 0.1, 50)["W"])


@pytest.mark.parametrize("payload", [{"doctors": 0}, {"duration_minutes": 0}, {"arrival_rates_per_hour": [0, 0, 0, 0]},
    {"arrival_rates_per_hour": [-1, 2, 3, 4]}, {"arrival_rates_per_hour": [1, 2]}, {"triage_mean_minutes": float('nan')},
    {"arrival_rates_per_hour": [float('inf'), 2, 3, 4]}, {"priority_policy": "clinical"}])
def test_invalid_config(payload):
    with pytest.raises(ValidationError):
        SimulationConfig(**payload)
