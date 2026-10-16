import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import hash_password
from app.models.user import RoleEnum, TeacherProfile, User
from app.repositories.teacher_repo import TeacherProfileRepository
from app.repositories.user_repo import UserRepository
from app.schemas.teacher import TeacherCreate, TeacherOut, TeacherUpdate


def _to_teacher_out(profile: TeacherProfile, user: User) -> TeacherOut:
    return TeacherOut(
        id=profile.id,
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        phone_number=user.phone_number,
        is_active=user.is_active,
        employee_code=profile.employee_code,
        hire_date=profile.hire_date,
        qualification=profile.qualification,
    )


class TeacherService:
    def __init__(self, db: Session):
        self.db = db
        self.users = UserRepository(db)
        self.teacher_profiles = TeacherProfileRepository(db)

    def create_teacher(self, tenant_id: uuid.UUID, payload: TeacherCreate) -> TeacherOut:
        if self.users.get_by_email(tenant_id, payload.email) is not None:
            raise ConflictError(f"A user with email '{payload.email}' already exists at this school")

        user = self.users.create(
            User(
                tenant_id=tenant_id,
                email=payload.email.lower(),
                hashed_password=hash_password(payload.password),
                full_name=payload.full_name,
                role=RoleEnum.TEACHER,
                phone_number=payload.phone_number,
            )
        )
        profile = self.teacher_profiles.create(
            TeacherProfile(
                tenant_id=tenant_id,
                user_id=user.id,
                employee_code=payload.employee_code,
                hire_date=payload.hire_date,
                qualification=payload.qualification,
            )
        )
        self.db.commit()
        self.db.refresh(user)
        self.db.refresh(profile)
        return _to_teacher_out(profile, user)

    def list_teachers(self, tenant_id: uuid.UUID, query: str | None = None, is_active: bool | None = None) -> list[TeacherOut]:
        return [
            _to_teacher_out(profile, user)
            for profile, user in self.teacher_profiles.list_with_users(tenant_id, query, is_active)
        ]

    def get_teacher(self, tenant_id: uuid.UUID, teacher_id: uuid.UUID) -> TeacherOut:
        result = self.teacher_profiles.get_with_user(tenant_id, teacher_id)
        if result is None:
            raise NotFoundError("Teacher not found")
        return _to_teacher_out(*result)

    def update_teacher(self, tenant_id: uuid.UUID, teacher_id: uuid.UUID, payload: TeacherUpdate) -> TeacherOut:
        result = self.teacher_profiles.get_with_user(tenant_id, teacher_id)
        if result is None:
            raise NotFoundError("Teacher not found")
        profile, user = result

        if payload.full_name is not None:
            user.full_name = payload.full_name
        if payload.phone_number is not None:
            user.phone_number = payload.phone_number
        if payload.is_active is not None:
            user.is_active = payload.is_active
            user.token_version += 1  # force logout if deactivated
        if payload.qualification is not None:
            profile.qualification = payload.qualification
        if payload.employee_code is not None:
            profile.employee_code = payload.employee_code
        if payload.hire_date is not None:
            profile.hire_date = payload.hire_date

        self.db.commit()
        self.db.refresh(user)
        self.db.refresh(profile)
        return _to_teacher_out(profile, user)

    def get_teacher_by_user(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> TeacherOut:
        profile = self.teacher_profiles.get_by_user_id(tenant_id, user_id)
        if profile is None:
            raise NotFoundError("Teacher profile not found")
        result = self.teacher_profiles.get_with_user(tenant_id, profile.id)
        if result is None:
            raise NotFoundError("Teacher profile not found")
        return _to_teacher_out(*result)

    def update_teacher_self(self, tenant_id: uuid.UUID, user_id: uuid.UUID, payload: TeacherUpdate) -> TeacherOut:
        profile = self.teacher_profiles.get_by_user_id(tenant_id, user_id)
        if profile is None:
            raise NotFoundError("Teacher profile not found")
        result = self.teacher_profiles.get_with_user(tenant_id, profile.id)
        if result is None:
            raise NotFoundError("Teacher profile not found")
        p, u = result
        if payload.full_name is not None:
            u.full_name = payload.full_name
        if payload.phone_number is not None:
            u.phone_number = payload.phone_number
        if payload.qualification is not None:
            p.qualification = payload.qualification
        if payload.employee_code is not None:
            p.employee_code = payload.employee_code
        if payload.hire_date is not None:
            p.hire_date = payload.hire_date
        self.db.commit()
        self.db.refresh(u)
        self.db.refresh(p)
        return _to_teacher_out(p, u)
