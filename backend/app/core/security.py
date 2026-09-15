import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def generate_secure_token() -> str:
    """A high-entropy, single-use token for email verification / password reset links."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Tokens are random and high-entropy (unlike passwords), so a fast SHA-256 digest is
    sufficient — we only need to avoid storing the raw token, not resist offline guessing."""
    return hashlib.sha256(token.encode()).hexdigest()


class TokenType(str, Enum):
    ACCESS = "access"
    REFRESH = "refresh"


def _create_token(*, subject: str, tenant_id: str, role: str, token_version: int, token_type: TokenType, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "tenant_id": tenant_id,
        "role": role,
        "token_version": token_version,
        "type": token_type.value,
        "iat": now,
        "exp": now + expires_delta,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_access_token(*, subject: str, tenant_id: str, role: str, token_version: int) -> str:
    return _create_token(
        subject=subject,
        tenant_id=tenant_id,
        role=role,
        token_version=token_version,
        token_type=TokenType.ACCESS,
        expires_delta=timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES),
    )


def create_refresh_token(*, subject: str, tenant_id: str, role: str, token_version: int) -> str:
    return _create_token(
        subject=subject,
        tenant_id=tenant_id,
        role=role,
        token_version=token_version,
        token_type=TokenType.REFRESH,
        expires_delta=timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS),
    )


class InvalidTokenError(Exception):
    pass


def decode_token(token: str, expected_type: TokenType) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise InvalidTokenError("Could not validate token") from exc

    if payload.get("type") != expected_type.value:
        raise InvalidTokenError(f"Expected a {expected_type.value} token")

    return payload
