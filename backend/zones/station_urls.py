from django.urls import path
from . import views

urlpatterns = [
    path("", views.station_list),
    path("report/", views.station_report),
    path("plant/", views.plant_station),
    path("planted/", views.planted_list),
]
