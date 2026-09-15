import uuid

from sqlalchemy import select

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    def get_by_email(self, tenant_id: uuid.UUID, email: str) -> User | None:
        stmt = select(User).where(User.tenant_id == tenant_id, User.email == email.lower())
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_id_any_tenant(self, id_: uuid.UUID) -> User | None:
        """Used only during token decoding, where tenant_id comes from the token itself
        and is cross-checked against the loaded user immediately after."""
        stmt = select(User).where(User.id == id_)
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_email_verification_token_hash(self, token_hash: str) -> User | None:
        """Verification links carry no tenant slug — the token itself is the lookup key."""
        stmt = select(User).where(User.email_verification_token_hash == token_hash)
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_password_reset_token_hash(self, token_hash: str) -> User | None:
        stmt = select(User).where(User.password_reset_token_hash == token_hash)
        return self.db.execute(stmt).scalar_one_or_none()
