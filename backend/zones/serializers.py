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
        if obj.centroid_lat is not None and obj.centroid_lng is not None:
            return {"lat": obj.centroid_lat, "lng": obj.centroid_lng}
        return None

    def get_geometry(self, obj):
        try:
            return json.loads(obj.geometry)
        except (ValueError, TypeError):
            return {}


class StationSerializer(serializers.ModelSerializer):
    lat = serializers.FloatField(source="location_lat")
    lng = serializers.FloatField(source="location_lng")
    type = serializers.CharField(source="station_type")
    ports = serializers.IntegerField(source="num_ports")

    class Meta:
        model = Station
        fields = ["station_id", "name", "operator", "lat", "lng", "type", "ports", "status", "utilisation", "last_seen"]
