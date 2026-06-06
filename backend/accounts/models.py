from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    company = models.CharField(max_length=200, blank=True)
    role = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    vehicle = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = "user_profiles"

    def __str__(self):
        return f"{self.user.email} profile"
