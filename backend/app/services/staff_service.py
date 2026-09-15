import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.staff import Staff
from app.repositories.staff_repo import StaffRepository
from app.schemas.staff import StaffCreate, StaffUpdate


class StaffService:
    def __init__(self, db: Session):
        self.db = db
        self.staff = StaffRepository(db)

    def create_staff(self, tenant_id: uuid.UUID, payload: StaffCreate) -> Staff:
        member = self.staff.create(
            Staff(
                tenant_id=tenant_id,
                employee_code=self.staff.next_employee_code(tenant_id),
                full_name=payload.full_name,
                designation=payload.designation,
                phone=payload.phone,
                whatsapp_number=payload.whatsapp_number,
                salary=payload.salary,
                hire_date=payload.hire_date,
                notes=payload.notes,
            )
        )
        self.db.commit()
        self.db.refresh(member)
        return member

    def list_staff(self, tenant_id: uuid.UUID, query: str | None = None, status: str | None = None) -> list[Staff]:
        return self.staff.search(tenant_id, query, status)

    def get_staff(self, tenant_id: uuid.UUID, staff_id: uuid.UUID) -> Staff:
        member = self.staff.get_by_id(tenant_id, staff_id)
        if member is None:
            raise NotFoundError("Staff member not found")
        return member

    def update_staff(self, tenant_id: uuid.UUID, staff_id: uuid.UUID, payload: StaffUpdate) -> Staff:
        member = self.get_staff(tenant_id, staff_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(member, field, value)
        self.db.commit()
        self.db.refresh(member)
        return member

    def set_status(self, tenant_id: uuid.UUID, staff_id: uuid.UUID, status: str) -> Staff:
        member = self.get_staff(tenant_id, staff_id)
        member.status = status
        self.db.commit()
        self.db.refresh(member)
        return member
