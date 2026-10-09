import uuid
from collections import defaultdict

from sqlalchemy.orm import Session

from app.core import exam_pdf_render
from app.core.exceptions import ConflictError, DomainError, ForbiddenError, NotFoundError
from app.models.exam import (
    Exam,
    ExamClass,
    ExamMark,
    ExamSchedule,
    ExamStatus,
    ExamStudentRemark,
    GradingBand,
    GradingScheme,
)
from app.models.user import RoleEnum, StudentProfile, User
from app.repositories.academic_repo import (
    AcademicYearRepository,
    ClassGradeRepository,
    SectionRepository,
    SubjectRepository,
)
from app.repositories.exam_repo import (
    ExamClassRepository,
    ExamMarkRepository,
    ExamRepository,
    ExamScheduleRepository,
    ExamStudentRemarkRepository,
    GradingBandRepository,
    GradingSchemeRepository,
)
from app.repositories.schedule_repo import ClassScheduleRepository
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.teacher_repo import TeacherProfileRepository
from app.repositories.tenant_repo import TenantRepository
from app.schemas.exam import (
    DatesheetSave,
    ExamCreate,
    ExamUpdate,
    GradingBandIn,
    GradingSchemeCreate,
    GradingSchemeUpdate,
    MarksSave,
)
from app.services.parent_service import ParentService

DEFAULT_SCHEME_NAME = "Standard Grading"
DEFAULT_BANDS: list[dict] = [
    {"min_percent": 90, "max_percent": 100, "grade": "A+", "gpa": 4.0, "remarks": "Outstanding"},
    {"min_percent": 80, "max_percent": 89.99, "grade": "A", "gpa": 3.7, "remarks": "Excellent"},
    {"min_percent": 70, "max_percent": 79.99, "grade": "B", "gpa": 3.0, "remarks": "Very Good"},
    {"min_percent": 60, "max_percent": 69.99, "grade": "C", "gpa": 2.5, "remarks": "Good"},
    {"min_percent": 50, "max_percent": 59.99, "grade": "D", "gpa": 2.0, "remarks": "Satisfactory"},
    {"min_percent": 40, "max_percent": 49.99, "grade": "E", "gpa": 1.0, "remarks": "Needs Improvement"},
    {"min_percent": 0, "max_percent": 39.99, "grade": "F", "gpa": 0.0, "remarks": "Fail"},
]


def _f(value) -> float | None:
    return None if value is None else float(value)


def _rank(items: list[dict], key: str) -> None:
    """Standard competition ranking (1, 1, 3) by total_obtained desc. Students with no marks at all
    get no position."""
    ranked = sorted((r for r in items if r["_has_marks"]), key=lambda r: r["total_obtained"], reverse=True)
    previous_total, previous_pos = None, 0
    for index, row in enumerate(ranked, start=1):
        if row["total_obtained"] != previous_total:
            previous_pos = index
            previous_total = row["total_obtained"]
        row[key] = previous_pos


