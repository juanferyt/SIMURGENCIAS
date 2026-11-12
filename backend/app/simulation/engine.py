from dataclasses import asdict
import random
from statistics import mean

import simpy

from .domain import Doctor, Patient, SimulationConfig, SimulationResult, TriageStation
from .strategies import (ArrivalStrategy, ExponentialServiceStrategy, FifoTriageStrategy,
                         PriorityTriageStrategy, ServiceTimeStrategy, StationaryArrivalStrategy,
                         TimeVaryingArrivalStrategy, TriageStrategy)
from .theory import mmc
from .randomness import random_stream
from .statistics import percentile


class EmergencyDepartment:
    def __init__(self, config: SimulationConfig, arrival: ArrivalStrategy | None = None,
                 triage: TriageStrategy | None = None, service: ServiceTimeStrategy | None = None):
        self.config = config
        self.env = simpy.Environment()
        self.doctors = Doctor(config.doctors, simpy.PriorityResource(self.env, config.doctors))
        self.triage = TriageStation(config.triage_staff, simpy.Resource(self.env, config.triage_staff))
        self.beds = simpy.Resource(self.env, config.observation_beds)
        self.arrival = arrival or (TimeVaryingArrivalStrategy(config.arrival_rates_per_hour)
                                  if config.arrival_profile == "time_varying"
                                  else StationaryArrivalStrategy(config.stationary_rate_per_hour))
        self.priority = triage or (PriorityTriageStrategy() if config.priority_policy == "triage" else FifoTriageStrategy())
        self.service = service or ExponentialServiceStrategy()
        # Independent streams; requirements are drawn at arrival, not at service.
        # Changing capacity thus preserves the same patients and service demands.
        self.arrival_rng = (random.Random(config.seed) if config.rng_scheme == "legacy-v1"
                            else random_stream(config.seed, "arrivals"))
        self.patient_rng = (random.Random(config.seed + 1) if config.rng_scheme == "legacy-v1"
                            else random_stream(config.seed, "patients"))
        self.patients: list[Patient] = []
        self.timeline: list[dict] = []
        self.counts = dict(active=0, triage_queue=0, doctor_queue=0, observation_queue=0,
                           triage_busy=0, doctors_busy=0, beds_busy=0)
        self.areas = {key: 0.0 for key in self.counts}
        self.last_event = 0.0
        self.max_doctor_queue = 0

    def change(self, **deltas):
        now = float(self.env.now)
        for key, value in self.counts.items():
            self.areas[key] += value * (now - self.last_event)
        self.last_event = now
        for key, delta in deltas.items():
            self.counts[key] += delta

    def arrivals(self):
        c = self.config
        while True:
            yield self.env.timeout(self.arrival.next_delay(self.env.now, self.arrival_rng))
            r = self.patient_rng
            p = Patient(len(self.patients) + 1, float(self.env.now),
                        r.choices([1, 2, 3, 4, 5], weights=[5, 15, 40, 25, 15])[0],
                        self.service.sample(c.triage_mean_minutes, r),
                        self.service.sample(c.consultation_mean_minutes, r),
                        self.service.sample(c.observation_mean_minutes, r),
                        r.random() < c.observation_probability)
            self.patients.append(p)
            self.env.process(self.patient_process(p))

    def patient_process(self, p):
        self.change(active=1, triage_queue=1)
        with self.triage.resource.request() as request:
            yield request
            p.triage_start = float(self.env.now)
            p.state = "triage"
            self.change(triage_queue=-1, triage_busy=1)
            yield self.env.timeout(p.triage_service)
            p.triage_end = float(self.env.now)
            self.change(triage_busy=-1, doctor_queue=1)
        p.state = "doctor_queue"
        with self.doctors.resource.request(priority=self.priority.priority(p.triage_level)) as request:
            # Count actual pending requests; an immediate grant never enters the queue.
            self.max_doctor_queue = max(self.max_doctor_queue, len(self.doctors.resource.queue))
            yield request
            p.consultation_start = float(self.env.now)
            p.state = "consultation"
            self.change(doctor_queue=-1, doctors_busy=1)
            yield self.env.timeout(p.consultation_service)
            p.consultation_end = float(self.env.now)
            self.change(doctors_busy=-1)
        if p.needs_observation:
            p.state = "observation_queue"
            self.change(observation_queue=1)
            with self.beds.request() as request:
                yield request
                p.observation_start = float(self.env.now)
                p.state = "observation"
                self.change(observation_queue=-1, beds_busy=1)
                yield self.env.timeout(p.observation_service)
                self.change(beds_busy=-1)
        p.departure = float(self.env.now)
        p.state = "discharged"
        self.change(active=-1)

    def sample(self):
        self.timeline.append({"minute": float(self.env.now), **self.counts})

    def monitor(self):
        # At most ~721 points. Metrics use exact event integrals, not samples.
        interval = max(1.0, self.config.duration_minutes / 720)
        while True:
            self.sample()
            yield self.env.timeout(interval)

    def run(self) -> SimulationResult:
        c = self.config
        self.env.process(self.arrivals())
        self.env.process(self.monitor())
        self.env.run(until=c.duration_minutes)
        self.change()
        self.sample()
        h = c.duration_minutes
        departed = [p for p in self.patients if p.departure is not None]
        started = [p for p in self.patients if p.consultation_start is not None]
        treated = [p for p in self.patients if p.consultation_end is not None]
        avg = lambda values: mean(values) if values else None
        waits = [p.consultation_start - p.triage_end for p in started]
        wait = avg(waits)
        system = avg([p.departure - p.arrival for p in departed])
        l = self.areas["active"] / h
        throughput = len(departed) / h
        lw = throughput * system if system is not None else None
        censored_area = sum(h - p.arrival for p in self.patients if p.departure is None) / h
        start_rate = len(started) / h
        queue_censored = sum(h - p.triage_end for p in self.patients
                             if p.triage_end is not None and p.consultation_start is None) / h
        queue_product = start_rate * wait if wait is not None else None
        metrics = dict(generated=len(self.patients), treated=len(treated), discharged=len(departed),
                       abandoned=0, active_at_end=self.counts["active"],
                       mean_wait_minutes=wait, mean_system_minutes=system,
                       p50_wait_minutes=percentile(waits, 0.50),
                       p95_wait_minutes=percentile(waits, 0.95),
                       p99_wait_minutes=percentile(waits, 0.99),
                       probability_wait=avg([int(w > 1e-9) for w in waits]),
                       max_queue_length=self.max_doctor_queue,
                       consultation_started=len(started),
                       throughput_per_minute=throughput, throughput_per_hour=throughput * 60,
                       mean_service_minutes=avg([p.consultation_service for p in treated]),
                       mean_triage_wait_minutes=avg([p.triage_start - p.arrival for p in self.patients if p.triage_start is not None]),
                       mean_queue_length=self.areas["doctor_queue"] / h,
                       mean_triage_queue_length=self.areas["triage_queue"] / h,
                       mean_observation_queue_length=self.areas["observation_queue"] / h,
                       doctor_utilization=self.areas["doctors_busy"] / (h * c.doctors),
                       triage_utilization=self.areas["triage_busy"] / (h * c.triage_staff),
                       bed_utilization=self.areas["beds_busy"] / (h * c.observation_beds),
                       mean_active=l, duration_minutes=h, final_state=self.counts.copy())
        # Only stationary arrivals allow a nominal M/M/c reference. Triage output,
        # priorities and a finite empty-start horizon still violate exact equivalence.
        theory = {"compatible": False, "reference": None,
                  "reason": "Llegadas no estacionarias: no corresponde un M/M/c estacionario."}
        if c.arrival_profile == "stationary":
            ref = mmc(c.stationary_rate_per_hour, c.consultation_mean_minutes, c.doctors)
            theory = {"compatible": False, "reference": ref,
                      "reason": "Referencia aislada de consulta con entrada Poisson y FIFO; el DES tiene triage previo, prioridad opcional y horizonte finito.",
                      "des_Wq": wait, "des_Lq": metrics["mean_queue_length"],
                      "difference_Wq": wait - ref["Wq"] if wait is not None and ref["stable"] else None}
        return SimulationResult(config=c, metrics=metrics, timeline=self.timeline,
                                patients=[asdict(p) for p in self.patients], theory=theory,
                                little={"L_observed": l, "lambda_observed_per_minute": throughput,
                                        "W_observed_minutes": system, "lambda_W": lw,
                                        "difference": l - lw if lw is not None else None,
                                        "censored_contribution": censored_area,
                                        "queue": {"Lq_observed": self.areas["doctor_queue"] / h,
                                                  "lambda_starts_per_minute": start_rate,
                                                  "Wq_observed_minutes": wait,
                                                  "lambda_Wq": queue_product,
                                                  "difference": self.areas["doctor_queue"] / h - queue_product if queue_product is not None else None,
                                                  "censored_contribution": queue_censored},
                                        "explanation": "λ usa egresos/horizonte y W solo egresados. L integra todos los activos. La diferencia es el tiempo acumulado de pacientes aún presentes al corte; no se drenan las colas."})
