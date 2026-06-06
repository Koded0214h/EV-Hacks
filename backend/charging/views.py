from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import ChargingSession


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_session(request):
    station_id = request.data.get("station_id")
    if not station_id:
        return Response({"error": True, "message": "station_id required"}, status=400)

    # Expire any dangling active session for this user
    ChargingSession.objects.filter(user=request.user, is_active=True).update(
        is_active=False, ended_at=timezone.now()
    )

    session = ChargingSession.objects.create(
        user=request.user,
        station_id=station_id,
        station_name=request.data.get("station_name", ""),
        price_per_kwh=float(request.data.get("price_per_kwh", 185.0)),
    )
    return Response({"session_id": session.id, "started_at": session.started_at.isoformat()}, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def stop_session(request):
    session_id = request.data.get("session_id")
    kwh = float(request.data.get("kwh_delivered", 0))
    duration = int(request.data.get("duration_seconds", 0))

    try:
        session = ChargingSession.objects.get(id=session_id, user=request.user, is_active=True)
    except ChargingSession.DoesNotExist:
        return Response({"error": True, "message": "Active session not found"}, status=404)

    cost = round(kwh * session.price_per_kwh)
    session.ended_at = timezone.now()
    session.duration_seconds = duration
    session.kwh_delivered = kwh
    session.cost_ngn = cost
    session.is_active = False
    session.save()

    return Response({
        "session_id": session.id,
        "duration_seconds": duration,
        "kwh_delivered": kwh,
        "cost_ngn": cost,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def session_history(request):
    sessions = ChargingSession.objects.filter(user=request.user, is_active=False)[:50]
    data = [
        {
            "session_id": s.id,
            "station_id": s.station_id,
            "station_name": s.station_name or s.station_id,
            "started_at": s.started_at.isoformat(),
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "duration_seconds": s.duration_seconds,
            "kwh_delivered": s.kwh_delivered,
            "cost_ngn": s.cost_ngn,
            "price_per_kwh": s.price_per_kwh,
        }
        for s in sessions
    ]
    total_kwh = sum(s["kwh_delivered"] or 0 for s in data)
    total_cost = sum(s["cost_ngn"] or 0 for s in data)
    return Response({
        "sessions": data,
        "total_kwh": round(total_kwh, 2),
        "total_cost_ngn": int(total_cost),
        "session_count": len(data),
    })
