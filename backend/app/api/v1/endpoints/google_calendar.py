import logging

from fastapi import APIRouter, Depends, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import require_role
from app.core.exceptions import ConflictError
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.google_calendar import GoogleAuthorizationUrlOut, GoogleCalendarStatusOut
from app.services.google_calendar_service import GoogleCalendarService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations/google-calendar", tags=["google-calendar"])


@router.get("/status", response_model=GoogleCalendarStatusOut)
def get_status(
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> GoogleCalendarStatusOut:
    return GoogleCalendarService(db).get_connection_status(current_user.tenant_id)


@router.get("/authorize", response_model=GoogleAuthorizationUrlOut)
def authorize(
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> GoogleAuthorizationUrlOut:
    """Returns the Google consent-screen URL for this tenant's admin to open — authorizing once
    is enough; the resulting refresh token is reused for every Meet link created afterwards."""
    service = GoogleCalendarService(db)
    if not service.is_configured():
        raise ConflictError("Google Calendar integration is not configured on this server")
    state = service.encode_state(current_user.tenant_id, current_user.id)
    return GoogleAuthorizationUrlOut(authorization_url=service.get_authorization_url(state))


@router.get("/callback", include_in_schema=False)
def callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    """Public endpoint — Google redirects the admin's browser here after they approve/deny
    access, carrying no auth token of ours. state (signed, short-lived) is what tells us which
    tenant/admin is connecting; a missing/invalid/expired state is rejected outright."""
    settings_url = f"{settings.FRONTEND_URL}/admin/schedule"

    if error or code is None or state is None:
        return RedirectResponse(f"{settings_url}?google=denied", status_code=status.HTTP_303_SEE_OTHER)

    service = GoogleCalendarService(db)
    decoded = service.decode_state(state)
    if decoded is None:
        return RedirectResponse(f"{settings_url}?google=error", status_code=status.HTTP_303_SEE_OTHER)
    tenant_id, user_id = decoded

    tokens = service.exchange_code_for_tokens(code)
    if tokens is None or "refresh_token" not in tokens:
        # Google omits refresh_token when this account already granted consent and "prompt=consent"
        # wasn't honored for some reason — surfaced to the admin as a plain retry prompt.
        logger.warning("Google OAuth callback for tenant %s did not yield a refresh token", tenant_id)
        return RedirectResponse(f"{settings_url}?google=error", status_code=status.HTTP_303_SEE_OTHER)

    account_email = service.fetch_account_email(tokens["access_token"]) if "access_token" in tokens else None
    service.save_connection(tenant_id, user_id, tokens["refresh_token"], account_email)

    return RedirectResponse(f"{settings_url}?google=connected", status_code=status.HTTP_303_SEE_OTHER)


@router.delete("/disconnect", status_code=status.HTTP_204_NO_CONTENT)
def disconnect(
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> None:
    GoogleCalendarService(db).disconnect(current_user.tenant_id)
