import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.family import Family
from app.repositories.family_repo import FamilyRepository
from app.schemas.family import FamilyCreate, FamilyUpdate


class FamilyService:
    def __init__(self, db: Session):
        self.db = db
        self.families = FamilyRepository(db)

    def create_family(self, tenant_id: uuid.UUID, payload: FamilyCreate) -> Family:
        family = self.families.create(
            Family(
                tenant_id=tenant_id,
                family_number=self.families.next_family_number(tenant_id),
                family_name=payload.family_name,
                cnic=payload.cnic,
                phone=payload.phone,
                whatsapp_number=payload.whatsapp_number,
                notes=payload.notes,
            )
        )
        self.db.commit()
        self.db.refresh(family)
        return family

    def list_families(self, tenant_id: uuid.UUID, query: str | None = None) -> list[Family]:
        return self.families.search(tenant_id, query)

    def get_family(self, tenant_id: uuid.UUID, family_id: uuid.UUID) -> Family:
        family = self.families.get_by_id(tenant_id, family_id)
        if family is None:
            raise NotFoundError("Family not found")
        return family

    def update_family(self, tenant_id: uuid.UUID, family_id: uuid.UUID, payload: FamilyUpdate) -> Family:
        family = self.get_family(tenant_id, family_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(family, field, value)
        self.db.commit()
        self.db.refresh(family)
        return family
