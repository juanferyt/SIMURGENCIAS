"""Isolated FIFO M/M/c validation. Never substitutes the hospital DES.

Areas are clipped to [warmup, warmup + observation]. Time averages exclude
warm-up. W/Wq describe arrivals in that window, followed to completion. Their
cohort areas differ from window areas by explicit left/right boundary terms.
"""
from statistics import mean
import simpy
from .randomness import random_stream


def run_mmc_reference(servers: int, seed: int, arrival_per_hour=9.0,
                      service_mean_minutes=18.0, warmup_minutes=14400.0,
                      observation_minutes=144000.0):
    if (servers < 1 or arrival_per_hour <= 0 or service_mean_minutes <= 0
            or warmup_minutes < 0 or observation_minutes <= 0):
        raise ValueError("Parámetros de referencia inválidos")
    env = simpy.Environment()
    resource = simpy.Resource(env, capacity=servers)
    arrivals_rng = random_stream(seed, "reference-arrivals")
    services_rng = random_stream(seed, "reference-services")
    end = warmup_minutes + observation_minutes
    patients = []

    def patient(record):
        with resource.request() as request:
            yield request
            record["start"] = float(env.now)
            yield env.timeout(record["service"])
            record["departure"] = float(env.now)

    def arrivals():
        while True:
            delay = arrivals_rng.expovariate(arrival_per_hour / 60)
            if env.now + delay >= end:
                return
            yield env.timeout(delay)
            record = {"arrival": float(env.now), "service": services_rng.expovariate(1 / service_mean_minutes)}
            patients.append(record)
            env.process(patient(record))

    env.process(arrivals())
    env.run()  # drains tagged FIFO customers; subsequent arrivals cannot delay them

    def overlap(a, b):
        return max(0.0, min(b, end) - max(a, warmup_minutes))

    cohort = [p for p in patients if p["arrival"] >= warmup_minutes]
    window_l = sum(overlap(p["arrival"], p["departure"]) for p in patients) / observation_minutes
    window_lq = sum(overlap(p["arrival"], p["start"]) for p in patients) / observation_minutes
    rho = sum(overlap(p["start"], p["departure"]) for p in patients) / (observation_minutes * servers)
    w = mean(p["departure"] - p["arrival"] for p in cohort) if cohort else None
    wq = mean(p["start"] - p["arrival"] for p in cohort) if cohort else None
    lam = len(cohort) / observation_minutes
    # Window area = cohort lifetime area + carry-in area - carry-out area.
    left_l = sum(overlap(p["arrival"], p["departure"]) for p in patients if p["arrival"] < warmup_minutes) / observation_minutes
    left_q = sum(overlap(p["arrival"], p["start"]) for p in patients if p["arrival"] < warmup_minutes) / observation_minutes
    right_l = sum(max(0, p["departure"] - end) for p in cohort) / observation_minutes
    right_q = sum(max(0, p["start"] - end) for p in cohort) / observation_minutes
    return {"c": servers, "seed": seed, "warmup_minutes": warmup_minutes,
            "observation_minutes": observation_minutes, "cohort_size": len(cohort),
            "rho": rho, "Lq": window_lq, "Wq": wq, "W": w, "L": window_l,
            "lambda_observed": lam, "lambda_W": lam * w if w is not None else None,
            "lambda_Wq": lam * wq if wq is not None else None,
            "boundary_L": left_l - right_l, "boundary_Lq": left_q - right_q,
            "drain_until_minute": float(env.now)}
