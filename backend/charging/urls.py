from django.urls import path
from . import views

urlpatterns = [
    path("start/", views.start_session),
    path("stop/", views.stop_session),
    path("history/", views.session_history),
]
