import json
from rest_framework import serializers
from .models import Zone, Station


class ZoneSerializer(serializers.ModelSerializer):
    centroid = serializers.SerializerMethodField()
    geometry = serializers.SerializerMethodField()

    class Meta:
        model = Zone
        fields = [
            "zone_id", "name", "geometry", "centroid",
            "demand_score", "tier", "pop_density",
            "poi_count", "ev_traffic", "station_count",
        ]

    def get_centroid(self, obj):
        if obj.centroid:
            return {"lat": obj.centroid.y, "lng": obj.centroid.x}
        return None

    def get_geometry(self, obj):
        return json.loads(obj.geometry.geojson)


class StationSerializer(serializers.ModelSerializer):
    lat = serializers.SerializerMethodField()
    lng = serializers.SerializerMethodField()
    type = serializers.CharField(source="station_type")
    ports = serializers.IntegerField(source="num_ports")

    class Meta:
        model = Station
        fields = ["station_id", "name", "operator", "lat", "lng", "type", "ports", "status", "utilisation", "last_seen"]

    def get_lat(self, obj):
        return obj.location.y

    def get_lng(self, obj):
        return obj.location.x
