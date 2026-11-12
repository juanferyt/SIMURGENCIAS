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
        self.doctors = Doctor(config.doctors, simpy.PriorityResource(self.env, config.doctors + config.peak_extra_doctors))
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
        self.external_generated = 0
        self.patients: list[Patient] = []
        self.timeline: list[dict] = []
        self.counts = dict(active=0, triage_queue=0, doctor_queue=0, observation_queue=0,
                           triage_busy=0, doctors_busy=0, beds_busy=0, doctors_available=config.doctors)
        self.areas = {key: 0.0 for key in self.counts}
        self.bed_full_area = 0.0
        self.last_event = 0.0
        self.max_doctor_queue = 0

    def change(self, **deltas):
        now = float(self.env.now)
        self.bed_full_area += (now - self.last_event) * (self.counts["beds_busy"] == self.config.observation_beds)
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
            self.external_generated += 1
            p.root_id = self.external_generated
            self.patients.append(p)
            self.env.process(self.patient_process(p))

    def reinforcement_slot(self):
        """A high-priority blocker removes one capacity slot outside the shift.

        Off-duty requests never interrupt patients already in service. If all
        slots are busy, capacity is retired at the next completion; that tail
        contributes to actual available doctor-hours.
        """
        c, resource = self.config, self.doctors.resource
        blocker = resource.request(priority=-1000)
        yield blocker
        day = 0
        while True:
            start = day * 1440 + c.peak_start_minute
            end = day * 1440 + c.peak_end_minute
            yield self.env.timeout(max(0, start - self.env.now))
            resource.release(blocker)
            self.change(doctors_available=1)
            yield self.env.timeout(max(0, end - self.env.now))
            blocker = resource.request(priority=-1000)
            yield blocker
            self.change(doctors_available=-1)
            day += 1

    def retry_patient(self, original):
        c = self.config
        rng = random_stream(c.seed, f"retry:{original.root_id}:{original.attempt}")
        if original.attempt >= c.max_retries or rng.random() >= c.retry_probability:
            return
        yield self.env.timeout(c.retry_delay_minutes)
        r = random_stream(c.seed, f"retry-service:{original.root_id}:{original.attempt + 1}")
        p = Patient(len(self.patients) + 1, float(self.env.now), original.triage_level,
                    self.service.sample(c.triage_mean_minutes, r),
                    self.service.sample(c.consultation_mean_minutes, r),
                    self.service.sample(c.observation_mean_minutes, r),
                    r.random() < c.observation_probability,
                    root_id=original.root_id, attempt=original.attempt + 1)
        self.patients.append(p)
        yield self.env.process(self.patient_process(p))

    def patient_process(self, p):
        c = self.config
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
            # Ignore the administrative off-duty blockers when counting patients.
            self.max_doctor_queue = max(self.max_doctor_queue,
                sum(req.priority >= 0 for req in self.doctors.resource.queue))
            if c.patience_mean_minutes is not None and p.triage_level >= c.abandonment_min_triage:
                patience_rng = random_stream(c.seed, f"patience:{p.root_id or p.id}:{p.attempt}")
                patience = patience_rng.expovariate(1 / c.patience_mean_minutes)
                outcome = yield request | self.env.timeout(patience)
                # A simultaneous grant wins. Context exit releases an acquired
                # resource or cancels a pending request, preventing leaked slots.
                if request not in outcome and not request.triggered:
                    p.abandoned_at = float(self.env.now)
                    p.state = "abandoned"
                    self.change(doctor_queue=-1, active=-1)
                    self.env.process(self.retry_patient(p))
                    return
            else:
                yield request
            p.consultation_start = float(self.env.now)
            p.state = "consultation"
            self.change(doctor_queue=-1, doctors_busy=1)
            yield self.env.timeout(p.consultation_service)
            p.consultation_end = float(self.env.now)
            self.change(doctors_busy=-1)
        if p.needs_observation:
            # Consultation releases the doctor before waiting for a finite bed.
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
        for _ in range(c.peak_extra_doctors):
            self.env.process(self.reinforcement_slot())
        self.env.process(self.arrivals())
        self.env.process(self.monitor())
        self.env.run(until=c.duration_minutes)
        self.change()
        self.sample()
        h = c.duration_minutes
        departed = [p for p in self.patients if p.departure is not None]
        started = [p for p in self.patients if p.consultation_start is not None]
        abandoned = [p for p in self.patients if p.abandoned_at is not None]
        exits = departed + abandoned
        treated = [p for p in self.patients if p.consultation_end is not None]
        avg = lambda values: mean(values) if values else None
        waits = [p.consultation_start - p.triage_end for p in started]
        wait = avg(waits)
        system = avg([p.departure - p.arrival for p in departed])
        l = self.areas["active"] / h
        throughput = len(departed) / h
        exit_mean = avg([(p.departure if p.departure is not None else p.abandoned_at) - p.arrival for p in exits])
        exit_rate = len(exits) / h
        lw = exit_rate * exit_mean if exit_mean is not None else None
        censored_area = sum(h - p.arrival for p in self.patients if p.departure is None and p.abandoned_at is None) / h
        start_rate = len(started) / h
        queue_censored = sum(h - p.triage_end for p in self.patients
                             if p.triage_end is not None and p.consultation_start is None and p.abandoned_at is None) / h
        queue_product = (sum(waits) + sum(p.abandoned_at - p.triage_end for p in abandoned)) / h
        metrics = dict(generated=len(self.patients), treated=len(treated), discharged=len(departed),
                       abandoned=len(abandoned), external_generated=self.external_generated,
                       retry_visits=sum(p.attempt > 0 for p in self.patients),
                       abandoned_fraction=len(abandoned)/len(self.patients) if self.patients else 0,
                       doctor_hours=self.areas["doctors_available"]/60,
                       nominal_doctor_hours=(c.doctors*h + c.peak_extra_doctors * sum(
                           max(0, min(h, day*1440+c.peak_end_minute) - (day*1440+c.peak_start_minute))
                           for day in range(int(h//1440)+1)))/60,
                       doctor_queue_at_end=self.counts["doctor_queue"],
                       active_at_end=self.counts["active"],
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
                       doctor_utilization=self.areas["doctors_busy"] / self.areas["doctors_available"],
                       triage_utilization=self.areas["triage_busy"] / (h * c.triage_staff),
                       bed_full_fraction=self.bed_full_area/h,
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
                                little={"L_observed": l, "lambda_observed_per_minute": exit_rate,
                                        "W_observed_minutes": exit_mean, "lambda_W": lw,
                                        "difference": l - lw if lw is not None else None,
                                        "censored_contribution": censored_area,
                                        "queue": {"Lq_observed": self.areas["doctor_queue"] / h,
                                                  "lambda_starts_per_minute": start_rate,
                                                  "Wq_observed_minutes": wait,
                                                  "lambda_Wq": queue_product,
                                                  "difference": self.areas["doctor_queue"] / h - queue_product,
                                                  "censored_contribution": queue_censored},
                                        "explanation": "λ y W de sistema incluyen todas las salidas (egresos y abandonos). El producto de cola incluye esperas de atendidos y abandonos. Los residuos son áreas de pendientes al corte; no se drenan colas."})
