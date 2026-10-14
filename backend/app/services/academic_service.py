import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.base import Base

from app.core.exceptions import ConflictError, NotFoundError
from app.models.academic import AcademicYear, ClassGrade, Section, Subject
from app.models.user import StudentProfile, TeacherProfile, User
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
    ClassGradeOut,
    ClassGradeUpdate,
    ClassOverview,
    PromoteStudentsRequest,
    PromoteStudentsResult,
    PromotionClassResult,
    SectionCreate,
    SectionOut,
    SectionOverview,
    SectionUpdate,
    SectionWithClass,
    SubjectCreate,
    SubjectOut,
    SubjectUpdate,
    SubjectWithClass,
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

    @staticmethod
    def _validate_dates(start_date, end_date) -> None:
        if end_date <= start_date:
            raise ConflictError("end_date must be later than start_date")

    def create_academic_year(self, tenant_id: uuid.UUID, payload: AcademicYearCreate) -> AcademicYear:
        self._validate_dates(payload.start_date, payload.end_date)

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

        new_start = payload.start_date if payload.start_date is not None else year.start_date
        new_end = payload.end_date if payload.end_date is not None else year.end_date
        self._validate_dates(new_start, new_end)

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

    def activate_academic_year(self, tenant_id: uuid.UUID, year_id: uuid.UUID) -> AcademicYear:
        year = self.get_academic_year_or_404(tenant_id, year_id)
        if not year.is_active:
            self.academic_years.deactivate_all(tenant_id)
            year.is_active = True
            self.db.commit()
            self.db.refresh(year)
        return year

    def deactivate_academic_year(self, tenant_id: uuid.UUID, year_id: uuid.UUID) -> AcademicYear:
        year = self.get_academic_year_or_404(tenant_id, year_id)
        if year.is_active:
            year.is_active = False
            self.db.commit()
            self.db.refresh(year)
        return year

    # --- Class grades / sections / subjects -------------------------------------------------

    def create_class_grade(self, tenant_id: uuid.UUID, payload: ClassGradeCreate) -> ClassGrade:
        academic_year = None
        if payload.academic_year_id is not None:
            academic_year = self.get_academic_year_or_404(tenant_id, payload.academic_year_id)
        elif payload.academic_year:
            # Free-text callers still get linked when the label names a real AcademicYear —
            # promotion keys off academic_year_id, so an unlinked class would be skipped.
            academic_year = self.academic_years.get_by_name(tenant_id, payload.academic_year)

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
                class_fee=payload.class_fee,
                capacity=payload.capacity,
                incharge_id=payload.incharge_id,
                assistant_incharge_id=payload.assistant_incharge_id,
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

    def update_class_grade(
        self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID, payload: ClassGradeUpdate
    ) -> ClassGrade:
        class_grade = self._get_class_grade_or_404(tenant_id, class_grade_id)

        new_name = payload.name if payload.name is not None else class_grade.name
        new_year_label = class_grade.academic_year
        new_year_id = class_grade.academic_year_id
        if payload.academic_year_id is not None:
            year = self.get_academic_year_or_404(tenant_id, payload.academic_year_id)
            new_year_id = year.id
            new_year_label = year.name

        if (new_name, new_year_label) != (class_grade.name, class_grade.academic_year):
            clash = any(
                c.id != class_grade.id and c.name == new_name and c.academic_year == new_year_label
                for c in self.class_grades.list(tenant_id)
            )
            if clash:
                raise ConflictError(f"Class '{new_name}' already exists for {new_year_label}")

        class_grade.name = new_name
        class_grade.academic_year = new_year_label
        class_grade.academic_year_id = new_year_id
        if payload.level_order is not None:
            class_grade.level_order = payload.level_order
        if payload.class_fee is not None:
            class_grade.class_fee = payload.class_fee
        if payload.capacity is not None:
            class_grade.capacity = payload.capacity
        if payload.incharge_id is not None:
            class_grade.incharge_id = payload.incharge_id
        elif payload.clear_incharge:
            class_grade.incharge_id = None
        if payload.assistant_incharge_id is not None:
            class_grade.assistant_incharge_id = payload.assistant_incharge_id
        elif payload.clear_assistant:
            class_grade.assistant_incharge_id = None

        self.db.commit()
        self.db.refresh(class_grade)
        return class_grade

    def delete_class_grade(self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID) -> None:
        """Deletes a class together with its sections and subjects, but only while nothing
        else (students, courses, fees, exams, ...) points at any of them — FKs aren't enforced
        on SQLite, so this check is what keeps the data consistent."""
        class_grade = self._get_class_grade_or_404(tenant_id, class_grade_id)
        sections = self.sections.list_by_class(tenant_id, class_grade_id)
        subjects = self.subjects.list_by_class(tenant_id, class_grade_id)

        self._ensure_unreferenced(
            ClassGrade.__tablename__, [class_grade.id], "class", {Section.__tablename__, Subject.__tablename__}
        )
        self._ensure_unreferenced(Section.__tablename__, [s.id for s in sections], "class (its sections are in use)")
        self._ensure_unreferenced(Subject.__tablename__, [s.id for s in subjects], "class (its subjects are in use)")

        for obj in [*sections, *subjects, class_grade]:
            self.db.delete(obj)
        self.db.commit()

    def _ensure_unreferenced(
        self, table_name: str, ids: list[uuid.UUID], label: str, ignore_tables: frozenset[str] | set[str] = frozenset()
    ) -> None:
        if not ids:
            return
        in_use: set[str] = set()
        for table in Base.metadata.sorted_tables:
            if table.name in ignore_tables:
                continue
            for fk in table.foreign_keys:
                if fk.column.table.name != table_name:
                    continue
                count = self.db.execute(
                    select(func.count()).select_from(table).where(fk.parent.in_(ids))
                ).scalar_one()
                if count:
                    in_use.add(table.name.replace("_", " "))
        if in_use:
            raise ConflictError(f"Cannot delete this {label}: still used by {', '.join(sorted(in_use))}")

    def _get_section_or_404(self, tenant_id: uuid.UUID, section_id: uuid.UUID) -> Section:
        section = self.sections.get_by_id(tenant_id, section_id)
        if section is None:
            raise NotFoundError("Section not found")
        return section

    def _validate_teacher(self, tenant_id: uuid.UUID, teacher_id: uuid.UUID) -> None:
        teacher = self.db.get(TeacherProfile, teacher_id)
        if teacher is None or teacher.tenant_id != tenant_id:
            raise NotFoundError("Teacher not found")

    def _ensure_section_name_free(
        self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID, name: str, exclude_id: uuid.UUID | None = None
    ) -> None:
        if any(
            s.name.lower() == name.lower() and s.id != exclude_id
            for s in self.sections.list_by_class(tenant_id, class_grade_id)
        ):
            raise ConflictError(f"Section '{name}' already exists in this class")

    def update_section(self, tenant_id: uuid.UUID, section_id: uuid.UUID, payload: SectionUpdate) -> Section:
        section = self._get_section_or_404(tenant_id, section_id)
        if payload.name is not None and payload.name != section.name:
            self._ensure_section_name_free(tenant_id, section.class_grade_id, payload.name, exclude_id=section.id)
            section.name = payload.name
        if payload.clear_class_teacher:
            section.class_teacher_id = None
        elif payload.class_teacher_id is not None:
            self._validate_teacher(tenant_id, payload.class_teacher_id)
            section.class_teacher_id = payload.class_teacher_id
        self.db.commit()
        self.db.refresh(section)
        return section

    def delete_section(self, tenant_id: uuid.UUID, section_id: uuid.UUID) -> None:
        section = self._get_section_or_404(tenant_id, section_id)
        self._ensure_unreferenced(Section.__tablename__, [section.id], "section")
        self.db.delete(section)
        self.db.commit()

    def _get_subject_or_404(self, tenant_id: uuid.UUID, subject_id: uuid.UUID) -> Subject:
        subject = self.subjects.get_by_id(tenant_id, subject_id)
        if subject is None:
            raise NotFoundError("Subject not found")
        return subject

    def _ensure_subject_code_free(
        self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID, code: str, exclude_id: uuid.UUID | None = None
    ) -> None:
        if any(
            s.code.lower() == code.lower() and s.id != exclude_id
            for s in self.subjects.list_by_class(tenant_id, class_grade_id)
        ):
            raise ConflictError(f"Subject code '{code}' already exists in this class")

    def update_subject(self, tenant_id: uuid.UUID, subject_id: uuid.UUID, payload: SubjectUpdate) -> Subject:
        subject = self._get_subject_or_404(tenant_id, subject_id)
        if payload.code is not None and payload.code != subject.code:
            self._ensure_subject_code_free(tenant_id, subject.class_grade_id, payload.code, exclude_id=subject.id)
            subject.code = payload.code
        if payload.name is not None:
            subject.name = payload.name
        self.db.commit()
        self.db.refresh(subject)
        return subject

    def delete_subject(self, tenant_id: uuid.UUID, subject_id: uuid.UUID) -> None:
        subject = self._get_subject_or_404(tenant_id, subject_id)
        self._ensure_unreferenced(Subject.__tablename__, [subject.id], "subject")
        self.db.delete(subject)
        self.db.commit()

    def class_overview(self, tenant_id: uuid.UUID) -> list[ClassOverview]:
        """Every class with its sections (class teacher + head-count) and subjects in one
        round trip, for the academics dashboard."""
        classes = self.class_grades.list(tenant_id)
        sections = list(
            self.db.execute(select(Section).where(Section.tenant_id == tenant_id).order_by(Section.name)).scalars()
        )
        subjects = list(
            self.db.execute(select(Subject).where(Subject.tenant_id == tenant_id).order_by(Subject.name)).scalars()
        )

        class_counts: dict[uuid.UUID, int] = {}
        section_counts: dict[uuid.UUID, int] = {}
        for class_id, section_id, n in self.db.execute(
            select(StudentProfile.class_grade_id, StudentProfile.section_id, func.count())
            .where(StudentProfile.tenant_id == tenant_id, StudentProfile.status == "active")
            .group_by(StudentProfile.class_grade_id, StudentProfile.section_id)
        ).all():
            if class_id is not None:
                class_counts[class_id] = class_counts.get(class_id, 0) + n
            if section_id is not None:
                section_counts[section_id] = section_counts.get(section_id, 0) + n

        teacher_names = dict(
            self.db.execute(
                select(TeacherProfile.id, User.full_name)
                .join(User, User.id == TeacherProfile.user_id)
                .where(TeacherProfile.tenant_id == tenant_id)
            ).all()
        )

        return [
            ClassOverview(
                **ClassGradeOut.model_validate(c).model_dump(exclude={"grade_band"}),
                student_count=class_counts.get(c.id, 0),
                incharge_name=teacher_names.get(c.incharge_id) if c.incharge_id else None,
                assistant_incharge_name=teacher_names.get(c.assistant_incharge_id) if c.assistant_incharge_id else None,
                sections=[
                    SectionOverview(
                        **SectionOut.model_validate(s).model_dump(),
                        class_teacher_name=teacher_names.get(s.class_teacher_id),
                        student_count=section_counts.get(s.id, 0),
                    )
                    for s in sections
                    if s.class_grade_id == c.id
                ],
                subjects=[SubjectOut.model_validate(s) for s in subjects if s.class_grade_id == c.id],
            )
            for c in classes
        ]

    def list_all_sections(self, tenant_id: uuid.UUID) -> list[SectionWithClass]:
        """Flat list of every section with its class name + student counts — for GET /sections."""
        classes = {c.id: c for c in self.class_grades.list(tenant_id)}
        sections = list(
            self.db.execute(select(Section).where(Section.tenant_id == tenant_id).order_by(Section.name)).scalars()
        )
        section_counts: dict[uuid.UUID, int] = {}
        for section_id, n in self.db.execute(
            select(StudentProfile.section_id, func.count())
            .where(StudentProfile.tenant_id == tenant_id, StudentProfile.status == "active", StudentProfile.section_id.isnot(None))
            .group_by(StudentProfile.section_id)
        ).all():
            section_counts[section_id] = n
        teacher_names = dict(
            self.db.execute(
                select(TeacherProfile.id, User.full_name)
                .join(User, User.id == TeacherProfile.user_id)
                .where(TeacherProfile.tenant_id == tenant_id)
            ).all()
        )
        result = []
        for s in sections:
            cls = classes.get(s.class_grade_id)
            result.append(
                SectionWithClass(
                    **SectionOut.model_validate(s).model_dump(),
                    class_teacher_name=teacher_names.get(s.class_teacher_id),
                    student_count=section_counts.get(s.id, 0),
                    class_name=cls.name if cls else "Unknown",
                    academic_year=cls.academic_year if cls else "",
                    level_order=cls.level_order if cls else 0,
                )
            )
        return result

    def list_all_subjects(self, tenant_id: uuid.UUID) -> list[SubjectWithClass]:
        """Flat list of every subject with its class name — for GET /subjects."""
        classes = {c.id: c for c in self.class_grades.list(tenant_id)}
        subjects = list(
            self.db.execute(select(Subject).where(Subject.tenant_id == tenant_id).order_by(Subject.name)).scalars()
        )
        return [
            SubjectWithClass(
                **SubjectOut.model_validate(s).model_dump(),
                class_name=classes[s.class_grade_id].name if s.class_grade_id in classes else "Unknown",
                academic_year=classes[s.class_grade_id].academic_year if s.class_grade_id in classes else "",
            )
            for s in subjects
        ]

    def create_section(self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID, payload: SectionCreate) -> Section:
        self._get_class_grade_or_404(tenant_id, class_grade_id)
        self._ensure_section_name_free(tenant_id, class_grade_id, payload.name)
        if payload.class_teacher_id is not None:
            self._validate_teacher(tenant_id, payload.class_teacher_id)
        section = self.sections.create(
            Section(
                tenant_id=tenant_id,
                class_grade_id=class_grade_id,
                name=payload.name,
                class_teacher_id=payload.class_teacher_id,
            )
        )
        self.db.commit()
        self.db.refresh(section)
        return section

    def list_sections(self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID) -> list[Section]:
        self._get_class_grade_or_404(tenant_id, class_grade_id)
        return self.sections.list_by_class(tenant_id, class_grade_id)

    def create_subject(self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID, payload: SubjectCreate) -> Subject:
        self._get_class_grade_or_404(tenant_id, class_grade_id)
        self._ensure_subject_code_free(tenant_id, class_grade_id, payload.code)
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

        # Classes created with only the free-text year label have no academic_year_id; match
        # those by label too so promotion doesn't silently skip them.
        def in_year(c: ClassGrade, year: AcademicYear) -> bool:
            return c.academic_year_id == year.id or (c.academic_year_id is None and c.academic_year == year.name)

        all_classes = self.class_grades.list(tenant_id)
        from_classes = [c for c in all_classes if in_year(c, from_year)]
        to_classes_by_level = {c.level_order: c for c in all_classes if in_year(c, to_year)}

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
