from drf_spectacular.utils import extend_schema, OpenApiParameter, inline_serializer
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response

USE_STUBS = False


def _find_zone_id(lat, lng):
    from zones.stubs import STUB_ZONES
    for zone in STUB_ZONES:
        coords = zone["geometry"]["coordinates"][0]
        lngs = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        if min(lngs) <= lng <= max(lngs) and min(lats) <= lat <= max(lats):
            return zone["zone_id"]
    return None

STUB_HEATMAP = {
    "type": "FeatureCollection",
    "features": [
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [3.4219, 6.4281]}, "properties": {"weight": 0.9}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [3.3742, 6.5059]}, "properties": {"weight": 0.7}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [3.3515, 6.6018]}, "properties": {"weight": 0.5}},
    ],
}


@extend_schema(
    summary="Ingest GPS ping",
    description="Ingest a GPS ping from the driver PWA. Returns the zone_id containing the ping.",
    request=inline_serializer("PingRequest", fields={
        "session_id": serializers.UUIDField(),
        "lat": serializers.FloatField(),
        "lng": serializers.FloatField(),
        "speed_kmh": serializers.FloatField(required=False),
        "recorded_at": serializers.DateTimeField(),
    }),
    responses={
        200: inline_serializer("PingResponse", fields={"success": serializers.BooleanField(), "zone_id": serializers.CharField(allow_null=True)}),
        400: OpenApiTypes.OBJECT,
    },
)
@api_view(["POST"])
def mobility_ping(request):
    required = ["session_id", "lat", "lng", "recorded_at"]
    missing = [f for f in required if f not in request.data]
    if missing:
        return Response(
            {"error": True, "message": f"Missing fields: {', '.join(missing)}", "code": "ERR_VALIDATION"},
            status=400,
        )

    if USE_STUBS:
        return Response({"success": True, "zone_id": "lagos_lekki_1"})

    from .models import MobilityPing

    lat = float(request.data["lat"])
    lng = float(request.data["lng"])
    zone_id = _find_zone_id(lat, lng)

    MobilityPing.objects.create(
        session_id=request.data["session_id"],
        location_lat=lat,
        location_lng=lng,
        speed_kmh=request.data.get("speed_kmh"),
        recorded_at=request.data["recorded_at"],
        zone_id=zone_id,
    )

    return Response({"success": True, "zone_id": zone_id})


@extend_schema(
    summary="Get mobility heatmap",
    description="Returns aggregated ping density as GeoJSON FeatureCollection. Koded renders this as the mobility overlay layer.",
    parameters=[
        OpenApiParameter("hours", OpenApiTypes.INT, description="24 (default) or 168 (7 days)"),
    ],
    responses={200: inline_serializer("Heatmap", fields={
        "type": serializers.CharField(),
        "features": serializers.ListField(),
    })},
)
@api_view(["GET"])
def mobility_heatmap(request):
    if USE_STUBS:
        return Response(STUB_HEATMAP)

    from .models import MobilityPing
    from django.utils import timezone
    from datetime import timedelta

    hours = int(request.query_params.get("hours", 24))
    since = timezone.now() - timedelta(hours=hours)
    pings = MobilityPing.objects.filter(recorded_at__gte=since)

    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [p.location_lng, p.location_lat]},
            "properties": {"weight": 1},
        }
        for p in pings
    ]

    return Response({"type": "FeatureCollection", "features": features})
