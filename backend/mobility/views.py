from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.utils.dateparse import parse_datetime

USE_STUBS = True  # flip to False in Phase 6 once DB is seeded

STUB_HEATMAP = {
    "type": "FeatureCollection",
    "features": [
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [3.4219, 6.4281]}, "properties": {"weight": 0.9}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [3.3742, 6.5059]}, "properties": {"weight": 0.7}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [3.3515, 6.6018]}, "properties": {"weight": 0.5}},
    ],
}


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
    from django.contrib.gis.geos import Point

    lat = float(request.data["lat"])
    lng = float(request.data["lng"])
    point = Point(lng, lat, srid=4326)

    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT zone_id FROM zones WHERE ST_Contains(geometry, ST_SetSRID(ST_MakePoint(%s, %s), 4326)) LIMIT 1",
            [lng, lat]
        )
        row = cursor.fetchone()
    zone_id = row[0] if row else None

    MobilityPing.objects.create(
        session_id=request.data["session_id"],
        location=point,
        speed_kmh=request.data.get("speed_kmh"),
        recorded_at=request.data["recorded_at"],
        zone_id=zone_id,
    )

    return Response({"success": True, "zone_id": zone_id})


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
            "geometry": {"type": "Point", "coordinates": [p.location.x, p.location.y]},
            "properties": {"weight": 1},
        }
        for p in pings
    ]

    return Response({"type": "FeatureCollection", "features": features})
