"""
Deterministic demand-score model for arbitrary locations.
Production design wires this through a SageMaker endpoint; this is the
offline path used by the demo and as a fallback when SageMaker is down.

Input shape matches the SageMaker contract exactly so swapping is a one-line change.
"""
import math
from datetime import datetime


# Known Lagos demand hubs (lat, lng, strength 0-1)
_HUBS = [
    ("Lekki",       6.4470, 3.4720, 1.00),
    ("VI",          6.4280, 3.4220, 0.95),
    ("Ikoyi",       6.4490, 3.4380, 0.90),
    ("Yaba",        6.5141, 3.3787, 0.92),
    ("Ikeja",       6.6018, 3.3515, 0.88),
    ("Surulere",    6.5000, 3.3500, 0.78),
    ("Apapa",       6.4480, 3.3640, 0.70),
    ("Festac",      6.4660, 3.2860, 0.68),
    ("Lagos Island", 6.4530, 3.3950, 0.74),
]

# 1 deg lat ≈ 111 km, 1 deg lon at Lagos lat ≈ 110.5 km
_LAT_KM = 111.0
_LON_KM = 110.5


def _haversine_km(lat1, lon1, lat2, lon2):
    """Cheap flat-earth distance — good enough at city scale."""
    dlat = (lat1 - lat2) * _LAT_KM
    dlon = (lon1 - lon2) * _LON_KM
    return math.sqrt(dlat * dlat + dlon * dlon)


def _hub_pressure(lat, lng):
    """Falls off exponentially with distance to each hub; returns 0-1."""
    if not _HUBS:
        return 0.0
    contributions = []
    for _, hlat, hlng, strength in _HUBS:
        d = _haversine_km(lat, lng, hlat, hlng)
        # decay scale: 3km
        contributions.append(strength * math.exp(-d / 3.0))
    return min(1.0, max(contributions))


def _time_multiplier(hour_of_day, day_of_week):
    """Peak hours and weekday boost. Returns 0.55-1.15."""
    peak_morning = max(0.0, 1.0 - abs(hour_of_day - 8.5) / 4.0)
    peak_evening = max(0.0, 1.0 - abs(hour_of_day - 18.0) / 4.0)
    peak = max(peak_morning, peak_evening)              # 0-1
    weekday_factor = 1.0 if day_of_week < 5 else 0.85
    return (0.7 + 0.3 * peak) * weekday_factor


def _competitor_penalty(count):
    """Each nearby competitor reduces score; saturates at 5."""
    n = max(0, min(int(count or 0), 5))
    return 1.0 - 0.08 * n   # 1.0 → 0.6


def score_location(lat, lng, hour_of_day=None, day_of_week=None, competitor_count=0):
    """
    Return a demand score in [0, 100] for the given location and time.
    Same input shape as the SageMaker model.

    >>> 0 <= score_location(6.45, 3.47) <= 100
    True
    """
    now = datetime.utcnow()
    if hour_of_day is None:
        hour_of_day = now.hour
    if day_of_week is None:
        day_of_week = now.weekday()

    base = _hub_pressure(lat, lng)                       # 0-1
    tm = _time_multiplier(hour_of_day, day_of_week)      # 0.55-1.15
    cp = _competitor_penalty(competitor_count)           # 0.6-1.0

    raw = base * tm * cp                                 # 0-1.15
    return round(min(100.0, max(0.0, raw * 100.0)), 2)


def score_to_tier(score):
    if score >= 75:
        return "hot"
    if score >= 45:
        return "warm"
    return "cold"
