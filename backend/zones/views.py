from rest_framework.decorators import api_view
from rest_framework.response import Response
from .stubs import STUB_ZONES, STUB_STATIONS

USE_STUBS = True  # flip to False in Phase 4 once DB is seeded


@api_view(["GET"])
def zone_list(request):
    if USE_STUBS:
        return Response({"count": len(STUB_ZONES), "zones": STUB_ZONES})

    from .models import Zone
    from .serializers import ZoneSerializer
    zones = Zone.objects.all()
    return Response({"count": zones.count(), "zones": ZoneSerializer(zones, many=True).data})


@api_view(["GET"])
def zone_detail(request, zone_id):
    if USE_STUBS:
        zone = next((z for z in STUB_ZONES if z["zone_id"] == zone_id), None)
        if not zone:
            return Response({"error": True, "message": "Zone not found", "code": "ERR_NOT_FOUND"}, status=404)
        return Response(zone)

    from .models import Zone
    from .serializers import ZoneSerializer
    from django.shortcuts import get_object_or_404
    zone = get_object_or_404(Zone, zone_id=zone_id)
    return Response(ZoneSerializer(zone).data)


@api_view(["GET"])
def zone_bbox(request):
    if USE_STUBS:
        return Response({"zones": STUB_ZONES})

    from .models import Zone
    from .serializers import ZoneSerializer
    from django.contrib.gis.geos import Polygon

    sw_lat = float(request.query_params.get("sw_lat", 0))
    sw_lng = float(request.query_params.get("sw_lng", 0))
    ne_lat = float(request.query_params.get("ne_lat", 0))
    ne_lng = float(request.query_params.get("ne_lng", 0))

    envelope = Polygon.from_bbox((sw_lng, sw_lat, ne_lng, ne_lat))
    envelope.srid = 4326
    zones = Zone.objects.filter(geometry__intersects=envelope)
    return Response({"zones": ZoneSerializer(zones, many=True).data})


@api_view(["GET"])
def station_list(request):
    if USE_STUBS:
        return Response({"count": len(STUB_STATIONS), "stations": STUB_STATIONS})

    from .models import Station
    from .serializers import StationSerializer
    from django.contrib.gis.geos import Point
    from django.contrib.gis.db.models.functions import Distance

    qs = Station.objects.all()

    lat = request.query_params.get("lat")
    lng = request.query_params.get("lng")
    radius_km = request.query_params.get("radius_km")
    if lat and lng and radius_km:
        point = Point(float(lng), float(lat), srid=4326)
        qs = qs.filter(location__distance_lte=(point, float(radius_km) * 1000))

    station_type = request.query_params.get("type")
    if station_type:
        qs = qs.filter(station_type=station_type)

    status = request.query_params.get("status")
    if status:
        qs = qs.filter(status=status)

    return Response({"count": qs.count(), "stations": StationSerializer(qs, many=True).data})


@api_view(["POST"])
def station_report(request):
    station_id = request.data.get("station_id")
    new_status = request.data.get("status")
    if not station_id or not new_status:
        return Response(
            {"error": True, "message": "station_id and status are required", "code": "ERR_VALIDATION"},
            status=400,
        )

    if USE_STUBS:
        return Response({"success": True, "station_id": station_id, "new_status": new_status})

    from .models import Station
    updated = Station.objects.filter(station_id=station_id).update(status=new_status)
    if not updated:
        return Response({"error": True, "message": "Station not found", "code": "ERR_NOT_FOUND"}, status=404)
    return Response({"success": True, "station_id": station_id, "new_status": new_status})
