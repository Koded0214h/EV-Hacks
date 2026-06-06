from django.conf import settings
from django.db import models


class Zone(models.Model):
    TIERS = [("hot", "Hot"), ("warm", "Warm"), ("cold", "Cold")]

    zone_id = models.CharField(max_length=80, primary_key=True)
    name = models.CharField(max_length=200)
    geometry = models.TextField(default="{}")        # GeoJSON Polygon stored as JSON string
    centroid_lat = models.FloatField(null=True, blank=True)
    centroid_lng = models.FloatField(null=True, blank=True)
    demand_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tier = models.CharField(max_length=10, choices=TIERS, default="cold")
    pop_density = models.DecimalField(max_digits=12, decimal_places=2, null=True)
    poi_count = models.IntegerField(default=0)
    ev_traffic = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    station_count = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "zones"

    def __str__(self):
        return f"{self.name} ({self.zone_id})"


class Station(models.Model):
    STATION_TYPES = [("ac_level2", "AC Level 2"), ("dc_fast", "DC Fast"), ("swap", "Swap")]
    STATUS_CHOICES = [("available", "Available"), ("busy", "Busy"), ("offline", "Offline")]

    station_id = models.CharField(max_length=80, primary_key=True)
    name = models.CharField(max_length=200, blank=True)
    operator = models.CharField(max_length=200, blank=True)
    location_lat = models.FloatField(default=0)
    location_lng = models.FloatField(default=0)
    station_type = models.CharField(max_length=20, choices=STATION_TYPES)
    num_ports = models.IntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="available")
    utilisation = models.DecimalField(max_digits=4, decimal_places=3, default=0)
    last_seen = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "stations"

    def __str__(self):
        return f"{self.name} ({self.station_type})"


class PlantedStation(models.Model):
    STATION_TYPES = [("ac_level2", "AC Level 2"), ("dc_fast", "DC Fast"), ("swap", "Swap")]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="planted_stations")
    name = models.CharField(max_length=200, default="New Station")
    lat = models.FloatField()
    lng = models.FloatField()
    station_type = models.CharField(max_length=20, choices=STATION_TYPES, default="dc_fast")
    num_ports = models.IntegerField(default=4)
    status = models.CharField(max_length=20, default="planned")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "planted_stations"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} @ ({self.lat:.4f}, {self.lng:.4f})"
