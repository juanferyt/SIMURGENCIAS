"""Patient-level empirical quantiles, linear interpolation (Hyndman-Fan type 7)."""
import math


def percentile(values, probability):
    if not 0 <= probability <= 1:
        raise ValueError("La probabilidad debe estar entre cero y uno")
    ordered = sorted(values)
    if not ordered:
        return None
    position = (len(ordered) - 1) * probability
    lower = math.floor(position)
    upper = math.ceil(position)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)
