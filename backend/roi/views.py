from django.core.cache import cache
from rest_framework.decorators import api_view
from rest_framework.response import Response
from zones.stubs import STUB_ROI_RESULT
from .calculator import calculate_roi, input_hash

USE_STUBS = False

REQUIRED_FIELDS = ["lat", "lng", "station_type", "num_ports", "capex_ngn", "opex_monthly_ngn", "target_segment"]
CACHE_TTL = 60 * 60 * 24  # 24 hours


@api_view(["POST"])
def roi_calculate(request):
    missing = [f for f in REQUIRED_FIELDS if f not in request.data]
    if missing:
        return Response(
            {"error": True, "message": f"Missing fields: {', '.join(missing)}", "code": "ERR_VALIDATION"},
            status=400,
        )

    if USE_STUBS:
        return Response(STUB_ROI_RESULT)

    params = {k: request.data[k] for k in REQUIRED_FIELDS}
    params.update({
        "demand_score": request.data.get("demand_score", 50),
        "competitor_count": request.data.get("competitor_count", 0),
        "zone_name": request.data.get("zone_id", ""),
    })

    cache_key = f"roi:{input_hash(params)}"
    cached = cache.get(cache_key)
    if cached:
        return Response(cached)

    result = calculate_roi(params)
    cache.set(cache_key, result, CACHE_TTL)
    return Response(result)


@api_view(["GET"])
def roi_compare(request):
    zone_ids = [z for z in request.query_params.get("zone_ids", "").split(",") if z]

    if USE_STUBS:
        return Response({"comparisons": [STUB_ROI_RESULT for _ in zone_ids]})

    station_type = request.query_params.get("station_type", "dc_fast")
    num_ports = int(request.query_params.get("num_ports", 4))
    capex = float(request.query_params.get("capex_ngn", 12000000))
    opex = float(request.query_params.get("opex_monthly_ngn", 450000))
    segment = request.query_params.get("target_segment", "mixed")

    comparisons = []
    for zone_id in zone_ids:
        params = {
            "lat": 0, "lng": 0, "station_type": station_type,
            "num_ports": num_ports, "capex_ngn": capex,
            "opex_monthly_ngn": opex, "target_segment": segment,
            "demand_score": 50, "competitor_count": 0, "zone_name": zone_id,
        }
        cache_key = f"roi:{input_hash(params)}"
        cached = cache.get(cache_key)
        if cached:
            comparisons.append(cached)
        else:
            result = calculate_roi(params)
            cache.set(cache_key, result, CACHE_TTL)
            comparisons.append(result)

    return Response({"comparisons": comparisons})
