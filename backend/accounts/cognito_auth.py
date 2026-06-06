"""
DRF authentication class that verifies Cognito ID tokens (RS256 JWT).
Fetches the JWKS from Cognito once per hour and caches in-process.
Auto-creates a local Django User on first login (keyed by email).
"""
import json
import logging
import time
from urllib.request import urlopen

from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

logger = logging.getLogger(__name__)
User = get_user_model()

_jwks_cache: dict = {}


def _get_jwks(pool_id: str, region: str) -> list:
    url = f"https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/jwks.json"
    cached = _jwks_cache.get(url)
    if cached and cached["expires"] > time.time():
        return cached["keys"]
    data = json.loads(urlopen(url, timeout=5).read())
    _jwks_cache[url] = {"keys": data["keys"], "expires": time.time() + 3600}
    return data["keys"]


class CognitoAuthentication(BaseAuthentication):
    def authenticate(self, request):
        from django.conf import settings

        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.startswith("Bearer "):
            return None

        token = header[7:]
        pool_id   = getattr(settings, "COGNITO_USER_POOL_ID", "")
        client_id = getattr(settings, "COGNITO_CLIENT_ID",    "")
        region    = getattr(settings, "AWS_DEFAULT_REGION",   "eu-west-1")

        if not pool_id or not client_id:
            return None

        try:
            from jose import jwt as jose_jwt
            from jose.exceptions import JWTError

            # If the token isn't a valid JWT at all, skip silently so AllowAny
            # views still work (e.g. old DRF tokens stored in localStorage).
            try:
                unverified_header = jose_jwt.get_unverified_header(token)
            except JWTError:
                return None

            keys = _get_jwks(pool_id, region)
            key = next((k for k in keys if k["kid"] == unverified_header["kid"]), None)
            if not key:
                raise AuthenticationFailed("Token signing key not found.")

            claims = jose_jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                audience=client_id,
                issuer=f"https://cognito-idp.{region}.amazonaws.com/{pool_id}",
            )

            email   = claims.get("email", "").lower()
            name    = claims.get("name", email)
            company = claims.get("custom:company", "")

            if not email:
                raise AuthenticationFailed("Token missing email claim.")

            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": email,
                    "name":     name,
                    "company":  company,
                },
            )
            if not created and (user.name != name or user.company != company):
                # Sync name/company on subsequent logins
                User.objects.filter(pk=user.pk).update(name=name, company=company)
                user.name    = name
                user.company = company

            return (user, token)

        except AuthenticationFailed:
            raise
        except Exception as exc:
            logger.warning("Cognito JWT verification failed: %s", exc)
            raise AuthenticationFailed("Invalid or expired token.")
