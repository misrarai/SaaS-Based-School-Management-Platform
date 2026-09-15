import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import hash_password
from app.models.family import Family
from app.models.student_admission_detail import StudentAdmissionDetail
from app.models.user import RoleEnum, StudentProfile, User
from app.repositories.academic_repo import ClassGradeRepository, SectionRepository
from app.repositories.family_repo import FamilyRepository
from app.repositories.student_admission_repo import StudentAdmissionDetailRepository
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.user_repo import UserRepository
from app.schemas.student import StudentCreate, StudentOut, StudentUpdate
from app.schemas.student_admission_detail import StudentAdmissionDetailOut


def _to_student_out(profile: StudentProfile, user: User, detail: StudentAdmissionDetail | None) -> StudentOut:
    return StudentOut(
        id=profile.id,
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        is_active=user.is_active,
        class_grade_id=profile.class_grade_id,
        section_id=profile.section_id,
        family_id=profile.family_id,
        admission_number=profile.admission_number,
        roll_number=profile.roll_number,
        admission_date=profile.admission_date,
        date_of_birth=profile.date_of_birth,
        guardian_name=profile.guardian_name,
        status=profile.status,
        withdrawal_date=profile.withdrawal_date,
        withdrawal_reason=profile.withdrawal_reason,
        admission_detail=StudentAdmissionDetailOut.model_validate(detail) if detail else None,
    )


