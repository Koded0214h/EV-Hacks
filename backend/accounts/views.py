from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, inline_serializer
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers
from .models import UserProfile


def _user_data(user):
    profile = getattr(user, "profile", None)
    name = user.get_full_name().strip() or user.username
    return {
        "id": user.id,
        "name": name,
        "email": user.email,
        "company": profile.company if profile else "",
        "role": profile.role if profile else "",
        "phone": profile.phone if profile else "",
        "vehicle": profile.vehicle if profile else "",
    }


@extend_schema(
    summary="Register a new account",
    request=inline_serializer("RegisterRequest", fields={
        "name": serializers.CharField(),
        "email": serializers.EmailField(),
        "password": serializers.CharField(),
        "company": serializers.CharField(required=False),
        "role": serializers.CharField(required=False),
        "phone": serializers.CharField(required=False),
        "vehicle": serializers.CharField(required=False),
    }),
    responses={201: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT},
)
@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    email = request.data.get("email", "").strip().lower()
    password = request.data.get("password", "")
    name = request.data.get("name", "").strip()

    if not email or not password:
        return Response(
            {"error": True, "message": "Email and password are required", "code": "ERR_VALIDATION"},
            status=400,
        )
    if len(password) < 6:
        return Response(
            {"error": True, "message": "Password must be at least 6 characters", "code": "ERR_VALIDATION"},
            status=400,
        )
    if User.objects.filter(username=email).exists():
        return Response(
            {"error": True, "message": "An account with this email already exists", "code": "ERR_DUPLICATE"},
            status=400,
        )

    parts = name.split(" ", 1)
    user = User.objects.create_user(
        username=email,
        email=email,
        password=password,
        first_name=parts[0],
        last_name=parts[1] if len(parts) > 1 else "",
    )
    UserProfile.objects.create(
        user=user,
        company=request.data.get("company", ""),
        role=request.data.get("role", ""),
        phone=request.data.get("phone", ""),
        vehicle=request.data.get("vehicle", ""),
    )

    refresh = RefreshToken.for_user(user)
    return Response({"access": str(refresh.access_token), "user": _user_data(user)}, status=201)


@extend_schema(
    summary="Log in",
    request=inline_serializer("LoginRequest", fields={
        "email": serializers.EmailField(),
        "password": serializers.CharField(),
    }),
    responses={200: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT},
)
@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    email = request.data.get("email", "").strip().lower()
    password = request.data.get("password", "")

    if not email or not password:
        return Response(
            {"error": True, "message": "Email and password are required", "code": "ERR_VALIDATION"},
            status=400,
        )

    user = authenticate(username=email, password=password)
    if not user:
        return Response(
            {"error": True, "message": "Invalid email or password", "code": "ERR_AUTH"},
            status=401,
        )

    refresh = RefreshToken.for_user(user)
    return Response({"access": str(refresh.access_token), "user": _user_data(user)})


@extend_schema(summary="Log out", responses={200: OpenApiTypes.OBJECT})
@api_view(["POST"])
@permission_classes([AllowAny])
def logout(request):
    return Response({"success": True})


@extend_schema(summary="Get current user", responses={200: OpenApiTypes.OBJECT})
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(_user_data(request.user))


@extend_schema(
    summary="Update profile",
    request=inline_serializer("UpdateProfileRequest", fields={
        "name": serializers.CharField(required=False),
        "company": serializers.CharField(required=False),
        "role": serializers.CharField(required=False),
        "phone": serializers.CharField(required=False),
        "vehicle": serializers.CharField(required=False),
    }),
    responses={200: OpenApiTypes.OBJECT},
)
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_profile(request):
    user = request.user
    if "name" in request.data:
        parts = request.data["name"].strip().split(" ", 1)
        user.first_name = parts[0]
        user.last_name = parts[1] if len(parts) > 1 else ""
        user.save(update_fields=["first_name", "last_name"])

    profile, _ = UserProfile.objects.get_or_create(user=user)
    for field in ("company", "role", "phone", "vehicle"):
        if field in request.data:
            setattr(profile, field, request.data[field])
    profile.save()

    return Response(_user_data(user))
