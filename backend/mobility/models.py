import uuid
from django.db import models


class MobilityPing(models.Model):
    ping_id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    session_id = models.UUIDField()
    location_lat = models.FloatField(default=0)
    location_lng = models.FloatField(default=0)
    speed_kmh = models.DecimalField(max_digits=6, decimal_places=2, null=True)
    recorded_at = models.DateTimeField()
    zone_id = models.CharField(max_length=80, null=True, blank=True)

    class Meta:
        db_table = "mobility_pings"
        indexes = [
            models.Index(fields=["recorded_at"]),
            models.Index(fields=["zone_id"]),
        ]
