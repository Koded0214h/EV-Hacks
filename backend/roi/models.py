import uuid
from django.db import models


class ROICache(models.Model):
    cache_id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    input_hash = models.CharField(max_length=64, unique=True)
    result_json = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "roi_cache"
