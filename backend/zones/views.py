from drf_spectacular.utils import extend_schema, OpenApiParameter, inline_serializer
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .stubs import STUB_ZONES, STUB_STATIONS

USE_STUBS = True  # flip to False in Phase 4 once DB is seeded

_zone = inline_serializer("ZoneFeature", fields={
    "zone_id": serializers.CharField(),
    "name": serializers.CharField(),
    "geometry": serializers.DictField(),
    "centroid": serializers.DictField(),
    "demand_score": serializers.FloatField(),
    "tier": serializers.CharField(),
    "pop_density": serializers.FloatField(),
    "poi_count": serializers.IntegerField(),
    "ev_traffic": serializers.FloatField(),
    "station_count": serializers.IntegerField(),
})
_zone_list = inline_serializer("ZoneList", fields={"count": serializers.IntegerField(), "zones": serializers.ListField()})
_station = inline_serializer("StationRecord", fields={
    "station_id": serializers.CharField(),
    "name": serializers.CharField(),
    "operator": serializers.CharField(),
    "lat": serializers.FloatField(),
    "lng": serializers.FloatField(),
    "type": serializers.CharField(),
    "ports": serializers.IntegerField(),
    "status": serializers.CharField(),
    "utilisation": serializers.FloatField(),
    "last_seen": serializers.DateTimeField(),
})
_station_list = inline_serializer("StationList", fields={"count": serializers.IntegerField(), "stations": serializers.ListField()})


@extend_schema(summary="List all zones", responses={200: _zone_list})
@api_view(["GET"])
def zone_list(request):
    if USE_STUBS:
        return Response({"count": len(STUB_ZONES), "zones": STUB_ZONES})

    from .models import Zone
    from .serializers import ZoneSerializer
    zones = Zone.objects.all()
    return Response({"count": zones.count(), "zones": ZoneSerializer(zones, many=True).data})


@extend_schema(summary="Get zone by ID", responses={200: _zone, 404: OpenApiTypes.OBJECT})
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


@extend_schema(
    summary="List zones in bounding box",
    parameters=[
        OpenApiParameter("sw_lat", OpenApiTypes.FLOAT, description="South-west latitude"),
        OpenApiParameter("sw_lng", OpenApiTypes.FLOAT, description="South-west longitude"),
        OpenApiParameter("ne_lat", OpenApiTypes.FLOAT, description="North-east latitude"),
        OpenApiParameter("ne_lng", OpenApiTypes.FLOAT, description="North-east longitude"),
    ],
    responses={200: inline_serializer("ZoneBbox", fields={"zones": serializers.ListField()})},
)
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


@extend_schema(
    summary="List stations",
    parameters=[
        OpenApiParameter("lat", OpenApiTypes.FLOAT, description="Filter by proximity — latitude"),
        OpenApiParameter("lng", OpenApiTypes.FLOAT, description="Filter by proximity — longitude"),
        OpenApiParameter("radius_km", OpenApiTypes.FLOAT, description="Radius in km"),
        OpenApiParameter("type", OpenApiTypes.STR, description="ac_level2 | dc_fast | swap"),
        OpenApiParameter("status", OpenApiTypes.STR, description="available | busy | offline"),
    ],
    responses={200: _station_list},
)
@api_view(["GET"])
def station_list(request):
    if USE_STUBS:
        return Response({"count": len(STUB_STATIONS), "stations": STUB_STATIONS})

    from .models import Station
    from .serializers import StationSerializer
    from django.contrib.gis.geos import Point

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


@extend_schema(
    summary="Report station status",
    request=inline_serializer("StationReport", fields={
        "station_id": serializers.CharField(),
        "status": serializers.ChoiceField(choices=["available", "busy", "offline"]),
        "reporter_type": serializers.ChoiceField(choices=["driver", "operator"]),
        "note": serializers.CharField(required=False),
    }),
    responses={
        200: inline_serializer("StationReportResponse", fields={
            "success": serializers.BooleanField(),
            "station_id": serializers.CharField(),
            "new_status": serializers.CharField(),
        }),
        400: OpenApiTypes.OBJECT,
    },
)
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


@extend_schema(summary="Plant a new investor station", responses={201: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT})
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def plant_station(request):
    lat = request.data.get("lat")
    lng = request.data.get("lng")
    if lat is None or lng is None:
        return Response({"error": True, "message": "lat and lng required"}, status=400)

    from .models import PlantedStation
    ps = PlantedStation.objects.create(
        user=request.user,
        name=request.data.get("name", "New Station"),
        lat=float(lat),
        lng=float(lng),
        station_type=request.data.get("station_type", "dc_fast"),
        num_ports=int(request.data.get("num_ports", 4)),
    )
    return Response({
        "station_id": f"planted-{ps.id}",
        "name": ps.name,
        "lat": ps.lat,
        "lng": ps.lng,
        "type": ps.station_type,
        "ports": ps.num_ports,
        "status": ps.status,
        "operator": request.user.username,
        "planted": True,
    }, status=201)


@extend_schema(summary="List investor's planted stations", responses={200: OpenApiTypes.OBJECT})
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def planted_list(request):
    from .models import PlantedStation
    qs = PlantedStation.objects.filter(user=request.user)
    stations = [{
        "station_id": f"planted-{p.id}",
        "name": p.name,
        "lat": p.lat,
        "lng": p.lng,
        "type": p.station_type,
        "ports": p.num_ports,
        "status": p.status,
        "operator": request.user.username,
        "planted": True,
    } for p in qs]
    return Response({"count": len(stations), "stations": stations})
