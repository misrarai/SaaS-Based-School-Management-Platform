import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.security import hash_password
from app.models.user import ParentProfile, ParentStudentLink, RoleEnum, StudentProfile, User
from app.repositories.parent_repo import ParentProfileRepository, ParentStudentLinkRepository
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.user_repo import UserRepository
from app.schemas.parent import ParentLinkCreate


class ParentService:
    def __init__(self, db: Session):
        self.db = db
        self.parent_profiles = ParentProfileRepository(db)
        self.links = ParentStudentLinkRepository(db)
        self.student_profiles = StudentProfileRepository(db)
        self.users = UserRepository(db)

    def _get_parent_profile_or_403(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> ParentProfile:
        profile = self.parent_profiles.get_by_user_id(tenant_id, user_id)
        if profile is None:
            raise ForbiddenError("Parent profile not found")
        return profile

    def list_children_profiles(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> list[StudentProfile]:
        parent = self._get_parent_profile_or_403(tenant_id, user_id)
        student_ids = self.links.list_student_ids(tenant_id, parent.id)
        return [sp for sid in student_ids if (sp := self.student_profiles.get_by_id(tenant_id, sid)) is not None]

    def get_preferences(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> ParentProfile:
        return self._get_parent_profile_or_403(tenant_id, user_id)

    def update_preferences(
        self, tenant_id: uuid.UUID, user_id: uuid.UUID, whatsapp_opt_in: bool | None, sms_opt_in: bool | None
    ) -> ParentProfile:
        profile = self._get_parent_profile_or_403(tenant_id, user_id)
        if whatsapp_opt_in is not None:
            profile.whatsapp_opt_in = whatsapp_opt_in
        if sms_opt_in is not None:
            profile.sms_opt_in = sms_opt_in
        self.db.commit()
        self.db.refresh(profile)
        return profile

    def assert_child(self, tenant_id: uuid.UUID, user_id: uuid.UUID, student_id: uuid.UUID) -> None:
        parent = self._get_parent_profile_or_403(tenant_id, user_id)
        if not self.links.is_linked(tenant_id, parent.id, student_id):
            raise ForbiddenError("Not your child")

    def create_and_link_parent(
        self, tenant_id: uuid.UUID, student_id: uuid.UUID, payload: ParentLinkCreate
    ) -> ParentProfile:
        """Creates a parent account (or reuses an existing one by email) and links it to the
        given student. No prior endpoint created ParentProfile/ParentStudentLink rows despite
        both existing in the data model, so this is the sole entry point for making the
        PARENT role usable."""
        if self.student_profiles.get_by_id(tenant_id, student_id) is None:
            raise NotFoundError("Student not found")

        existing_user = self.users.get_by_email(tenant_id, payload.email)
        if existing_user is not None:
            if existing_user.role != RoleEnum.PARENT:
                raise ConflictError(f"A user with email '{payload.email}' already exists with a different role")
            parent_profile = self.parent_profiles.get_by_user_id(tenant_id, existing_user.id)
        else:
            user = self.users.create(
                User(
                    tenant_id=tenant_id,
                    email=payload.email.lower(),
                    hashed_password=hash_password(payload.password),
                    full_name=payload.full_name,
                    role=RoleEnum.PARENT,
                    phone_number=payload.phone_number,
                )
            )
            self.db.flush()
            parent_profile = self.parent_profiles.create(ParentProfile(tenant_id=tenant_id, user_id=user.id))
            self.db.flush()

        if self.links.is_linked(tenant_id, parent_profile.id, student_id):
            raise ConflictError("This parent is already linked to this student")

        self.links.create(
            ParentStudentLink(
                tenant_id=tenant_id,
                parent_id=parent_profile.id,
                student_id=student_id,
                relationship_label=payload.relationship_label,
            )
        )
        self.db.commit()
        self.db.refresh(parent_profile)
        return parent_profile
