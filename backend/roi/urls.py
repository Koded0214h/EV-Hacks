from django.urls import path
from . import views

urlpatterns = [
    path("calculate/", views.roi_calculate),
    path("compare/", views.roi_compare),
]
