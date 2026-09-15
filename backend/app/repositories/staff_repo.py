import uuid

from sqlalchemy import or_, select

from app.models.staff import Staff
from app.repositories.base import BaseRepository


class StaffRepository(BaseRepository[Staff]):
    model = Staff

    def search(self, tenant_id: uuid.UUID, query: str | None = None, status: str | None = None) -> list[Staff]:
        stmt = select(Staff).where(Staff.tenant_id == tenant_id)
        if status and status != "all":
            stmt = stmt.where(Staff.status == status)
        if query:
            like = f"%{query}%"
            stmt = stmt.where(
                or_(
                    Staff.full_name.ilike(like),
                    Staff.designation.ilike(like),
                    Staff.phone.ilike(like),
                    Staff.employee_code.ilike(like),
                )
            )
        stmt = stmt.order_by(Staff.full_name)
        return list(self.db.execute(stmt).scalars().all())

    def next_employee_code(self, tenant_id: uuid.UUID) -> str:
        staff = self.list(tenant_id)
        max_code = 0
        for s in staff:
            if s.employee_code.isdigit():
                max_code = max(max_code, int(s.employee_code))
        return str(max_code + 1)
