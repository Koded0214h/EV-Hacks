from django.conf import settings
from django.db import models


class ChargingSession(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="charging_sessions"
    )
    station_id = models.CharField(max_length=80)
    station_name = models.CharField(max_length=200, blank=True)
    price_per_kwh = models.FloatField(default=185.0)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)
    kwh_delivered = models.FloatField(null=True, blank=True)
    cost_ngn = models.FloatField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "charging_sessions"
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.user} @ {self.station_name} ({self.started_at:%Y-%m-%d})"
