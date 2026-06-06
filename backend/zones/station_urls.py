from django.urls import path
from . import views

urlpatterns = [
    path("", views.station_list),
    path("report/", views.station_report),
]
