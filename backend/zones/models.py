from django.contrib.gis.db import models


class Zone(models.Model):
    TIERS = [("hot", "Hot"), ("warm", "Warm"), ("cold", "Cold")]

    zone_id = models.CharField(max_length=80, primary_key=True)
    name = models.CharField(max_length=200)
    geometry = models.PolygonField(srid=4326)
    centroid = models.PointField(srid=4326, null=True, blank=True)
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

    station_id = models.UUIDField(primary_key=True)
    name = models.CharField(max_length=200, blank=True)
    operator = models.CharField(max_length=200, blank=True)
    location = models.PointField(srid=4326)
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
