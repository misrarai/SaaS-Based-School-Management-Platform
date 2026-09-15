import uuid
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.course import Chapter, Course, CourseEnrollment, EnrollmentStatus, TeacherAssignment
from app.repositories.academic_repo import AcademicYearRepository, ClassGradeRepository, SectionRepository, SubjectRepository
from app.repositories.course_repo import (
    ChapterRepository,
    CourseEnrollmentRepository,
    CourseRepository,
    TeacherAssignmentRepository,
)
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.teacher_repo import TeacherProfileRepository
from app.schemas.course import (
    ChapterCreate,
    ChapterUpdate,
    CourseEnrollmentOut,
    CourseOut,
    CourseTeacherSummary,
    TeacherAssignmentOut,
    TeacherStudentSummary,
)


class CourseService:
    def __init__(self, db: Session):
        self.db = db
        self.academic_years = AcademicYearRepository(db)
        self.class_grades = ClassGradeRepository(db)
        self.sections = SectionRepository(db)
        self.subjects = SubjectRepository(db)
        self.courses = CourseRepository(db)
        self.assignments = TeacherAssignmentRepository(db)
        self.enrollments = CourseEnrollmentRepository(db)
        self.chapters = ChapterRepository(db)
        self.students = StudentProfileRepository(db)
        self.teachers = TeacherProfileRepository(db)

    def _today(self) -> date:
        return datetime.now(timezone.utc).date()

    def create_course(self, tenant_id: uuid.UUID, academic_year_id: uuid.UUID, section_id: uuid.UUID, subject_id: uuid.UUID) -> Course:
        if self.academic_years.get_by_id(tenant_id, academic_year_id) is None:
            raise NotFoundError("Academic year not found")

        section = self.sections.get_by_id(tenant_id, section_id)
        if section is None:
            raise NotFoundError("Section not found")

        subject = self.subjects.get_by_id(tenant_id, subject_id)
        if subject is None:
            raise NotFoundError("Subject not found")
        if subject.class_grade_id != section.class_grade_id:
            raise ConflictError("Subject does not belong to the same grade as the section")

        if self.courses.get_by_offering(tenant_id, academic_year_id, section_id, subject_id) is not None:
            raise ConflictError("A course already exists for this subject, section and academic year")

        course = self.courses.create(
            Course(
                tenant_id=tenant_id,
                academic_year_id=academic_year_id,
                class_grade_id=section.class_grade_id,
                section_id=section_id,
                subject_id=subject_id,
            )
        )
        self.db.flush()

        # A course starts out covering every currently-active student in its section — the
        # common case (a compulsory subject). Electives are then adjusted per-student afterward.
        for profile, _user in self.students.list_with_users(tenant_id, section_id=section_id, status="active"):
            self.enrollments.create(
                CourseEnrollment(
                    tenant_id=tenant_id,
                    course_id=course.id,
                    student_id=profile.id,
                    enrolled_date=self._today(),
                    status=EnrollmentStatus.ACTIVE,
                )
            )

        self.db.commit()
        self.db.refresh(course)
        return course

    def get_course_or_404(self, tenant_id: uuid.UUID, course_id: uuid.UUID) -> Course:
        course = self.courses.get_by_id(tenant_id, course_id)
        if course is None:
            raise NotFoundError("Course not found")
        return course

    def _to_out(self, course: Course) -> CourseOut:
        academic_year = self.academic_years.get_by_id(course.tenant_id, course.academic_year_id)
        section = self.sections.get_by_id(course.tenant_id, course.section_id)
        subject = self.subjects.get_by_id(course.tenant_id, course.subject_id)
        class_grade = self.class_grades.get_by_id(course.tenant_id, course.class_grade_id)

        teachers = []
        for assignment in self.assignments.list_by_course(course.tenant_id, course.id):
            found = self.teachers.get_with_user(course.tenant_id, assignment.teacher_id)
            if found is not None:
                _, user = found
                teachers.append(CourseTeacherSummary(teacher_id=assignment.teacher_id, full_name=user.full_name, email=user.email))

        student_count = len(self.enrollments.list_by_course(course.tenant_id, course.id))

        return CourseOut(
            id=course.id,
            academic_year_id=course.academic_year_id,
            academic_year_name=academic_year.name if academic_year else "",
            class_grade_id=course.class_grade_id,
            class_grade_name=class_grade.name if class_grade else "",
            section_id=course.section_id,
            section_name=section.name if section else "",
            subject_id=course.subject_id,
            subject_name=subject.name if subject else "",
            is_active=course.is_active,
            teachers=teachers,
            student_count=student_count,
        )

    def list_courses_out(
        self,
        tenant_id: uuid.UUID,
        academic_year_id: uuid.UUID | None = None,
        class_grade_id: uuid.UUID | None = None,
        section_id: uuid.UUID | None = None,
        subject_id: uuid.UUID | None = None,
    ) -> list[CourseOut]:
        courses = self.courses.list(tenant_id, academic_year_id, class_grade_id, section_id, subject_id)
        return [self._to_out(c) for c in courses]

    def list_courses_for_teacher(self, tenant_id: uuid.UUID, teacher_id: uuid.UUID) -> list[CourseOut]:
        course_ids = self.assignments.list_course_ids_for_teacher(tenant_id, teacher_id)
        return [self._to_out(c) for c in self.courses.list_by_ids(tenant_id, course_ids)]

    def list_courses_for_student(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> list[CourseOut]:
        course_ids = self.enrollments.list_course_ids_for_student(tenant_id, student_id)
        return [self._to_out(c) for c in self.courses.list_by_ids(tenant_id, course_ids)]

    def list_students_for_teacher(self, tenant_id: uuid.UUID, teacher_id: uuid.UUID) -> list[TeacherStudentSummary]:
        """Union of every student enrolled in any course this teacher is assigned to — a student
        taking two of the teacher's subjects appears once, with both subjects listed."""
        course_ids = self.assignments.list_course_ids_for_teacher(tenant_id, teacher_id)
        by_student: dict[uuid.UUID, TeacherStudentSummary] = {}

        for course in self.courses.list_by_ids(tenant_id, course_ids):
            section = self.sections.get_by_id(tenant_id, course.section_id)
            class_grade = self.class_grades.get_by_id(tenant_id, course.class_grade_id)
            subject = self.subjects.get_by_id(tenant_id, course.subject_id)
            subject_name = subject.name if subject else ""

            for enrollment in self.enrollments.list_by_course(tenant_id, course.id):
                found = self.students.get_with_user(tenant_id, enrollment.student_id)
                if found is None:
                    continue
                _, user = found

                existing = by_student.get(enrollment.student_id)
                if existing is None:
                    by_student[enrollment.student_id] = TeacherStudentSummary(
                        student_id=enrollment.student_id,
                        full_name=user.full_name,
                        email=user.email,
                        class_grade_name=class_grade.name if class_grade else "",
                        section_name=section.name if section else "",
                        subjects=[subject_name] if subject_name else [],
                    )
                elif subject_name and subject_name not in existing.subjects:
                    existing.subjects.append(subject_name)

        return sorted(by_student.values(), key=lambda s: s.full_name)

    def get_course_out_scoped(self, tenant_id: uuid.UUID, course_id: uuid.UUID, teacher_id: uuid.UUID | None = None, student_id: uuid.UUID | None = None) -> CourseOut:
        course = self.get_course_or_404(tenant_id, course_id)
        if teacher_id is not None and not self.assignments.is_teacher_assigned(tenant_id, course_id, teacher_id):
            raise ForbiddenError("You are not assigned to this course")
        if student_id is not None and self.enrollments.get_active(tenant_id, course_id, student_id) is None:
            raise ForbiddenError("You are not enrolled in this course")
        return self._to_out(course)

    # --- Teacher assignment -------------------------------------------------

    def assign_teacher(self, tenant_id: uuid.UUID, course_id: uuid.UUID, teacher_id: uuid.UUID) -> TeacherAssignmentOut:
        course = self.get_course_or_404(tenant_id, course_id)
        found = self.teachers.get_with_user(tenant_id, teacher_id)
        if found is None:
            raise NotFoundError("Teacher not found")
        teacher_profile, user = found

        existing = self.assignments.get_any(tenant_id, course.id, teacher_id)
        if existing is not None:
            if existing.is_active:
                raise ConflictError("This teacher is already assigned to this course")
            existing.is_active = True
            existing.assigned_date = self._today()
            assignment = existing
        else:
            assignment = self.assignments.create(
                TeacherAssignment(
                    tenant_id=tenant_id,
                    course_id=course.id,
                    teacher_id=teacher_id,
                    assigned_date=self._today(),
                    is_active=True,
                )
            )

        self.db.commit()
        self.db.refresh(assignment)
        return TeacherAssignmentOut(
            id=assignment.id,
            course_id=assignment.course_id,
            teacher_id=assignment.teacher_id,
            full_name=user.full_name,
            email=user.email,
            assigned_date=assignment.assigned_date,
            is_active=assignment.is_active,
        )

    def unassign_teacher(self, tenant_id: uuid.UUID, course_id: uuid.UUID, teacher_id: uuid.UUID) -> None:
        self.get_course_or_404(tenant_id, course_id)
        assignment = self.assignments.get_active(tenant_id, course_id, teacher_id)
        if assignment is None:
            raise NotFoundError("This teacher is not assigned to this course")
        assignment.is_active = False
        self.db.commit()

    def list_course_teachers(self, tenant_id: uuid.UUID, course_id: uuid.UUID) -> list[TeacherAssignmentOut]:
        self.get_course_or_404(tenant_id, course_id)
        out = []
        for assignment in self.assignments.list_by_course(tenant_id, course_id):
            found = self.teachers.get_with_user(tenant_id, assignment.teacher_id)
            if found is None:
                continue
            _, user = found
            out.append(
                TeacherAssignmentOut(
                    id=assignment.id,
                    course_id=assignment.course_id,
                    teacher_id=assignment.teacher_id,
                    full_name=user.full_name,
                    email=user.email,
                    assigned_date=assignment.assigned_date,
                    is_active=assignment.is_active,
                )
            )
        return out

    # --- Student enrollment -------------------------------------------------

    def enroll_student(self, tenant_id: uuid.UUID, course_id: uuid.UUID, student_id: uuid.UUID) -> CourseEnrollmentOut:
        course = self.get_course_or_404(tenant_id, course_id)
        found = self.students.get_with_user(tenant_id, student_id)
        if found is None:
            raise NotFoundError("Student not found")
        student_profile, user = found

        existing = self.enrollments.get_any(tenant_id, course.id, student_id)
        if existing is not None:
            if existing.status == EnrollmentStatus.ACTIVE:
                raise ConflictError("This student is already enrolled in this course")
            existing.status = EnrollmentStatus.ACTIVE
            existing.enrolled_date = self._today()
            enrollment = existing
        else:
            enrollment = self.enrollments.create(
                CourseEnrollment(
                    tenant_id=tenant_id,
                    course_id=course.id,
                    student_id=student_id,
                    enrolled_date=self._today(),
                    status=EnrollmentStatus.ACTIVE,
                )
            )

        self.db.commit()
        self.db.refresh(enrollment)
        return CourseEnrollmentOut(
            id=enrollment.id,
            course_id=enrollment.course_id,
            student_id=enrollment.student_id,
            full_name=user.full_name,
            email=user.email,
            enrolled_date=enrollment.enrolled_date,
            status=enrollment.status,
        )

    def drop_student(self, tenant_id: uuid.UUID, course_id: uuid.UUID, student_id: uuid.UUID) -> None:
        self.get_course_or_404(tenant_id, course_id)
        enrollment = self.enrollments.get_active(tenant_id, course_id, student_id)
        if enrollment is None:
            raise NotFoundError("This student is not enrolled in this course")
        enrollment.status = EnrollmentStatus.DROPPED
        self.db.commit()

    def list_course_students(self, tenant_id: uuid.UUID, course_id: uuid.UUID) -> list[CourseEnrollmentOut]:
        self.get_course_or_404(tenant_id, course_id)
        out = []
        for enrollment in self.enrollments.list_by_course(tenant_id, course_id):
            found = self.students.get_with_user(tenant_id, enrollment.student_id)
            if found is None:
                continue
            _, user = found
            out.append(
                CourseEnrollmentOut(
                    id=enrollment.id,
                    course_id=enrollment.course_id,
                    student_id=enrollment.student_id,
                    full_name=user.full_name,
                    email=user.email,
                    enrolled_date=enrollment.enrolled_date,
                    status=enrollment.status,
                )
            )
        return out

    # --- Chapters -------------------------------------------------

    def create_chapter(self, tenant_id: uuid.UUID, course_id: uuid.UUID, payload: ChapterCreate) -> Chapter:
        self.get_course_or_404(tenant_id, course_id)
        existing = [c for c in self.chapters.list_by_course(tenant_id, course_id) if c.title == payload.title]
        if existing:
            raise ConflictError(f"A chapter titled '{payload.title}' already exists in this course")

        chapter = self.chapters.create(
            Chapter(
                tenant_id=tenant_id,
                course_id=course_id,
                title=payload.title,
                description=payload.description,
                order_index=payload.order_index,
            )
        )
        self.db.commit()
        self.db.refresh(chapter)
        return chapter

    def list_chapters(self, tenant_id: uuid.UUID, course_id: uuid.UUID) -> list[Chapter]:
        self.get_course_or_404(tenant_id, course_id)
        return self.chapters.list_by_course(tenant_id, course_id)

    def get_chapter_or_404(self, tenant_id: uuid.UUID, chapter_id: uuid.UUID) -> Chapter:
        chapter = self.chapters.get_by_id(tenant_id, chapter_id)
        if chapter is None:
            raise NotFoundError("Chapter not found")
        return chapter

    def update_chapter(self, tenant_id: uuid.UUID, chapter_id: uuid.UUID, payload: ChapterUpdate) -> Chapter:
        chapter = self.get_chapter_or_404(tenant_id, chapter_id)
        if payload.title is not None:
            chapter.title = payload.title
        if payload.description is not None:
            chapter.description = payload.description
        if payload.order_index is not None:
            chapter.order_index = payload.order_index
        self.db.commit()
        self.db.refresh(chapter)
        return chapter

    def delete_chapter(self, tenant_id: uuid.UUID, chapter_id: uuid.UUID) -> None:
        chapter = self.get_chapter_or_404(tenant_id, chapter_id)
        self.chapters.delete(tenant_id, chapter.id)
        self.db.commit()
