import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tenant import Tenant


class TenantRepository:
    """Tenant is the root entity (has no tenant_id column of its own), so it does not
    use BaseRepository's tenant-scoped generic CRUD."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_slug(self, slug: str) -> Tenant | None:
        stmt = select(Tenant).where(Tenant.slug == slug)
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_id(self, id_: uuid.UUID) -> Tenant | None:
        stmt = select(Tenant).where(Tenant.id == id_)
        return self.db.execute(stmt).scalar_one_or_none()

    def create(self, tenant: Tenant) -> Tenant:
        self.db.add(tenant)
        self.db.flush()
        return tenant
