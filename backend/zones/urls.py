from django.urls import path
from . import views

urlpatterns = [
    path("", views.zone_list),
    path("bbox/", views.zone_bbox),
    path("score/", views.score_arbitrary_location),
    path("<str:zone_id>/", views.zone_detail),
]
