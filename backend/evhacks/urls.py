from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView


def health_check(request):
    return JsonResponse({"status": "ok", "version": "1.0.0"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", health_check),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/zones/", include("zones.urls")),
    path("api/v1/stations/", include("zones.station_urls")),
    path("api/v1/roi/", include("roi.urls")),
    path("api/v1/mobility/", include("mobility.urls")),
    path("api/v1/brief/", include("brief.urls")),
    path("api/v1/charging/", include("charging.urls")),
    # Swagger
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
