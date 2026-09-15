from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import (
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_secure_token,
    hash_password,
    hash_token,
    verify_password,
    InvalidTokenError,
)
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.repositories.tenant_repo import TenantRepository
from app.schemas.auth import TokenPair
from app.services.email_service import EmailService

EMAIL_VERIFICATION_EXPIRE_HOURS = 24
PASSWORD_RESET_EXPIRE_MINUTES = 30


def _as_aware_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.users = UserRepository(db)
        self.tenants = TenantRepository(db)
        self.emails = EmailService()

    def _issue_tokens(self, user: User) -> TokenPair:
        common = dict(
            subject=str(user.id),
            tenant_id=str(user.tenant_id),
            role=user.role.value,
            token_version=user.token_version,
        )
        return TokenPair(
            access_token=create_access_token(**common),
            refresh_token=create_refresh_token(**common),
        )

    def login(self, tenant_slug: str, email: str, password: str) -> TokenPair:
        tenant = self.tenants.get_by_slug(tenant_slug)
        if tenant is None or not tenant.is_active:
            raise UnauthorizedError("Invalid academy code, email or password")

        user = self.users.get_by_email(tenant.id, email.lower())
        if user is None or not user.is_active or not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Invalid academy code, email or password")

        if settings.REQUIRE_EMAIL_VERIFICATION and not user.is_verified:
            raise UnauthorizedError("Please verify your email before logging in")

        return self._issue_tokens(user)

    def refresh(self, refresh_token: str) -> TokenPair:
        try:
            payload = decode_token(refresh_token, TokenType.REFRESH)
        except InvalidTokenError as exc:
            raise UnauthorizedError(str(exc)) from exc

        user = self.users.get_by_id_any_tenant(payload["sub"])
        if (
            user is None
            or not user.is_active
            or str(user.tenant_id) != payload["tenant_id"]
            or user.token_version != payload["token_version"]
        ):
            raise UnauthorizedError("Refresh token no longer valid")

        return self._issue_tokens(user)

    def logout(self, user: User) -> None:
        """Bumps token_version, the same kill-switch used to force-logout a deactivated user —
        this immediately invalidates every access/refresh token already issued to this user,
        not just the one on the device that called /logout."""
        user.token_version += 1
        self.db.commit()

    def change_password(self, user: User, current_password: str, new_password: str) -> None:
        if not verify_password(current_password, user.hashed_password):
            raise UnauthorizedError("Current password is incorrect")
        user.hashed_password = hash_password(new_password)
        user.token_version += 1
        self.db.commit()

    # --- Email verification -------------------------------------------------

    def send_verification_email(self, user: User) -> None:
        token = generate_secure_token()
        user.email_verification_token_hash = hash_token(token)
        user.email_verification_expires_at = datetime.now(timezone.utc) + timedelta(
            hours=EMAIL_VERIFICATION_EXPIRE_HOURS
        )
        self.db.commit()

        link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
        self.emails.send(
            user.email,
            "Verify your email",
            f"Hi {user.full_name},\n\nPlease verify your email by opening this link:\n{link}\n\n"
            f"This link expires in {EMAIL_VERIFICATION_EXPIRE_HOURS} hours.",
        )

    def resend_verification(self, user: User) -> None:
        if user.is_verified:
            raise ConflictError("Email is already verified")
        self.send_verification_email(user)

    def verify_email(self, token: str) -> None:
        user = self.users.get_by_email_verification_token_hash(hash_token(token))
        expires_at = _as_aware_utc(user.email_verification_expires_at) if user else None
        if user is None or expires_at is None or expires_at < datetime.now(timezone.utc):
            raise UnauthorizedError("Verification link is invalid or has expired")

        user.is_verified = True
        user.email_verification_token_hash = None
        user.email_verification_expires_at = None
        self.db.commit()

    # --- Password reset -------------------------------------------------

    def forgot_password(self, tenant_slug: str, email: str) -> None:
        """Always a no-op-looking call from the outside — the endpoint returns the same generic
        message whether or not the tenant/user actually exists, to avoid leaking which emails
        are registered."""
        tenant = self.tenants.get_by_slug(tenant_slug)
        if tenant is None or not tenant.is_active:
            return

        user = self.users.get_by_email(tenant.id, email.lower())
        if user is None or not user.is_active:
            return

        token = generate_secure_token()
        user.password_reset_token_hash = hash_token(token)
        user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=PASSWORD_RESET_EXPIRE_MINUTES
        )
        self.db.commit()

        link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        self.emails.send(
            user.email,
            "Reset your password",
            f"Hi {user.full_name},\n\nOpen this link to choose a new password:\n{link}\n\n"
            f"This link expires in {PASSWORD_RESET_EXPIRE_MINUTES} minutes. "
            "If you didn't request this, you can ignore this email.",
        )

    def reset_password(self, token: str, new_password: str) -> None:
        user = self.users.get_by_password_reset_token_hash(hash_token(token))
        expires_at = _as_aware_utc(user.password_reset_expires_at) if user else None
        if user is None or expires_at is None or expires_at < datetime.now(timezone.utc):
            raise UnauthorizedError("Reset link is invalid or has expired")

        user.hashed_password = hash_password(new_password)
        user.password_reset_token_hash = None
        user.password_reset_expires_at = None
        user.is_verified = True
        user.token_version += 1
        self.db.commit()
