import uuid
from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    """Generic tenant-scoped CRUD. Every read/write method requires tenant_id explicitly."""

    model: type[ModelT]

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, tenant_id: uuid.UUID, id_: uuid.UUID) -> ModelT | None:
        stmt = select(self.model).where(self.model.id == id_, self.model.tenant_id == tenant_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def list(self, tenant_id: uuid.UUID) -> list[ModelT]:
        stmt = select(self.model).where(self.model.tenant_id == tenant_id)
        return list(self.db.execute(stmt).scalars().all())

    def create(self, obj: ModelT) -> ModelT:
        self.db.add(obj)
        self.db.flush()
        return obj

    def delete(self, tenant_id: uuid.UUID, id_: uuid.UUID) -> None:
        obj = self.get_by_id(tenant_id, id_)
        if obj is not None:
            self.db.delete(obj)
            self.db.flush()
