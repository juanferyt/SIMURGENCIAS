"""Behavioral tests for final-delivery changes, independent of PostgreSQL."""
from statistics import mean

import pytest
from pydantic import ValidationError

from app.simulation.domain import Patient, SimulationConfig
from app.simulation.engine import EmergencyDepartment


def test_abandonment_retry_conservation_and_exact_little():
    c = SimulationConfig(doctors=1, arrival_rates_per_hour=(30,30,30,30),
                         patience_mean_minutes=2, abandonment_min_triage=1,
                         retry_probability=1, max_retries=1)
    r = EmergencyDepartment(c).run()
    m = r.metrics
    assert m['abandoned'] > 0 and m['retry_visits'] > 0
    assert m['generated'] == m['external_generated'] + m['retry_visits']
    assert m['generated'] == m['discharged'] + m['abandoned'] + m['active_at_end']
    assert r.little['difference'] == pytest.approx(r.little['censored_contribution'], abs=1e-8)
    assert r.little['queue']['difference'] == pytest.approx(r.little['queue']['censored_contribution'], abs=1e-8)
    assert all(p['attempt'] <= 1 for p in r.patients)
    assert r == EmergencyDepartment(c).run()


def test_shift_preserves_external_arrivals_and_tracks_resource_hours():
    c = SimulationConfig(doctors=3, patience_mean_minutes=180, retry_probability=.3)
    fixed = EmergencyDepartment(c).run()
    peak = EmergencyDepartment(c.model_copy(update={'peak_extra_doctors':1})).run()
    demands = lambda r: [(p['root_id'],p['arrival'],p['consultation_service'])
                          for p in r.patients if p['attempt']==0]
    assert demands(fixed) == demands(peak)
    assert peak.metrics['nominal_doctor_hours'] == 78
    assert peak.metrics['doctor_hours'] >= 78-1e-8
    assert fixed.metrics['doctor_hours'] == pytest.approx(72)
    assert 0 <= peak.metrics['doctor_utilization'] <= 1
    for point in peak.timeline:
        assert 0 <= point['doctors_busy'] <= point['doctors_available'] <= 4
        assert point['beds_busy'] <= 4


def test_shift_retirement_does_not_preempt_a_consultation():
    c = SimulationConfig(doctors=1, peak_extra_doctors=1,
                         peak_start_minute=10, peak_end_minute=20)
    ed = EmergencyDepartment(c)
    ed.env.process(ed.reinforcement_slot())
    people = [Patient(1,10.1,3,.1,50,0,False), Patient(2,10.1,3,.1,30,0,False)]
    def introduce(p):
        yield ed.env.timeout(p.arrival)
        yield ed.env.process(ed.patient_process(p))
    for p in people:
        ed.env.process(introduce(p))
    ed.env.run(until=65)
    ed.change()
    assert all(p.consultation_end-p.consultation_start == pytest.approx(p.consultation_service) for p in people)
    assert ed.areas['doctors_available']/60 > (65+10)/60
    assert ed.counts['doctors_available'] == 1


def test_abandoned_request_is_removed_before_next_patient():
    ed = EmergencyDepartment(SimulationConfig(doctors=1, triage_staff=3,
        patience_mean_minutes=.01, abandonment_min_triage=4))
    people = [Patient(1,0,1,.01,10,0,False), Patient(2,0,5,.01,1,0,False),
              Patient(3,0,1,.01,1,0,False)]
    for p in people:
        ed.env.process(ed.patient_process(p))
    ed.env.run()
    assert people[1].abandoned_at is not None
    assert people[2].consultation_start == pytest.approx(10.01)
    assert not ed.doctors.resource.queue and not ed.doctors.resource.users


def test_visit_areas_reconstruct_queue_with_abandonment():
    c = SimulationConfig(doctors=2, patience_mean_minutes=30)
    r = EmergencyDepartment(c).run()
    def exit_queue(p):
        return p['consultation_start'] if p['consultation_start'] is not None else (
            p['abandoned_at'] if p['abandoned_at'] is not None else c.duration_minutes)
    area = sum(exit_queue(p)-p['triage_end'] for p in r.patients if p['triage_end'] is not None)
    assert r.metrics['mean_queue_length'] == pytest.approx(area/c.duration_minutes)


@pytest.mark.parametrize('change',[{'peak_start_minute':1200,'peak_end_minute':500},
                                  {'doctors':20,'peak_extra_doctors':1}])
def test_invalid_shift_config(change):
    with pytest.raises(ValidationError):
        SimulationConfig(**change)
