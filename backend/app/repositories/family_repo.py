import uuid

from sqlalchemy import or_, select

from app.models.family import Family
from app.repositories.base import BaseRepository


class FamilyRepository(BaseRepository[Family]):
    model = Family

    def search(self, tenant_id: uuid.UUID, query: str | None = None) -> list[Family]:
        stmt = select(Family).where(Family.tenant_id == tenant_id)
        if query:
            like = f"%{query}%"
            stmt = stmt.where(
                or_(
                    Family.family_name.ilike(like),
                    Family.cnic.ilike(like),
                    Family.phone.ilike(like),
                    Family.family_number.ilike(like),
                )
            )
        stmt = stmt.order_by(Family.family_name)
        return list(self.db.execute(stmt).scalars().all())

    def next_family_number(self, tenant_id: uuid.UUID) -> str:
        families = self.list(tenant_id)
        max_number = 0
        for f in families:
            if f.family_number.isdigit():
                max_number = max(max_number, int(f.family_number))
        return str(max_number + 1)
