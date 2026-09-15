import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models.academic import AcademicYear, ClassGrade, Section, Subject
from app.repositories.academic_repo import (
    AcademicYearRepository,
    ClassGradeRepository,
    SectionRepository,
    SubjectRepository,
)
from app.repositories.student_repo import StudentProfileRepository
from app.schemas.academic import (
    AcademicYearCreate,
    AcademicYearUpdate,
    ClassGradeCreate,
    PromoteStudentsRequest,
    PromoteStudentsResult,
    PromotionClassResult,
    SectionCreate,
    SubjectCreate,
)


class AcademicService:
    def __init__(self, db: Session):
        self.db = db
        self.academic_years = AcademicYearRepository(db)
        self.class_grades = ClassGradeRepository(db)
        self.sections = SectionRepository(db)
        self.subjects = SubjectRepository(db)
        self.student_profiles = StudentProfileRepository(db)

    # --- Academic years -------------------------------------------------

    def create_academic_year(self, tenant_id: uuid.UUID, payload: AcademicYearCreate) -> AcademicYear:
        if self.academic_years.get_by_name(tenant_id, payload.name) is not None:
            raise ConflictError(f"Academic year '{payload.name}' already exists")

        if payload.is_active:
            self.academic_years.deactivate_all(tenant_id)

        year = self.academic_years.create(
            AcademicYear(
                tenant_id=tenant_id,
                name=payload.name,
                start_date=payload.start_date,
                end_date=payload.end_date,
                is_active=payload.is_active,
            )
        )
        self.db.commit()
        self.db.refresh(year)
        return year

    def list_academic_years(self, tenant_id: uuid.UUID) -> list[AcademicYear]:
        return self.academic_years.list(tenant_id)

    def get_academic_year_or_404(self, tenant_id: uuid.UUID, year_id: uuid.UUID) -> AcademicYear:
        year = self.academic_years.get_by_id(tenant_id, year_id)
        if year is None:
            raise NotFoundError("Academic year not found")
        return year

    def update_academic_year(self, tenant_id: uuid.UUID, year_id: uuid.UUID, payload: AcademicYearUpdate) -> AcademicYear:
        year = self.get_academic_year_or_404(tenant_id, year_id)

        if payload.name is not None and payload.name != year.name:
            if self.academic_years.get_by_name(tenant_id, payload.name) is not None:
                raise ConflictError(f"Academic year '{payload.name}' already exists")
            year.name = payload.name
        if payload.start_date is not None:
            year.start_date = payload.start_date
        if payload.end_date is not None:
            year.end_date = payload.end_date
        if payload.is_active is not None:
            if payload.is_active:
                self.academic_years.deactivate_all(tenant_id)
            year.is_active = payload.is_active

        self.db.commit()
        self.db.refresh(year)
        return year

    # --- Class grades / sections / subjects -------------------------------------------------

    def create_class_grade(self, tenant_id: uuid.UUID, payload: ClassGradeCreate) -> ClassGrade:
        academic_year = None
        if payload.academic_year_id is not None:
            academic_year = self.get_academic_year_or_404(tenant_id, payload.academic_year_id)

        academic_year_label = payload.academic_year or (academic_year.name if academic_year else None)
        if academic_year_label is None:
            raise ConflictError("Either academic_year or academic_year_id is required")

        existing = [
            c
            for c in self.class_grades.list(tenant_id)
            if c.name == payload.name and c.academic_year == academic_year_label
        ]
        if existing:
            raise ConflictError(f"Class '{payload.name}' already exists for {academic_year_label}")

        class_grade = self.class_grades.create(
            ClassGrade(
                tenant_id=tenant_id,
                name=payload.name,
                level_order=payload.level_order,
                academic_year=academic_year_label,
                academic_year_id=academic_year.id if academic_year else None,
            )
        )
        self.db.commit()
        self.db.refresh(class_grade)
        return class_grade

    def list_class_grades(self, tenant_id: uuid.UUID) -> list[ClassGrade]:
        return self.class_grades.list(tenant_id)

    def _get_class_grade_or_404(self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID) -> ClassGrade:
        class_grade = self.class_grades.get_by_id(tenant_id, class_grade_id)
        if class_grade is None:
            raise NotFoundError("Class not found")
        return class_grade

    def create_section(self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID, payload: SectionCreate) -> Section:
        self._get_class_grade_or_404(tenant_id, class_grade_id)
        section = self.sections.create(
            Section(tenant_id=tenant_id, class_grade_id=class_grade_id, name=payload.name)
        )
        self.db.commit()
        self.db.refresh(section)
        return section

    def list_sections(self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID) -> list[Section]:
        self._get_class_grade_or_404(tenant_id, class_grade_id)
        return self.sections.list_by_class(tenant_id, class_grade_id)

    def create_subject(self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID, payload: SubjectCreate) -> Subject:
        self._get_class_grade_or_404(tenant_id, class_grade_id)
        subject = self.subjects.create(
            Subject(tenant_id=tenant_id, class_grade_id=class_grade_id, name=payload.name, code=payload.code)
        )
        self.db.commit()
        self.db.refresh(subject)
        return subject

    def list_subjects(self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID) -> list[Subject]:
        self._get_class_grade_or_404(tenant_id, class_grade_id)
        return self.subjects.list_by_class(tenant_id, class_grade_id)

    def promote_students(
        self, tenant_id: uuid.UUID, payload: PromoteStudentsRequest
    ) -> PromoteStudentsResult:
        """Moves every active student one class up, from `from_academic_year_id` into
        `to_academic_year_id`, matching by `level_order + 1`. A `from` class with no matching
        `level_order + 1` class in the target year — either because it's genuinely the top
        class (e.g. Class 10 with no Class 11) or because the admin hasn't created next year's
        classes yet — graduates those students instead of erroring the whole batch; the admin
        can tell which happened from `graduated_classes` and create the missing class + re-run
        if it was the latter. Section is preserved by NAME when the target class has a
        same-named section, otherwise left unassigned for the admin to re-sort."""
        from_year = self.get_academic_year_or_404(tenant_id, payload.from_academic_year_id)
        to_year = self.get_academic_year_or_404(tenant_id, payload.to_academic_year_id)

        from_classes = [c for c in self.class_grades.list(tenant_id) if c.academic_year_id == from_year.id]
        to_classes_by_level = {
            c.level_order: c for c in self.class_grades.list(tenant_id) if c.academic_year_id == to_year.id
        }

        promoted_by_class: list[PromotionClassResult] = []
        graduated_classes: list[str] = []
        total_promoted = 0
        total_graduated = 0

        for from_class in from_classes:
            students = self.student_profiles.list_with_users(tenant_id, class_grade_id=from_class.id, status="active")
            target_class = to_classes_by_level.get(from_class.level_order + 1)

            if target_class is None:
                for profile, _user in students:
                    profile.status = "graduated"
                    profile.withdrawal_date = to_year.start_date
                    profile.withdrawal_reason = "Graduated"
                if students:
                    graduated_classes.append(from_class.name)
                    total_graduated += len(students)
                continue

            target_sections_by_name = {s.name: s for s in self.sections.list_by_class(tenant_id, target_class.id)}
            for profile, _user in students:
                current_section = self.sections.get_by_id(tenant_id, profile.section_id) if profile.section_id else None
                matched_section = target_sections_by_name.get(current_section.name) if current_section else None
                profile.class_grade_id = target_class.id
                profile.section_id = matched_section.id if matched_section else None

            if students:
                promoted_by_class.append(PromotionClassResult(class_name=from_class.name, students_moved=len(students)))
                total_promoted += len(students)

        self.db.commit()
        return PromoteStudentsResult(
            students_promoted=total_promoted,
            students_graduated=total_graduated,
            promoted_by_class=promoted_by_class,
            graduated_classes=graduated_classes,
        )

    def validate_section_belongs_to_class(
        self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID, section_id: uuid.UUID
    ) -> Section:
        section = self.sections.get_by_id(tenant_id, section_id)
        if section is None or section.class_grade_id != class_grade_id:
            raise ConflictError("Section does not belong to the given class")
        return section
