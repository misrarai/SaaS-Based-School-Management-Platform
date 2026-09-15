import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import NamedTuple
from urllib.parse import urlencode

import httpx
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.google_calendar import GoogleCalendarConnection
from app.repositories.google_calendar_repo import GoogleCalendarConnectionRepository

logger = logging.getLogger(__name__)

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"
SCOPE = "https://www.googleapis.com/auth/calendar.events"
STATE_TTL_MINUTES = 10


class GoogleEventResult(NamedTuple):
    success: bool
    event_id: str | None
    meet_link: str | None
    calendar_id: str | None
    error: str | None


class GoogleCalendarService:
    """All Google OAuth/Calendar-API mechanics live here — creating a Meet-enabled calendar
    event, refreshing access tokens, storing/reading a tenant's connection. This service knows
    nothing about classes, sessions, teachers or students; ScheduleService owns that and calls
    into this one purely for "make/update/remove a Google Meet event". Talks to Google over plain
    REST (httpx), matching how WhatsAppService/JazzCashService integrate with their external APIs
    elsewhere in this codebase, rather than pulling in the google-api-python-client SDK.

    OAuth is authorize-once per tenant: an admin visits the URL from get_authorization_url(),
    Google redirects back to our callback with a code, we exchange it for a refresh token and
    store only that (never the short-lived access token) in google_calendar_connections. Every
    subsequent Calendar API call fetches a fresh access token from that refresh token — the admin
    is never asked to re-authorize."""

    def __init__(self, db: Session):
        self.db = db
        self.connections = GoogleCalendarConnectionRepository(db)

    def is_configured(self) -> bool:
        if settings.ENVIRONMENT == "testing":
            return False
        return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and settings.GOOGLE_REDIRECT_URI)

    # --- OAuth state (CSRF-protects the callback, and carries which tenant/admin is connecting —
    # the callback is a plain browser redirect from Google with no auth headers of ours) ---

    def encode_state(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> str:
        payload = {
            "tenant_id": str(tenant_id),
            "user_id": str(user_id),
            "purpose": "google_oauth_state",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=STATE_TTL_MINUTES),
        }
        return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    def decode_state(self, state: str) -> tuple[uuid.UUID, uuid.UUID] | None:
        try:
            payload = jwt.decode(state, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        except JWTError:
            return None
        if payload.get("purpose") != "google_oauth_state":
            return None
        try:
            return uuid.UUID(payload["tenant_id"]), uuid.UUID(payload["user_id"])
        except (KeyError, ValueError):
            return None

    def get_authorization_url(self, state: str) -> str:
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": SCOPE,
            "access_type": "offline",
            # Forces Google to re-issue a refresh token even if this Google account already
            # authorized the app before — without this, a re-connect could silently fail to
            # yield a new refresh token and leave us with none.
            "prompt": "consent",
            "state": state,
        }
        return f"{AUTH_URL}?{urlencode(params)}"

    # --- Token exchange / connection storage ---

    def exchange_code_for_tokens(self, code: str) -> dict | None:
        try:
            response = httpx.post(
                TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
                timeout=15.0,
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            logger.warning("Google OAuth code exchange failed: %s", exc)
            return None

    def fetch_account_email(self, access_token: str) -> str | None:
        try:
            response = httpx.get(USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}, timeout=10.0)
            response.raise_for_status()
            return response.json().get("email")
        except httpx.HTTPError:
            return None

    def save_connection(
        self, tenant_id: uuid.UUID, user_id: uuid.UUID, refresh_token: str, account_email: str | None
    ) -> GoogleCalendarConnection:
        existing = self.connections.get_by_tenant(tenant_id)
        if existing is not None:
            existing.refresh_token = refresh_token
            existing.google_account_email = account_email
            existing.connected_by_user_id = user_id
            connection = existing
        else:
            connection = self.connections.create(
                GoogleCalendarConnection(
                    tenant_id=tenant_id,
                    connected_by_user_id=user_id,
                    google_account_email=account_email,
                    refresh_token=refresh_token,
                    calendar_id=settings.GOOGLE_CALENDAR_ID,
                )
            )
        self.db.commit()
        self.db.refresh(connection)
        return connection

    def get_connection_status(self, tenant_id: uuid.UUID) -> dict:
        connection = self.connections.get_by_tenant(tenant_id)
        if connection is None:
            return {"connected": False, "google_account_email": None, "calendar_id": None}
        return {
            "connected": True,
            "google_account_email": connection.google_account_email,
            "calendar_id": connection.calendar_id,
        }

    def disconnect(self, tenant_id: uuid.UUID) -> None:
        connection = self.connections.get_by_tenant(tenant_id)
        if connection is not None:
            self.db.delete(connection)
            self.db.commit()

    def _get_access_token(self, tenant_id: uuid.UUID) -> tuple[str, str] | None:
        """Returns (access_token, calendar_id), or None if not connected / refresh failed."""
        connection = self.connections.get_by_tenant(tenant_id)
        if connection is None:
            return None
        try:
            response = httpx.post(
                TOKEN_URL,
                data={
                    "refresh_token": connection.refresh_token,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "grant_type": "refresh_token",
                },
                timeout=15.0,
            )
            response.raise_for_status()
            return response.json()["access_token"], connection.calendar_id
        except httpx.HTTPError as exc:
            logger.warning("Google access-token refresh failed for tenant %s: %s", tenant_id, exc)
            return None
        except KeyError:
            logger.warning("Google token refresh response missing access_token for tenant %s", tenant_id)
            return None

    # --- Calendar events ---

    @staticmethod
    def _parse_error(response: httpx.Response) -> str:
        try:
            return response.json().get("error", {}).get("message") or f"Google API returned HTTP {response.status_code}"
        except ValueError:
            return f"Google API returned HTTP {response.status_code}"

    def _event_body(self, summary: str, description: str, start_dt: datetime, end_dt: datetime, request_id: str) -> dict:
        return {
            "summary": summary,
            "description": description,
            "start": {"dateTime": start_dt.isoformat(), "timeZone": "Asia/Karachi"},
            "end": {"dateTime": end_dt.isoformat(), "timeZone": "Asia/Karachi"},
            "conferenceData": {
                "createRequest": {
                    "requestId": request_id,
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            },
        }

    @staticmethod
    def _extract_meet_link(event: dict) -> str | None:
        for entry_point in event.get("conferenceData", {}).get("entryPoints", []):
            if entry_point.get("entryPointType") == "video":
                return entry_point.get("uri")
        return event.get("hangoutLink")

    def create_meet_event(
        self, tenant_id: uuid.UUID, summary: str, description: str, start_dt: datetime, end_dt: datetime, request_id: str
    ) -> GoogleEventResult:
        token = self._get_access_token(tenant_id)
        if token is None:
            return GoogleEventResult(False, None, None, None, "Google Calendar is not connected for this school")
        access_token, calendar_id = token

        try:
            response = httpx.post(
                f"{CALENDAR_API_BASE}/calendars/{calendar_id}/events",
                params={"conferenceDataVersion": 1},
                headers={"Authorization": f"Bearer {access_token}"},
                json=self._event_body(summary, description, start_dt, end_dt, request_id),
                timeout=15.0,
            )
            response.raise_for_status()
            event = response.json()
            meet_link = self._extract_meet_link(event)
            if meet_link is None:
                return GoogleEventResult(False, event.get("id"), None, calendar_id, "Google did not return a Meet link")
            return GoogleEventResult(True, event["id"], meet_link, calendar_id, None)
        except httpx.HTTPStatusError as exc:
            error = self._parse_error(exc.response)
            logger.warning("Google Calendar event creation failed for tenant %s: %s", tenant_id, error)
            return GoogleEventResult(False, None, None, None, error)
        except httpx.HTTPError as exc:
            logger.warning("Google Calendar API request failed for tenant %s: %s", tenant_id, exc)
            return GoogleEventResult(False, None, None, None, "Google Calendar API is unavailable")

    def update_calendar_event(
        self,
        tenant_id: uuid.UUID,
        event_id: str,
        calendar_id: str,
        summary: str,
        description: str,
        start_dt: datetime,
        end_dt: datetime,
    ) -> GoogleEventResult:
        token = self._get_access_token(tenant_id)
        if token is None:
            return GoogleEventResult(False, event_id, None, calendar_id, "Google Calendar is not connected for this school")
        access_token, _ = token

        body = {
            "summary": summary,
            "description": description,
            "start": {"dateTime": start_dt.isoformat(), "timeZone": "Asia/Karachi"},
            "end": {"dateTime": end_dt.isoformat(), "timeZone": "Asia/Karachi"},
        }
        try:
            response = httpx.patch(
                f"{CALENDAR_API_BASE}/calendars/{calendar_id}/events/{event_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                json=body,
                timeout=15.0,
            )
            response.raise_for_status()
            event = response.json()
            return GoogleEventResult(True, event_id, self._extract_meet_link(event), calendar_id, None)
        except httpx.HTTPStatusError as exc:
            error = self._parse_error(exc.response)
            logger.warning("Google Calendar event update failed for tenant %s: %s", tenant_id, error)
            return GoogleEventResult(False, event_id, None, calendar_id, error)
        except httpx.HTTPError as exc:
            logger.warning("Google Calendar API request failed for tenant %s: %s", tenant_id, exc)
            return GoogleEventResult(False, event_id, None, calendar_id, "Google Calendar API is unavailable")

    def delete_calendar_event(self, tenant_id: uuid.UUID, event_id: str, calendar_id: str) -> bool:
        token = self._get_access_token(tenant_id)
        if token is None:
            return False
        access_token, _ = token
        try:
            response = httpx.delete(
                f"{CALENDAR_API_BASE}/calendars/{calendar_id}/events/{event_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=15.0,
            )
            # Google returns 410 Gone if the event was already deleted on their side — treat that
            # as success too, since the end state (no event) is what we wanted.
            if response.status_code not in (204, 410):
                response.raise_for_status()
            return True
        except httpx.HTTPError as exc:
            logger.warning("Google Calendar event deletion failed for tenant %s: %s", tenant_id, exc)
            return False
