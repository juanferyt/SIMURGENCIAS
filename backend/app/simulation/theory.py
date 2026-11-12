"""Stable Erlang-C calculation. Units: minutes and patients/minute."""
import math


def mmc(arrival_per_hour: float, service_mean_minutes: float, servers: int) -> dict:
    if (not math.isfinite(arrival_per_hour) or not math.isfinite(service_mean_minutes)
            or arrival_per_hour <= 0 or service_mean_minutes <= 0
            or not isinstance(servers, int) or isinstance(servers, bool) or servers < 1):
        raise ValueError("λ, tiempo de servicio y c deben ser positivos y finitos")
    lam, mu = arrival_per_hour / 60, 1 / service_mean_minutes
    rho = lam / (servers * mu)
    base = {"lambda_per_minute": lam, "mu_per_minute": mu, "c": servers, "rho": rho}
    if rho >= 1:
        return {**base, "stable": False, "reason": "INESTABLE: ρ ≥ 1, no existe régimen estacionario finito", "P0": None, "Pq": None, "P_wait": None, "W": None, "Wq": None, "L": None, "Lq": None}
    offered = lam / mu
    term, total = 1.0, 1.0
    for k in range(1, servers):
        term *= offered / k
        total += term
    last = term * offered / servers / (1 - rho)
    pwait = last / (total + last)
    wq = pwait / (servers * mu - lam)
    w = wq + 1 / mu
    return {**base, "stable": True, "P0": 1 / (total + last), "Pq": pwait,
            "P_wait": pwait, "Wq": wq, "W": w, "Lq": lam * wq, "L": lam * w}
