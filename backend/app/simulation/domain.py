"""Domain of the academic DES. All times are minutes; inputs are synthetic."""
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SimulationConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    doctors: int = Field(2, ge=1, le=20)
    triage_staff: int = Field(1, ge=1, le=10)
    observation_beds: int = Field(4, ge=1, le=50)
    duration_minutes: float = Field(1440, ge=60, le=10080)
    seed: int = Field(42, ge=0, le=2147483647)
    rng_scheme: Literal["sha256-v1", "legacy-v1"] = "sha256-v1"
    arrival_profile: Literal["time_varying", "stationary"] = "time_varying"
    # Four six-hour periods, repeating daily, starting at midnight.
    arrival_rates_per_hour: tuple[float, float, float, float] = Field(default=(2, 5, 9, 6))
    stationary_rate_per_hour: float = Field(5, gt=0, le=60)
    triage_mean_minutes: float = Field(5, gt=0, le=60)
    consultation_mean_minutes: float = Field(18, gt=0, le=120)
    observation_mean_minutes: float = Field(60, gt=0, le=480)
    observation_probability: float = Field(0.2, ge=0, le=1)
    priority_policy: Literal["triage", "fifo"] = "triage"

    # Validate elements as well as the tuple length.
    @field_validator("arrival_rates_per_hour")
    @classmethod
    def validate_rates(cls, rates):
        import math
        if any(not math.isfinite(rate) or rate < 0 or rate > 60 for rate in rates):
            raise ValueError("Cada tasa debe estar entre 0 y 60 pacientes/hora")
        if not any(rates):
            raise ValueError("Al menos una franja debe tener llegadas")
        return rates


@dataclass
class Patient:
    id: int
    arrival: float
    triage_level: int
    triage_service: float
    consultation_service: float
    observation_service: float
    needs_observation: bool
    state: str = "triage_queue"
    triage_start: float | None = None
    triage_end: float | None = None
    consultation_start: float | None = None
    consultation_end: float | None = None
    observation_start: float | None = None
    departure: float | None = None


@dataclass
class Doctor:
    capacity: int
    resource: object


@dataclass
class TriageStation:
    capacity: int
    resource: object


class SimulationResult(BaseModel):
    config: SimulationConfig
    metrics: dict
    timeline: list[dict]
    patients: list[dict]
    theory: dict
    little: dict
    data_source: str = "datos sintéticos · escenario experimental · modelo académico"
