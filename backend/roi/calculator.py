import hashlib
import json

BASE_RATES = {
    "commercial": {"ac_level2": 12, "dc_fast": 16},
    "private":    {"ac_level2": 6,  "dc_fast": 9},
    "mixed":      {"ac_level2": 9,  "dc_fast": 12},
}

REVENUE_PER_SESSION = {
    "commercial": {"ac_level2": 600,   "dc_fast": 800},
    "private":    {"ac_level2": 2000,  "dc_fast": 3500},
    "mixed":      {"ac_level2": 1200,  "dc_fast": 2000},
}

SCENARIOS = {
    "conservative": {"sessions_mult": 0.70, "revenue_mult": 0.90},
    "base":         {"sessions_mult": 1.00, "revenue_mult": 1.00},
    "optimistic":   {"sessions_mult": 1.35, "revenue_mult": 1.15},
}


def _build_scenario(adjusted_sessions, rev_per_session, num_ports, opex, capex, mult):
    sessions = adjusted_sessions * mult["sessions_mult"]
    revenue = rev_per_session * mult["revenue_mult"]
    monthly_gross = sessions * num_ports * revenue * 30
    monthly_net = monthly_gross - opex
    payback = capex / monthly_net if monthly_net > 0 else None
    roi_12m = ((monthly_net * 12 - capex) / capex) * 100 if capex > 0 else None
    return {
        "daily_sessions_per_port": round(sessions, 2),
        "avg_revenue_per_session_ngn": round(revenue, 2),
        "monthly_gross_ngn": round(monthly_gross, 2),
        "monthly_net_ngn": round(monthly_net, 2),
        "payback_months": round(payback, 2) if payback is not None else None,
        "roi_12m_pct": round(roi_12m, 2) if roi_12m is not None else None,
    }


def calculate_roi(params: dict) -> dict:
    station_type = params["station_type"]
    num_ports = int(params["num_ports"])
    capex = float(params["capex_ngn"])
    opex = float(params["opex_monthly_ngn"])
    segment = params["target_segment"]
    demand_score = float(params.get("demand_score", 50))
    competitor_count = int(params.get("competitor_count", 0))

    base_rate = BASE_RATES[segment][station_type]
    rev_per_session = REVENUE_PER_SESSION[segment][station_type]

    demand_multiplier = 0.6 + (demand_score / 100) * 0.8
    competition_factor = max(0.5, 1.0 - (competitor_count * 0.1))
    adjusted_sessions = base_rate * demand_multiplier * competition_factor

    scenarios = {
        name: _build_scenario(adjusted_sessions, rev_per_session, num_ports, opex, capex, mult)
        for name, mult in SCENARIOS.items()
    }

    return {
        "location": {"lat": params.get("lat"), "lng": params.get("lng"), "name": params.get("zone_name", "")},
        "station_type": station_type,
        "num_ports": num_ports,
        "capex_ngn": capex,
        "opex_monthly_ngn": opex,
        "scenarios": scenarios,
        "demand_score": demand_score,
        "competitor_count": competitor_count,
        "recommendation": _recommendation(scenarios["base"]),
    }


def _recommendation(base: dict) -> str:
    payback = base.get("payback_months")
    roi = base.get("roi_12m_pct")
    if payback and payback < 12 and roi and roi > 50:
        return f"Strong investment case — {payback:.1f}-month payback and {roi:.0f}% 12-month ROI in the base scenario."
    if payback and payback < 24:
        return f"Viable investment — {payback:.1f}-month payback. Monitor competitor activity."
    return "Proceed with caution — payback period exceeds 24 months under base assumptions."


def input_hash(params: dict) -> str:
    canonical = json.dumps(params, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()
