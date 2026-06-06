from django.core.cache import cache
from drf_spectacular.utils import extend_schema, OpenApiParameter, inline_serializer
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response
from zones.stubs import STUB_ROI_RESULT
from .calculator import calculate_roi, input_hash

USE_STUBS = False

REQUIRED_FIELDS = ["lat", "lng", "station_type", "num_ports", "capex_ngn", "opex_monthly_ngn", "target_segment"]
CACHE_TTL = 60 * 60 * 24

_scenario = inline_serializer("Scenario", fields={
    "daily_sessions_per_port": serializers.FloatField(),
    "avg_revenue_per_session_ngn": serializers.FloatField(),
    "monthly_gross_ngn": serializers.FloatField(),
    "monthly_net_ngn": serializers.FloatField(),
    "payback_months": serializers.FloatField(allow_null=True),
    "roi_12m_pct": serializers.FloatField(allow_null=True),
})
_roi_result = inline_serializer("ROIResult", fields={
    "location": serializers.DictField(),
    "station_type": serializers.CharField(),
    "num_ports": serializers.IntegerField(),
    "capex_ngn": serializers.FloatField(),
    "opex_monthly_ngn": serializers.FloatField(),
    "scenarios": serializers.DictField(),
    "demand_score": serializers.FloatField(),
    "competitor_count": serializers.IntegerField(),
    "recommendation": serializers.CharField(),
})


@extend_schema(
    summary="Calculate ROI",
    description="Deterministic ROI calculation returning 3 financial scenarios. Results cached in Redis — same inputs return instantly (< 500ms).",
    request=inline_serializer("ROIRequest", fields={
        "lat": serializers.FloatField(),
        "lng": serializers.FloatField(),
        "zone_id": serializers.CharField(required=False),
        "station_type": serializers.ChoiceField(choices=["ac_level2", "dc_fast"]),
        "num_ports": serializers.IntegerField(),
        "capex_ngn": serializers.FloatField(),
        "opex_monthly_ngn": serializers.FloatField(),
        "target_segment": serializers.ChoiceField(choices=["commercial", "private", "mixed"]),
        "demand_score": serializers.FloatField(required=False),
        "competitor_count": serializers.IntegerField(required=False),
    }),
    responses={200: _roi_result, 400: OpenApiTypes.OBJECT},
)
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


@extend_schema(
    summary="Compare ROI across zones",
    parameters=[
        OpenApiParameter("zone_ids", OpenApiTypes.STR, description="Comma-separated zone IDs e.g. lagos_lekki_1,lagos_yaba_1"),
        OpenApiParameter("station_type", OpenApiTypes.STR, description="ac_level2 | dc_fast"),
        OpenApiParameter("num_ports", OpenApiTypes.INT),
        OpenApiParameter("capex_ngn", OpenApiTypes.FLOAT),
        OpenApiParameter("opex_monthly_ngn", OpenApiTypes.FLOAT),
        OpenApiParameter("target_segment", OpenApiTypes.STR, description="commercial | private | mixed"),
    ],
    responses={200: inline_serializer("ROICompare", fields={"comparisons": serializers.ListField()})},
)
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
