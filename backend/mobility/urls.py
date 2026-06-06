from django.urls import path
from . import views

urlpatterns = [
    path("ping/", views.mobility_ping),
    path("heatmap/", views.mobility_heatmap),
]
