"""Jitsi Meet JWT token service.

Generates a signed JWT that Jitsi Meet (public or self-hosted) uses to
authenticate a participant and grant moderator rights to teachers.

When JITSI_APP_ID / JITSI_JWT_SECRET are not configured the service falls
back to returning an *unsigned* public-room URL — the meeting still works on
the public meet.jit.si server, just without authentication.  This lets the
academy run live classes from day one without any Jitsi account, and upgrade
to authenticated rooms later by simply adding the two env vars.

JWT structure follows the Jitsi Meet JWT authentication spec:
  https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-docker/#authentication-using-jwt
"""

import uuid
from datetime import datetime, timedelta, timezone

from jose import jwt

from app.core.config import settings


class JitsiService:
    # Token is valid for 4 hours — long enough for any class session.
    TOKEN_TTL_HOURS = 4

    def _is_configured(self) -> bool:
        return bool(settings.JITSI_APP_ID and settings.JITSI_JWT_SECRET)

    def _room_name(self, session_id: uuid.UUID) -> str:
        """Deterministic, URL-safe room name derived from the session UUID."""
        return f"session-{session_id}"

    def _meeting_url(self, room: str) -> str:
        return f"https://{settings.JITSI_DOMAIN}/{room}"

    def generate_token(
        self,
        session_id: uuid.UUID,
        user_name: str,
        user_email: str,
        is_moderator: bool,
    ) -> dict:
        """Return a dict with ``meeting_url``, ``room_name``, and optionally
        ``jwt_token`` (None when Jitsi JWT is not configured)."""
        room = self._room_name(session_id)
        meeting_url = self._meeting_url(room)

        if not self._is_configured():
            # Unauthenticated public room — works on meet.jit.si without a JWT.
            return {
                "meeting_url": meeting_url,
                "room_name": room,
                "jwt_token": None,
                "authenticated": False,
            }

        now = datetime.now(timezone.utc)
        exp = now + timedelta(hours=self.TOKEN_TTL_HOURS)

        payload = {
            "context": {
                "user": {
                    "name": user_name,
                    "email": user_email,
                    "moderator": is_moderator,
                }
            },
            "aud": "jitsi",
            "iss": settings.JITSI_APP_ID,
            "sub": settings.JITSI_DOMAIN,
            "room": room,
            "exp": int(exp.timestamp()),
            "nbf": int(now.timestamp()),
        }

        token = jwt.encode(
            payload,
            settings.JITSI_JWT_SECRET,
            algorithm="HS256",
        )

        # When JWT auth is enabled the URL must carry the token so the Jitsi
        # client picks it up automatically on load.
        authenticated_url = f"{meeting_url}?jwt={token}"

        return {
            "meeting_url": authenticated_url,
            "room_name": room,
            "jwt_token": token,
            "authenticated": True,
        }