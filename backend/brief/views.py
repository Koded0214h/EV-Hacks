import uuid
import requests
from django.conf import settings
from drf_spectacular.utils import extend_schema, inline_serializer
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response
from zones.stubs import STUB_BRIEF

USE_STUBS = True


@extend_schema(
    summary="Generate AI investor brief",
    description="Proxies to Fluxx's internal LLM service. Returns AI-generated investor brief. Target: < 8 seconds.",
    request=inline_serializer("BriefRequest", fields={
        "zone_id": serializers.CharField(),
        "roi_result": serializers.DictField(),
    }),
    responses={
        200: inline_serializer("AIBriefResult", fields={
            "brief_id": serializers.UUIDField(),
            "zone_id": serializers.CharField(),
            "generated_at": serializers.DateTimeField(),
            "headline": serializers.CharField(),
            "summary": serializers.CharField(),
            "key_metrics": serializers.ListField(),
            "risk_factors": serializers.ListField(child=serializers.CharField()),
            "recommendation": serializers.CharField(),
        }),
        400: OpenApiTypes.OBJECT,
        502: OpenApiTypes.OBJECT,
    },
)
@api_view(["POST"])
def brief_generate(request):
    zone_id = request.data.get("zone_id")
    roi_result = request.data.get("roi_result")

    if not zone_id or not roi_result:
        return Response(
            {"error": True, "message": "zone_id and roi_result are required", "code": "ERR_VALIDATION"},
            status=400,
        )

    if USE_STUBS:
        return Response(STUB_BRIEF)

    from zones.models import Zone
    from zones.serializers import ZoneSerializer
    from django.shortcuts import get_object_or_404

    zone = get_object_or_404(Zone, zone_id=zone_id)
    zone_data = ZoneSerializer(zone).data

    try:
        resp = requests.post(
            settings.FLUXX_BRIEF_URL,
            json={"zone": zone_data, "roi": roi_result},
            timeout=30,
        )
        resp.raise_for_status()
        result = resp.json()
        result.setdefault("brief_id", str(uuid.uuid4()))
        result.setdefault("zone_id", zone_id)
        return Response(result)
    except requests.exceptions.Timeout:
        return Response({"error": True, "message": "AI service timed out", "code": "ERR_TIMEOUT"}, status=504)
    except requests.exceptions.RequestException as e:
        return Response({"error": True, "message": str(e), "code": "ERR_BRIEF_SERVICE"}, status=502)