class StudentService:
    def __init__(self, db: Session):
        self.db = db
        self.users = UserRepository(db)
        self.student_profiles = StudentProfileRepository(db)
        self.class_grades = ClassGradeRepository(db)
        self.sections = SectionRepository(db)
        self.families = FamilyRepository(db)
        self.admission_details = StudentAdmissionDetailRepository(db)

    def validate_class_and_section(
        self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID, section_id: uuid.UUID | None
    ) -> None:
        if self.class_grades.get_by_id(tenant_id, class_grade_id) is None:
            raise NotFoundError("Class not found")
        if section_id is not None:
            section = self.sections.get_by_id(tenant_id, section_id)
            if section is None or section.class_grade_id != class_grade_id:
                raise ConflictError("Section does not belong to the given class")

    def _validate_family(self, tenant_id: uuid.UUID, family_id: uuid.UUID | None) -> None:
        if family_id is not None and self.families.get_by_id(tenant_id, family_id) is None:
            raise NotFoundError("Family not found")

    def _next_admission_number(self, tenant_id: uuid.UUID) -> str:
        return str(self.student_profiles.max_admission_number(tenant_id) + 1)

    def preview_next_admission_number(self, tenant_id: uuid.UUID) -> str:
        return self._next_admission_number(tenant_id)

    def _resolve_family_id(self, tenant_id: uuid.UUID, payload: StudentCreate) -> uuid.UUID | None:
        """If no family was explicitly selected but father details were provided on the
        admission form, auto-create a Family record from that info (matches the
        reference admission form's "Select Family or a new one is created" behavior)."""
        if payload.family_id is not None:
            return payload.family_id

        detail = payload.admission_detail
        if detail is None or not detail.father_name:
            return None

        family = self.families.create(
            Family(
                tenant_id=tenant_id,
                family_number=self.families.next_family_number(tenant_id),
                family_name=detail.father_name,
                cnic=detail.father_cnic,
                phone=detail.father_mobile,
                whatsapp_number=detail.whatsapp_number,
            )
        )
        self.db.flush()
        return family.id

    def create_student(self, tenant_id: uuid.UUID, payload: StudentCreate) -> StudentOut:
        if self.users.get_by_email(tenant_id, payload.email) is not None:
            raise ConflictError(f"A user with email '{payload.email}' already exists at this school")

        self.validate_class_and_section(tenant_id, payload.class_grade_id, payload.section_id)
        self._validate_family(tenant_id, payload.family_id)

        family_id = self._resolve_family_id(tenant_id, payload)

        user = self.users.create(
            User(
                tenant_id=tenant_id,
                email=payload.email.lower(),
                hashed_password=hash_password(payload.password),
                full_name=payload.full_name,
                role=RoleEnum.STUDENT,
            )
        )
        profile = self.student_profiles.create(
            StudentProfile(
                tenant_id=tenant_id,
                user_id=user.id,
                class_grade_id=payload.class_grade_id,
                section_id=payload.section_id,
                family_id=family_id,
                admission_number=self._next_admission_number(tenant_id),
                roll_number=payload.roll_number,
                admission_date=payload.admission_date,
                date_of_birth=payload.date_of_birth,
                guardian_name=payload.guardian_name,
            )
        )
        self.db.flush()

        detail = None
        if payload.admission_detail is not None:
            detail = self.admission_details.create(
                StudentAdmissionDetail(
                    tenant_id=tenant_id,
                    student_id=profile.id,
                    **payload.admission_detail.model_dump(),
                )
            )
            if detail.referred_by_family_id is not None:
                # Local import avoids a module-level cycle (fee_service doesn't import
                # student_service, but keeping the import scoped here documents the
                # one-directional dependency clearly).
                from app.services.fee_service import FeeService

                FeeService(self.db).apply_referral_credit(tenant_id, detail.referred_by_family_id)

        self.db.commit()
        self.db.refresh(user)
        self.db.refresh(profile)
        if detail is not None:
            self.db.refresh(detail)
        return _to_student_out(profile, user, detail)

    def get_students_by_ids(self, tenant_id: uuid.UUID, student_ids: list[uuid.UUID]) -> list[StudentOut]:
        results = []
        for student_id in student_ids:
            found = self.student_profiles.get_with_user(tenant_id, student_id)
            if found is None:
                continue
            profile, user = found
            detail = self.admission_details.get_by_student_id(tenant_id, profile.id)
            results.append(_to_student_out(profile, user, detail))
        return results

    def list_students(
        self,
        tenant_id: uuid.UUID,
        class_grade_id: uuid.UUID | None = None,
        section_id: uuid.UUID | None = None,
        family_id: uuid.UUID | None = None,
        status: str | None = None,
        query: str | None = None,
    ) -> list[StudentOut]:
        return [
            _to_student_out(profile, user, None)
            for profile, user in self.student_profiles.list_with_users(
                tenant_id, class_grade_id, section_id, family_id, status, query
            )
        ]

    def get_student(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> StudentOut:
        result = self.student_profiles.get_with_user(tenant_id, student_id)
        if result is None:
            raise NotFoundError("Student not found")
        profile, user = result
        detail = self.admission_details.get_by_student_id(tenant_id, profile.id)
        return _to_student_out(profile, user, detail)

    def get_current_student(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> StudentOut:
        profile = self.student_profiles.get_by_user_id(tenant_id, user_id)
        if profile is None:
            raise NotFoundError("Student profile not found")
        return self.get_student(tenant_id, profile.id)

    def update_student(self, tenant_id: uuid.UUID, student_id: uuid.UUID, payload: StudentUpdate) -> StudentOut:
        result = self.student_profiles.get_with_user(tenant_id, student_id)
        if result is None:
            raise NotFoundError("Student not found")
        profile, user = result

        new_class_grade_id = payload.class_grade_id if payload.class_grade_id is not None else profile.class_grade_id
        new_section_id = payload.section_id if payload.section_id is not None else profile.section_id
        if payload.class_grade_id is not None or payload.section_id is not None:
            if new_class_grade_id is not None:
                self.validate_class_and_section(tenant_id, new_class_grade_id, new_section_id)
            profile.class_grade_id = new_class_grade_id
            profile.section_id = new_section_id

        if payload.family_id is not None:
            self._validate_family(tenant_id, payload.family_id)
            profile.family_id = payload.family_id
        if payload.full_name is not None:
            user.full_name = payload.full_name
        if payload.roll_number is not None:
            profile.roll_number = payload.roll_number
        if payload.status is not None:
            profile.status = payload.status
        if payload.is_active is not None:
            user.is_active = payload.is_active
            user.token_version += 1

        detail = self.admission_details.get_by_student_id(tenant_id, profile.id)
        if payload.admission_detail is not None:
            update_values = payload.admission_detail.model_dump(exclude_unset=True)
            if detail is None:
                detail = self.admission_details.create(
                    StudentAdmissionDetail(tenant_id=tenant_id, student_id=profile.id, **update_values)
                )
            else:
                for field, value in update_values.items():
                    setattr(detail, field, value)

        self.db.commit()
        self.db.refresh(user)
        self.db.refresh(profile)
        if detail is not None:
            self.db.refresh(detail)
        return _to_student_out(profile, user, detail)

    def withdraw_student(
        self, tenant_id: uuid.UUID, student_id: uuid.UUID, reason: str | None, withdrawal_date: date | None
    ) -> StudentOut:
        result = self.student_profiles.get_with_user(tenant_id, student_id)
        if result is None:
            raise NotFoundError("Student not found")
        profile, user = result

        profile.status = "withdrawn"
        profile.withdrawal_date = withdrawal_date or date.today()
        profile.withdrawal_reason = reason
        user.is_active = False
        user.token_version += 1

        self.db.commit()
        self.db.refresh(user)
        self.db.refresh(profile)
        return _to_student_out(profile, user, None)

    def reactivate_student(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> StudentOut:
        result = self.student_profiles.get_with_user(tenant_id, student_id)
        if result is None:
            raise NotFoundError("Student not found")
        profile, user = result

        profile.status = "active"
        profile.withdrawal_date = None
        profile.withdrawal_reason = None
        user.is_active = True

        self.db.commit()
        self.db.refresh(user)
        self.db.refresh(profile)
        return _to_student_out(profile, user, None)
