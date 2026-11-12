"""Injectable policies: arrival, service duration and queue priority."""
from abc import ABC, abstractmethod
import random


class ArrivalStrategy(ABC):
    @abstractmethod
    def next_delay(self, now: float, rng: random.Random) -> float: ...


class StationaryArrivalStrategy(ArrivalStrategy):
    def __init__(self, rate_per_hour: float):
        self.rate = rate_per_hour / 60

    def next_delay(self, now, rng):
        return rng.expovariate(self.rate)


class TimeVaryingArrivalStrategy(ArrivalStrategy):
    """Exact integrated-hazard inversion for a piecewise constant NHPP.

    Remaining exponential hazard crosses period boundaries, including zero-rate
    periods. No draw from the old rate is allowed to skip a rate change.
    """
    def __init__(self, rates_per_hour):
        self.rates = tuple(rate / 60 for rate in rates_per_hour)
        if not any(self.rates):
            raise ValueError("Se requiere alguna tasa positiva")

    def next_delay(self, now, rng):
        hazard = rng.expovariate(1)
        cursor = now
        while True:
            period = int(cursor // 360)
            boundary = (period + 1) * 360
            rate = self.rates[period % 4]
            available = (boundary - cursor) * rate
            if rate > 0 and hazard < available:
                return cursor - now + hazard / rate
            hazard -= available
            cursor = boundary


class TriageStrategy(ABC):
    @abstractmethod
    def priority(self, level: int) -> int: ...


class PriorityTriageStrategy(TriageStrategy):
    def priority(self, level):
        return level


class FifoTriageStrategy(TriageStrategy):
    def priority(self, level):
        return 0


class ServiceTimeStrategy(ABC):
    @abstractmethod
    def sample(self, mean: float, rng: random.Random) -> float: ...


class ExponentialServiceStrategy(ServiceTimeStrategy):
    def sample(self, mean, rng):
        return rng.expovariate(1 / mean)