class ExamService:
    def __init__(self, db: Session):
        self.db = db
        self.schemes = GradingSchemeRepository(db)
        self.bands = GradingBandRepository(db)
        self.exams = ExamRepository(db)
        self.exam_classes = ExamClassRepository(db)
        self.schedules = ExamScheduleRepository(db)
        self.marks = ExamMarkRepository(db)
        self.remarks = ExamStudentRemarkRepository(db)
        self.class_grades = ClassGradeRepository(db)
        self.sections = SectionRepository(db)
        self.subjects = SubjectRepository(db)
        self.academic_years = AcademicYearRepository(db)
        self.students = StudentProfileRepository(db)
        self.teachers = TeacherProfileRepository(db)
        self.class_schedules = ClassScheduleRepository(db)
        self.tenants = TenantRepository(db)

    # ------------------------------------------------------------------ grading schemes
    def _scheme_out(self, tenant_id: uuid.UUID, scheme: GradingScheme) -> dict:
        return {
            "id": scheme.id,
            "name": scheme.name,
            "is_default": scheme.is_default,
            "bands": [self._band_dict(b) | {"id": b.id} for b in self.bands.list_by_scheme(tenant_id, scheme.id)],
        }

    @staticmethod
    def _band_dict(band: GradingBand) -> dict:
        return {
            "min_percent": float(band.min_percent),
            "max_percent": float(band.max_percent),
            "grade": band.grade,
            "gpa": _f(band.gpa),
            "remarks": band.remarks,
        }

    def _get_scheme(self, tenant_id: uuid.UUID, scheme_id: uuid.UUID) -> GradingScheme:
        scheme = self.schemes.get_by_id(tenant_id, scheme_id)
        if scheme is None:
            raise NotFoundError("Grading scheme not found")
        return scheme

    def _write_bands(self, tenant_id: uuid.UUID, scheme_id: uuid.UUID, bands: list[GradingBandIn]) -> None:
        ordered = sorted(bands, key=lambda b: b.min_percent)
        for a, b in zip(ordered, ordered[1:]):
            if b.min_percent <= a.max_percent:
                raise DomainError(f"Grade bands {a.grade} and {b.grade} overlap")
        self.bands.delete_by_scheme(tenant_id, scheme_id)
        for band in bands:
            self.bands.create(GradingBand(tenant_id=tenant_id, scheme_id=scheme_id, **band.model_dump()))

    def list_schemes(self, tenant_id: uuid.UUID) -> list[dict]:
        return [self._scheme_out(tenant_id, s) for s in self.schemes.list(tenant_id)]

    def create_scheme(self, tenant_id: uuid.UUID, payload: GradingSchemeCreate) -> dict:
        if self.schemes.get_by_name(tenant_id, payload.name) is not None:
            raise ConflictError("A grading scheme with this name already exists")
        if payload.is_default:
            self.schemes.clear_default(tenant_id)
        scheme = self.schemes.create(
            GradingScheme(tenant_id=tenant_id, name=payload.name, is_default=payload.is_default)
        )
        self._write_bands(tenant_id, scheme.id, payload.bands)
        self.db.commit()
        return self._scheme_out(tenant_id, scheme)

    def update_scheme(self, tenant_id: uuid.UUID, scheme_id: uuid.UUID, payload: GradingSchemeUpdate) -> dict:
        scheme = self._get_scheme(tenant_id, scheme_id)
        if payload.name is not None and payload.name != scheme.name:
            if self.schemes.get_by_name(tenant_id, payload.name) is not None:
                raise ConflictError("A grading scheme with this name already exists")
            scheme.name = payload.name
        if payload.is_default is not None:
            if payload.is_default:
                self.schemes.clear_default(tenant_id)
            scheme.is_default = payload.is_default
        if payload.bands is not None:
            self._write_bands(tenant_id, scheme.id, payload.bands)
        self.db.commit()
        return self._scheme_out(tenant_id, scheme)

    def delete_scheme(self, tenant_id: uuid.UUID, scheme_id: uuid.UUID) -> None:
        scheme = self._get_scheme(tenant_id, scheme_id)
        if self.exams.count_using_scheme(tenant_id, scheme_id):
            raise ConflictError("This grading scheme is used by an exam and cannot be deleted")
        self.bands.delete_by_scheme(tenant_id, scheme_id)
        self.db.delete(scheme)
        self.db.commit()

    def seed_default_scheme(self, tenant_id: uuid.UUID) -> dict:
        existing = self.schemes.get_by_name(tenant_id, DEFAULT_SCHEME_NAME)
        if existing is not None:
            return self._scheme_out(tenant_id, existing)
        make_default = self.schemes.get_default(tenant_id) is None
        scheme = self.schemes.create(
            GradingScheme(tenant_id=tenant_id, name=DEFAULT_SCHEME_NAME, is_default=make_default)
        )
        self._write_bands(tenant_id, scheme.id, [GradingBandIn(**b) for b in DEFAULT_BANDS])
        self.db.commit()
        return self._scheme_out(tenant_id, scheme)

    def _bands_for_exam(self, tenant_id: uuid.UUID, exam: Exam) -> list[dict]:
        scheme_id = exam.grading_scheme_id
        if scheme_id is None:
            default = self.schemes.get_default(tenant_id)
            scheme_id = default.id if default else None
        if scheme_id is not None:
            bands = [self._band_dict(b) for b in self.bands.list_by_scheme(tenant_id, scheme_id)]
            if bands:
                return bands
        return [dict(b) for b in DEFAULT_BANDS]

    @staticmethod
    def _grade_for(percent: float, bands: list[dict]) -> dict | None:
        for band in sorted(bands, key=lambda b: b["min_percent"], reverse=True):
            if percent >= band["min_percent"]:
                return band
        return None

    # ------------------------------------------------------------------ exams
    def get_exam(self, tenant_id: uuid.UUID, exam_id: uuid.UUID) -> Exam:
        exam = self.exams.get_by_id(tenant_id, exam_id)
        if exam is None:
            raise NotFoundError("Exam not found")
        return exam

    def _class_names(self, tenant_id: uuid.UUID) -> dict[uuid.UUID, str]:
        return {c.id: c.name for c in self.class_grades.list(tenant_id)}

    def _exam_out(self, tenant_id: uuid.UUID, exam: Exam, class_ids: list[uuid.UUID] | None = None,
                  class_names: dict | None = None, scheme_names: dict | None = None) -> dict:
        class_names = class_names if class_names is not None else self._class_names(tenant_id)
        if class_ids is None:
            class_ids = self.exam_classes.list_class_ids(tenant_id, exam.id)
        if scheme_names is None:
            scheme = self.schemes.get_by_id(tenant_id, exam.grading_scheme_id) if exam.grading_scheme_id else None
            scheme_name = scheme.name if scheme else None
        else:
            scheme_name = scheme_names.get(exam.grading_scheme_id)
        return {
            "id": exam.id,
            "name": exam.name,
            "academic_year": exam.academic_year,
            "academic_year_id": exam.academic_year_id,
            "start_date": exam.start_date,
            "end_date": exam.end_date,
            "grading_scheme_id": exam.grading_scheme_id,
            "grading_scheme_name": scheme_name,
            "status": exam.status,
            "results_published": exam.results_published,
            "description": exam.description,
            "classes": sorted(
                [{"class_grade_id": cid, "class_name": class_names.get(cid, "—")} for cid in class_ids],
                key=lambda c: c["class_name"],
            ),
        }

    def list_exams(self, tenant_id: uuid.UUID) -> list[dict]:
        exams = self.exams.list(tenant_id)
        class_names = self._class_names(tenant_id)
        scheme_names = {s.id: s.name for s in self.schemes.list(tenant_id)}
        by_exam: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
        for ec in self.exam_classes.list_for_exams(tenant_id, [e.id for e in exams]):
            by_exam[ec.exam_id].append(ec.class_grade_id)
        return [self._exam_out(tenant_id, e, by_exam[e.id], class_names, scheme_names) for e in exams]

    def exam_out(self, tenant_id: uuid.UUID, exam_id: uuid.UUID) -> dict:
        return self._exam_out(tenant_id, self.get_exam(tenant_id, exam_id))

    def _apply_year(self, tenant_id: uuid.UUID, exam: Exam, academic_year_id: uuid.UUID | None) -> None:
        if academic_year_id is None:
            return
        year = self.academic_years.get_by_id(tenant_id, academic_year_id)
        if year is None:
            raise NotFoundError("Academic year not found")
        exam.academic_year_id = year.id
        exam.academic_year = year.name

    def _validate_classes(self, tenant_id: uuid.UUID, class_ids: list[uuid.UUID]) -> list[uuid.UUID]:
        unique = list(dict.fromkeys(class_ids))
        for cid in unique:
            if self.class_grades.get_by_id(tenant_id, cid) is None:
                raise NotFoundError("Class not found")
        return unique

    def create_exam(self, tenant_id: uuid.UUID, payload: ExamCreate) -> dict:
        scheme_id = payload.grading_scheme_id
        if scheme_id is not None:
            self._get_scheme(tenant_id, scheme_id)
        else:
            default = self.schemes.get_default(tenant_id)
            scheme_id = default.id if default else None
        class_ids = self._validate_classes(tenant_id, payload.class_grade_ids)
        exam = Exam(
            tenant_id=tenant_id,
            name=payload.name,
            academic_year=payload.academic_year,
            start_date=payload.start_date,
            end_date=payload.end_date,
            grading_scheme_id=scheme_id,
            description=payload.description,
            status=ExamStatus.DRAFT,
            results_published=False,
        )
        self._apply_year(tenant_id, exam, payload.academic_year_id)
        self.exams.create(exam)
        for cid in class_ids:
            self.exam_classes.create(ExamClass(tenant_id=tenant_id, exam_id=exam.id, class_grade_id=cid))
        self.db.commit()
        return self._exam_out(tenant_id, exam)

    def update_exam(self, tenant_id: uuid.UUID, exam_id: uuid.UUID, payload: ExamUpdate) -> dict:
        exam = self.get_exam(tenant_id, exam_id)
        data = payload.model_dump(exclude_unset=True)
        if "grading_scheme_id" in data and data["grading_scheme_id"] is not None:
            self._get_scheme(tenant_id, data["grading_scheme_id"])
        class_ids = data.pop("class_grade_ids", None)
        year_id = data.pop("academic_year_id", None)
        for field, value in data.items():
            setattr(exam, field, value)
        self._apply_year(tenant_id, exam, year_id)
        if exam.start_date and exam.end_date and exam.end_date < exam.start_date:
            raise DomainError("end_date must be on or after start_date")
        if class_ids is not None:
            new_ids = set(self._validate_classes(tenant_id, class_ids))
            current = set(self.exam_classes.list_class_ids(tenant_id, exam.id))
            removed = list(current - new_ids)
            if removed:
                self.marks.delete_for_exam(tenant_id, exam.id, class_ids=removed)
                self.schedules.delete_for_exam(tenant_id, exam.id, class_ids=removed)
                self.exam_classes.delete_for_exam(tenant_id, exam.id, class_ids=removed)
            for cid in new_ids - current:
                self.exam_classes.create(ExamClass(tenant_id=tenant_id, exam_id=exam.id, class_grade_id=cid))
        self.db.commit()
        return self._exam_out(tenant_id, exam)

    def delete_exam(self, tenant_id: uuid.UUID, exam_id: uuid.UUID) -> None:
        exam = self.get_exam(tenant_id, exam_id)
        self.marks.delete_for_exam(tenant_id, exam.id)
        self.remarks.delete_for_exam(tenant_id, exam.id)
        self.schedules.delete_for_exam(tenant_id, exam.id)
        self.exam_classes.delete_for_exam(tenant_id, exam.id)
        self.db.delete(exam)
        self.db.commit()

    def set_results_published(self, tenant_id: uuid.UUID, exam_id: uuid.UUID, published: bool) -> dict:
        exam = self.get_exam(tenant_id, exam_id)
        exam.results_published = published
        if published:
            exam.status = ExamStatus.PUBLISHED
        self.db.commit()
        return self._exam_out(tenant_id, exam)

    def _assert_exam_class(self, tenant_id: uuid.UUID, exam: Exam, class_grade_id: uuid.UUID) -> None:
        if class_grade_id not in self.exam_classes.list_class_ids(tenant_id, exam.id):
            raise DomainError("This class is not part of the exam")

    # ------------------------------------------------------------------ datesheet
    def get_datesheet(self, tenant_id: uuid.UUID, exam_id: uuid.UUID, class_grade_id: uuid.UUID | None) -> list[dict]:
        exam = self.get_exam(tenant_id, exam_id)
        class_names = self._class_names(tenant_id)
        subjects: dict[uuid.UUID, object] = {}
        out = []
        for row in self.schedules.list_for_exam(tenant_id, exam.id, class_grade_id):
            subject = subjects.get(row.subject_id) or self.subjects.get_by_id(tenant_id, row.subject_id)
            subjects[row.subject_id] = subject
            out.append(
                {
                    "id": row.id,
                    "class_grade_id": row.class_grade_id,
                    "class_name": class_names.get(row.class_grade_id, "—"),
                    "subject_id": row.subject_id,
                    "subject_name": subject.name if subject else "—",
                    "subject_code": subject.code if subject else "",
                    "exam_date": row.exam_date,
                    "start_time": row.start_time,
                    "end_time": row.end_time,
                    "total_marks": float(row.total_marks),
                    "passing_marks": float(row.passing_marks),
                    "room": row.room,
                }
            )
        out.sort(key=lambda r: (r["class_name"], r["exam_date"] is None, r["exam_date"] or 0, r["subject_name"]))
        return out

    def save_datesheet(self, tenant_id: uuid.UUID, exam_id: uuid.UUID, payload: DatesheetSave) -> list[dict]:
        exam = self.get_exam(tenant_id, exam_id)
        self._assert_exam_class(tenant_id, exam, payload.class_grade_id)
        seen: set[uuid.UUID] = set()
        for entry in payload.entries:
            if entry.subject_id in seen:
                raise DomainError("A subject appears more than once in the datesheet")
            seen.add(entry.subject_id)
            subject = self.subjects.get_by_id(tenant_id, entry.subject_id)
            if subject is None or subject.class_grade_id != payload.class_grade_id:
                raise NotFoundError("Subject not found for this class")
        existing = {s.subject_id: s for s in self.schedules.list_for_exam(tenant_id, exam.id, payload.class_grade_id)}
        for subject_id, row in existing.items():
            if subject_id not in seen:
                self.marks.delete_for_exam(
                    tenant_id, exam.id, class_grade_id=payload.class_grade_id, subject_id=subject_id
                )
                self.db.delete(row)
        for entry in payload.entries:
            row = existing.get(entry.subject_id)
            if row is None:
                row = self.schedules.create(
                    ExamSchedule(
                        tenant_id=tenant_id,
                        exam_id=exam.id,
                        class_grade_id=payload.class_grade_id,
                        subject_id=entry.subject_id,
                        total_marks=entry.total_marks,
                        passing_marks=entry.passing_marks,
                    )
                )
            for field in ("exam_date", "start_time", "end_time", "total_marks", "passing_marks", "room"):
                setattr(row, field, getattr(entry, field))
        self.db.commit()
        return self.get_datesheet(tenant_id, exam.id, payload.class_grade_id)

    def datesheet_pdf(self, tenant_id: uuid.UUID, exam_id: uuid.UUID, class_grade_id: uuid.UUID) -> bytes:
        exam = self.get_exam(tenant_id, exam_id)
        class_grade = self.class_grades.get_by_id(tenant_id, class_grade_id)
        if class_grade is None:
            raise NotFoundError("Class not found")
        rows = self.get_datesheet(tenant_id, exam.id, class_grade_id)
        return exam_pdf_render.render_datesheet(
            tenant_name=self._tenant_name(tenant_id),
            exam_name=exam.name,
            academic_year=exam.academic_year,
            class_name=class_grade.name,
            rows=rows,
        )

    # ------------------------------------------------------------------ access helpers
    def _tenant_name(self, tenant_id: uuid.UUID) -> str:
        tenant = self.tenants.get_by_id(tenant_id)
        return tenant.name if tenant is not None else "School"

    def _teacher_profile_or_403(self, user: User):
        profile = self.teachers.get_by_user_id(user.tenant_id, user.id)
        if profile is None:
            raise ForbiddenError("Not a teacher")
        return profile

    def _assert_teacher_teaches(self, user: User, section_id: uuid.UUID | None, subject_id: uuid.UUID) -> None:
        """Same rule as assignments/quizzes: the teacher must have an active timetable slot for
        this section+subject."""
        if section_id is None:
            raise ForbiddenError("Teachers must select a section")
        profile = self._teacher_profile_or_403(user)
        if not any(
            s.teacher_id == profile.id and s.section_id == section_id and s.subject_id == subject_id
            for s in self.class_schedules.list_active(user.tenant_id)
        ):
            raise ForbiddenError("You are not scheduled to teach this class/subject")

    def list_teacher_subjects(self, user: User) -> list[dict]:
        profile = self._teacher_profile_or_403(user)
        tenant_id = user.tenant_id
        class_names = self._class_names(tenant_id)
        seen: set[tuple] = set()
        out = []
        for s in self.class_schedules.list_active(tenant_id):
            if s.teacher_id != profile.id or (s.section_id, s.subject_id) in seen:
                continue
            seen.add((s.section_id, s.subject_id))
            section = self.sections.get_by_id(tenant_id, s.section_id)
            subject = self.subjects.get_by_id(tenant_id, s.subject_id)
            if section is None or subject is None:
                continue
            out.append(
                {
                    "class_grade_id": section.class_grade_id,
                    "class_name": class_names.get(section.class_grade_id, "—"),
                    "section_id": section.id,
                    "section_name": section.name,
                    "subject_id": subject.id,
                    "subject_name": subject.name,
                }
            )
        out.sort(key=lambda r: (r["class_name"], r["section_name"], r["subject_name"]))
        return out

    def resolve_student_for_viewer(self, user: User, student_id: uuid.UUID | None) -> StudentProfile:
        """Students resolve to themselves; parents must name a linked child; staff any student."""
        tenant_id = user.tenant_id
        if user.role == RoleEnum.STUDENT:
            profile = self.students.get_by_user_id(tenant_id, user.id)
            if profile is None:
                raise ForbiddenError("Not a student")
            if student_id is not None and student_id != profile.id:
                raise ForbiddenError("You can only view your own results")
            return profile
        if student_id is None:
            raise DomainError("student_id is required")
        if user.role == RoleEnum.PARENT:
            ParentService(self.db).assert_child(tenant_id, user.id, student_id)
        profile = self.students.get_by_id(tenant_id, student_id)
        if profile is None:
            raise NotFoundError("Student not found")
        return profile

    def assert_can_view_datesheet(self, user: User, exam_id: uuid.UUID, class_grade_id: uuid.UUID | None,
                                  student_id: uuid.UUID | None) -> uuid.UUID | None:
        """Returns the class the viewer may see (forced to the child's class for student/parent)."""
        if user.role in (RoleEnum.ADMIN, RoleEnum.TEACHER):
            return class_grade_id
        exam = self.get_exam(user.tenant_id, exam_id)
        if exam.status != ExamStatus.PUBLISHED:
            raise ForbiddenError("This exam has not been published yet")
        profile = self.resolve_student_for_viewer(user, student_id)
        if profile.class_grade_id is None:
            raise ForbiddenError("Student is not assigned to a class")
        return profile.class_grade_id

    # ------------------------------------------------------------------ marks
    def _class_students(
        self, tenant_id: uuid.UUID, exam_id: uuid.UUID, class_grade_id: uuid.UUID, section_id: uuid.UUID | None = None
    ) -> list[tuple[StudentProfile, User]]:
        """Active students currently in the class, plus anyone who already has marks recorded for
        this exam+class (e.g. withdrawn after sitting the exam)."""
        rows = {p.id: (p, u) for p, u in self.students.list_with_users(tenant_id, class_grade_id=class_grade_id, status="active")}
        for mark in self.marks.list_for_exam(tenant_id, exam_id, class_grade_id=class_grade_id):
            if mark.student_id not in rows:
                found = self.students.get_with_user(tenant_id, mark.student_id)
                if found is not None:
                    profile, user = found
                    rows[profile.id] = (profile, user)
        result = list(rows.values())
        if section_id is not None:
            result = [(p, u) for p, u in result if p.section_id == section_id]
        result.sort(key=lambda pu: ((pu[0].roll_number or "").zfill(10), pu[1].full_name))
        return result

    def _schedule_or_404(self, tenant_id, exam_id, class_grade_id, subject_id) -> ExamSchedule:
        schedule = self.schedules.get_for_subject(tenant_id, exam_id, class_grade_id, subject_id)
        if schedule is None:
            raise NotFoundError("This subject is not on the exam datesheet for this class")
        return schedule

    def _check_marks_access(self, user: User, exam: Exam, class_grade_id, section_id, subject_id) -> None:
        self._assert_exam_class(user.tenant_id, exam, class_grade_id)
        if section_id is not None:
            section = self.sections.get_by_id(user.tenant_id, section_id)
            if section is None or section.class_grade_id != class_grade_id:
                raise NotFoundError("Section not found for this class")
        if user.role == RoleEnum.TEACHER:
            self._assert_teacher_teaches(user, section_id, subject_id)

    def get_marks_sheet(self, user: User, exam_id, class_grade_id, section_id, subject_id) -> dict:
        tenant_id = user.tenant_id
        exam = self.get_exam(tenant_id, exam_id)
        self._check_marks_access(user, exam, class_grade_id, section_id, subject_id)
        schedule = self._schedule_or_404(tenant_id, exam.id, class_grade_id, subject_id)
        subject = self.subjects.get_by_id(tenant_id, subject_id)
        marks = {m.student_id: m for m in self.marks.list_for_exam(tenant_id, exam.id, class_grade_id, subject_id)}
        rows = []
        for profile, student_user in self._class_students(tenant_id, exam.id, class_grade_id, section_id):
            mark = marks.get(profile.id)
            rows.append(
                {
                    "student_id": profile.id,
                    "full_name": student_user.full_name,
                    "roll_number": profile.roll_number,
                    "admission_number": profile.admission_number,
                    "section_id": profile.section_id,
                    "obtained_marks": _f(mark.obtained_marks) if mark else None,
                    "is_absent": mark.is_absent if mark else False,
                    "remarks": mark.remarks if mark else None,
                }
            )
        return {
            "exam_id": exam.id,
            "class_grade_id": class_grade_id,
            "section_id": section_id,
            "subject_id": subject_id,
            "subject_name": subject.name if subject else "—",
            "total_marks": float(schedule.total_marks),
            "passing_marks": float(schedule.passing_marks),
            "locked": exam.results_published and user.role != RoleEnum.ADMIN,
            "rows": rows,
        }

    def save_marks(self, user: User, exam_id: uuid.UUID, payload: MarksSave) -> dict:
        tenant_id = user.tenant_id
        exam = self.get_exam(tenant_id, exam_id)
        self._check_marks_access(user, exam, payload.class_grade_id, payload.section_id, payload.subject_id)
        if exam.results_published and user.role != RoleEnum.ADMIN:
            raise ForbiddenError("Results are published; marks are locked")
        schedule = self._schedule_or_404(tenant_id, exam.id, payload.class_grade_id, payload.subject_id)
        total = float(schedule.total_marks)
        allowed = {p.id: p for p, _ in self._class_students(tenant_id, exam.id, payload.class_grade_id, payload.section_id)}
        existing = {
            m.student_id: m
            for m in self.marks.list_for_exam(tenant_id, exam.id, payload.class_grade_id, payload.subject_id)
        }
        for entry in payload.entries:
            profile = allowed.get(entry.student_id)
            if profile is None:
                raise DomainError("Student does not belong to this class/section")
            if entry.obtained_marks is not None and entry.obtained_marks > total:
                raise DomainError(f"Obtained marks cannot exceed total marks ({total:g})")
            obtained = None if entry.is_absent else entry.obtained_marks
            mark = existing.get(entry.student_id)
            if mark is None:
                if obtained is None and not entry.is_absent and not entry.remarks:
                    continue
                mark = self.marks.create(
                    ExamMark(
                        tenant_id=tenant_id,
                        exam_id=exam.id,
                        class_grade_id=payload.class_grade_id,
                        subject_id=payload.subject_id,
                        student_id=entry.student_id,
                    )
                )
            mark.section_id = profile.section_id
            mark.obtained_marks = obtained
            mark.is_absent = entry.is_absent
            mark.remarks = entry.remarks or None
            mark.entered_by_user_id = user.id
        self.db.commit()
        return self.get_marks_sheet(user, exam.id, payload.class_grade_id, payload.section_id, payload.subject_id)

    def save_student_remarks(self, tenant_id: uuid.UUID, exam_id: uuid.UUID, student_id: uuid.UUID, remarks: str) -> None:
        exam = self.get_exam(tenant_id, exam_id)
        if self.students.get_by_id(tenant_id, student_id) is None:
            raise NotFoundError("Student not found")
        row = self.remarks.get_for_student(tenant_id, exam.id, student_id)
        if not remarks.strip():
            if row is not None:
                self.db.delete(row)
        elif row is None:
            self.remarks.create(ExamStudentRemark(tenant_id=tenant_id, exam_id=exam.id, student_id=student_id, remarks=remarks))
        else:
            row.remarks = remarks
        self.db.commit()

    # ------------------------------------------------------------------ results
    def _compute_class(self, tenant_id: uuid.UUID, exam: Exam, class_grade_id: uuid.UUID) -> tuple[list[dict], list[dict]]:
        bands = self._bands_for_exam(tenant_id, exam)
        schedule_rows = self.schedules.list_for_exam(tenant_id, exam.id, class_grade_id)
        headers = []
        for row in schedule_rows:
            subject = self.subjects.get_by_id(tenant_id, row.subject_id)
            headers.append(
                {
                    "subject_id": row.subject_id,
                    "subject_name": subject.name if subject else "—",
                    "subject_code": subject.code if subject else "",
                    "total_marks": float(row.total_marks),
                    "passing_marks": float(row.passing_marks),
                }
            )
        marks = {(m.student_id, m.subject_id): m for m in self.marks.list_for_exam(tenant_id, exam.id, class_grade_id)}
        overall_remarks = self.remarks.map_for_exam(tenant_id, exam.id)
        section_names = {s.id: s.name for s in self.sections.list_by_class(tenant_id, class_grade_id)}
        results = []
        for profile, student_user in self._class_students(tenant_id, exam.id, class_grade_id):
            subjects_out, total_obtained, total_marks, all_passed, has_marks = [], 0.0, 0.0, True, False
            for h in headers:
                mark = marks.get((profile.id, h["subject_id"]))
                obtained = _f(mark.obtained_marks) if mark else None
                absent = bool(mark and mark.is_absent)
                if mark and (obtained is not None or absent):
                    has_marks = True
                passed = obtained is not None and not absent and obtained >= h["passing_marks"]
                all_passed = all_passed and passed
                total_obtained += obtained or 0.0
                total_marks += h["total_marks"]
                sub_pct = (obtained / h["total_marks"] * 100) if obtained is not None and h["total_marks"] else None
                sub_band = self._grade_for(sub_pct, bands) if sub_pct is not None else None
                subjects_out.append(
                    {
                        "subject_id": h["subject_id"],
                        "subject_name": h["subject_name"],
                        "total_marks": h["total_marks"],
                        "passing_marks": h["passing_marks"],
                        "obtained_marks": obtained,
                        "is_absent": absent,
                        "grade": "ABS" if absent else (sub_band["grade"] if sub_band else None),
                        "passed": passed,
                        "remarks": mark.remarks if mark else None,
                    }
                )
            percentage = round(total_obtained / total_marks * 100, 2) if total_marks else 0.0
            band = self._grade_for(percentage, bands) if has_marks else None
            results.append(
                {
                    "student_id": profile.id,
                    "full_name": student_user.full_name,
                    "roll_number": profile.roll_number,
                    "admission_number": profile.admission_number,
                    "guardian_name": profile.guardian_name,
                    "section_id": profile.section_id,
                    "section_name": section_names.get(profile.section_id) if profile.section_id else None,
                    "subjects": subjects_out,
                    "total_obtained": round(total_obtained, 2),
                    "total_marks": round(total_marks, 2),
                    "percentage": percentage,
                    "grade": band["grade"] if band else None,
                    "gpa": band.get("gpa") if band else None,
                    "grade_remarks": band.get("remarks") if band else None,
                    "passed": bool(headers) and has_marks and all_passed,
                    "position": None,
                    "section_position": None,
                    "remarks": overall_remarks.get(profile.id),
                    "_has_marks": has_marks,
                }
            )
        _rank(results, "position")
        by_section: dict = defaultdict(list)
        for r in results:
            by_section[r["section_id"]].append(r)
        for group in by_section.values():
            _rank(group, "section_position")
        return headers, results

    @staticmethod
    def _clean(row: dict) -> dict:
        return {k: v for k, v in row.items() if not k.startswith("_")}

    def tabulation(self, tenant_id: uuid.UUID, exam_id: uuid.UUID, class_grade_id: uuid.UUID,
                   section_id: uuid.UUID | None = None) -> dict:
        exam = self.get_exam(tenant_id, exam_id)
        self._assert_exam_class(tenant_id, exam, class_grade_id)
        class_grade = self.class_grades.get_by_id(tenant_id, class_grade_id)
        headers, results = self._compute_class(tenant_id, exam, class_grade_id)
        if section_id is not None:
            results = [r for r in results if r["section_id"] == section_id]
        results.sort(key=lambda r: (r["position"] is None, r["position"] or 0, r["full_name"]))
        return {
            "exam_id": exam.id,
            "exam_name": exam.name,
            "class_grade_id": class_grade_id,
            "class_name": class_grade.name if class_grade else "—",
            "section_id": section_id,
            "results_published": exam.results_published,
            "subjects": headers,
            "rows": [self._clean(r) for r in results],
        }

    def tabulation_pdf(self, tenant_id: uuid.UUID, exam_id: uuid.UUID, class_grade_id: uuid.UUID,
                       section_id: uuid.UUID | None = None) -> bytes:
        data = self.tabulation(tenant_id, exam_id, class_grade_id, section_id)
        section_name = None
        if section_id is not None:
            section = self.sections.get_by_id(tenant_id, section_id)
            section_name = section.name if section else None
        exam = self.get_exam(tenant_id, exam_id)
        return exam_pdf_render.render_tabulation(
            tenant_name=self._tenant_name(tenant_id),
            exam_name=exam.name,
            academic_year=exam.academic_year,
            class_name=data["class_name"],
            section_name=section_name,
            subjects=data["subjects"],
            rows=data["rows"],
        )

    def _student_result_raw(self, user: User, exam_id: uuid.UUID, student_id: uuid.UUID | None) -> tuple[Exam, dict, str, int]:
        tenant_id = user.tenant_id
        exam = self.get_exam(tenant_id, exam_id)
        profile = self.resolve_student_for_viewer(user, student_id)
        if user.role in (RoleEnum.STUDENT, RoleEnum.PARENT) and not exam.results_published:
            raise ForbiddenError("Results for this exam have not been published yet")
        class_grade_id = self._student_exam_class(tenant_id, exam.id, profile)
        if class_grade_id is None:
            raise NotFoundError("No result found for this student in this exam")
        _, results = self._compute_class(tenant_id, exam, class_grade_id)
        row = next((r for r in results if r["student_id"] == profile.id), None)
        if row is None:
            raise NotFoundError("No result found for this student in this exam")
        class_grade = self.class_grades.get_by_id(tenant_id, class_grade_id)
        return exam, row, (class_grade.name if class_grade else "—"), len(results)

    def _student_exam_class(self, tenant_id: uuid.UUID, exam_id: uuid.UUID, profile: StudentProfile) -> uuid.UUID | None:
        marks = self.marks.list_for_exam(tenant_id, exam_id, student_id=profile.id)
        if marks:
            return marks[0].class_grade_id
        if profile.class_grade_id in self.exam_classes.list_class_ids(tenant_id, exam_id):
            return profile.class_grade_id
        return None

    def student_result(self, user: User, exam_id: uuid.UUID, student_id: uuid.UUID | None) -> dict:
        exam, row, class_name, strength = self._student_result_raw(user, exam_id, student_id)
        return {
            "exam_id": exam.id,
            "exam_name": exam.name,
            "academic_year": exam.academic_year,
            "start_date": exam.start_date,
            "end_date": exam.end_date,
            "class_name": class_name,
            "class_strength": strength,
            "result": self._clean(row),
        }

    def result_card_pdf(self, user: User, exam_id: uuid.UUID, student_id: uuid.UUID | None) -> bytes:
        exam, row, class_name, strength = self._student_result_raw(user, exam_id, student_id)
        return exam_pdf_render.render_result_card(
            tenant_name=self._tenant_name(user.tenant_id),
            exam_name=exam.name,
            academic_year=exam.academic_year,
            class_name=class_name,
            class_strength=strength,
            result=row,
        )

    def my_exams(self, user: User, student_id: uuid.UUID | None) -> list[dict]:
        """Published exams relevant to the student (their class takes part or they have marks),
        with a result summary when results are published."""
        tenant_id = user.tenant_id
        profile = self.resolve_student_for_viewer(user, student_id)
        out = []
        for exam in self.exams.list(tenant_id):
            if exam.status != ExamStatus.PUBLISHED and not exam.results_published:
                continue
            class_grade_id = self._student_exam_class(tenant_id, exam.id, profile)
            if class_grade_id is None:
                continue
            item = {
                "exam_id": exam.id,
                "student_id": profile.id,
                "exam_name": exam.name,
                "academic_year": exam.academic_year,
                "start_date": exam.start_date,
                "end_date": exam.end_date,
                "status": exam.status,
                "results_published": exam.results_published,
            }
            if exam.results_published:
                _, results = self._compute_class(tenant_id, exam, class_grade_id)
                row = next((r for r in results if r["student_id"] == profile.id), None)
                if row is not None:
                    item.update(
                        percentage=row["percentage"], grade=row["grade"], position=row["position"], passed=row["passed"]
                    )
            out.append(item)
        return out
