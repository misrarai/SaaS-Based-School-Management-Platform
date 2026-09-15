import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.exceptions import DomainError, ForbiddenError
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.teacher_repo import TeacherProfileRepository
from app.repositories.quiz_repo import QuizRepository
from app.repositories.resource_repo import ResourceRepository
from app.schemas.course import (
    ChapterContentOut,
    ChapterCreate,
    ChapterOut,
    ChapterUpdate,
    CourseCreate,
    CourseEnrollmentCreate,
    CourseEnrollmentOut,
    CourseGradebookRow,
    CourseOut,
    TeacherAssignmentCreate,
    TeacherAssignmentOut,
    TeacherStudentSummary,
)
from app.schemas.quiz import QuizOut
from app.schemas.resource import ResourceOut
from app.services.assignment_service import AssignmentService
from app.services.course_service import CourseService
from app.services.parent_service import ParentService

router = APIRouter(prefix="/courses", tags=["courses"])


def _check_read_access(
    db: Session, current_user: User, course_id: uuid.UUID, student_id_param: uuid.UUID | None
) -> None:
    """Shared by every course-scoped read endpoint (course detail, chapters, chapter content):
    admin sees everything, a teacher must be assigned to the course, a student must be enrolled,
    a parent must be asking about their own enrolled child."""
    tenant_id = current_user.tenant_id
    service = CourseService(db)

    if current_user.role == RoleEnum.TEACHER:
        profile = TeacherProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        teacher_id = profile.id if profile else uuid.uuid4()
        service.get_course_out_scoped(tenant_id, course_id, teacher_id=teacher_id)
    elif current_user.role == RoleEnum.STUDENT:
        profile = StudentProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        target_student_id = profile.id if profile else uuid.uuid4()
        service.get_course_out_scoped(tenant_id, course_id, student_id=target_student_id)
    elif current_user.role == RoleEnum.PARENT:
        if student_id_param is None:
            raise DomainError("student_id is required")
        ParentService(db).assert_child(tenant_id, current_user.id, student_id_param)
        service.get_course_out_scoped(tenant_id, course_id, student_id=student_id_param)
    else:
        service.get_course_or_404(tenant_id, course_id)


@router.get("/students/mine", response_model=list[TeacherStudentSummary])
def list_my_students(
    current_user: User = Depends(require_role(RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> list[TeacherStudentSummary]:
    profile = TeacherProfileRepository(db).get_by_user_id(current_user.tenant_id, current_user.id)
    if profile is None:
        return []
    return CourseService(db).list_students_for_teacher(current_user.tenant_id, profile.id)


@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> CourseOut:
    service = CourseService(db)
    course = service.create_course(current_user.tenant_id, payload.academic_year_id, payload.section_id, payload.subject_id)
    return service.get_course_out_scoped(current_user.tenant_id, course.id)


@router.get("", response_model=list[CourseOut])
def list_courses(
    academic_year_id: uuid.UUID | None = Query(default=None),
    class_grade_id: uuid.UUID | None = Query(default=None),
    section_id: uuid.UUID | None = Query(default=None),
    subject_id: uuid.UUID | None = Query(default=None),
    student_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> list[CourseOut]:
    tenant_id = current_user.tenant_id
    service = CourseService(db)

    if current_user.role == RoleEnum.TEACHER:
        profile = TeacherProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        if profile is None:
            return []
        return service.list_courses_for_teacher(tenant_id, profile.id)

    if current_user.role == RoleEnum.STUDENT:
        profile = StudentProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        if profile is None:
            return []
        return service.list_courses_for_student(tenant_id, profile.id)

    if current_user.role == RoleEnum.PARENT:
        if student_id is None:
            raise DomainError("student_id is required")
        ParentService(db).assert_child(tenant_id, current_user.id, student_id)
        return service.list_courses_for_student(tenant_id, student_id)

    return service.list_courses_out(tenant_id, academic_year_id, class_grade_id, section_id, subject_id)


@router.get("/{course_id}", response_model=CourseOut)
def get_course(
    course_id: uuid.UUID,
    student_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> CourseOut:
    tenant_id = current_user.tenant_id
    service = CourseService(db)

    if current_user.role == RoleEnum.TEACHER:
        profile = TeacherProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        teacher_id = profile.id if profile else uuid.uuid4()
        return service.get_course_out_scoped(tenant_id, course_id, teacher_id=teacher_id)

    if current_user.role == RoleEnum.STUDENT:
        profile = StudentProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        target_student_id = profile.id if profile else uuid.uuid4()
        return service.get_course_out_scoped(tenant_id, course_id, student_id=target_student_id)

    if current_user.role == RoleEnum.PARENT:
        if student_id is None:
            raise DomainError("student_id is required")
        ParentService(db).assert_child(tenant_id, current_user.id, student_id)
        return service.get_course_out_scoped(tenant_id, course_id, student_id=student_id)

    return service.get_course_out_scoped(tenant_id, course_id)


@router.post("/{course_id}/chapters", response_model=ChapterOut, status_code=status.HTTP_201_CREATED)
def create_chapter(
    course_id: uuid.UUID,
    payload: ChapterCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> ChapterOut:
    tenant_id = current_user.tenant_id
    if current_user.role == RoleEnum.TEACHER:
        profile = TeacherProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        teacher_id = profile.id if profile else uuid.uuid4()
        if not CourseService(db).assignments.is_teacher_assigned(tenant_id, course_id, teacher_id):
            raise ForbiddenError("You are not assigned to this course")
    return CourseService(db).create_chapter(tenant_id, course_id, payload)


@router.get("/{course_id}/chapters", response_model=list[ChapterOut])
def list_chapters(
    course_id: uuid.UUID,
    student_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> list[ChapterOut]:
    _check_read_access(db, current_user, course_id, student_id)
    return CourseService(db).list_chapters(current_user.tenant_id, course_id)


@router.get("/{course_id}/chapters/{chapter_id}", response_model=ChapterContentOut)
def get_chapter_content(
    course_id: uuid.UUID,
    chapter_id: uuid.UUID,
    student_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> ChapterContentOut:
    _check_read_access(db, current_user, course_id, student_id)
    tenant_id = current_user.tenant_id
    chapter = CourseService(db).get_chapter_or_404(tenant_id, chapter_id)
    if chapter.course_id != course_id:
        raise ForbiddenError("This chapter does not belong to the given course")

    resources = ResourceRepository(db).list_by_chapter(tenant_id, chapter_id)
    quizzes = QuizRepository(db).list_by_chapter(tenant_id, chapter_id)
    return ChapterContentOut(
        chapter=ChapterOut.model_validate(chapter),
        resources=[ResourceOut.model_validate(r) for r in resources],
        quizzes=[QuizOut.model_validate(q) for q in quizzes],
    )


@router.patch("/{course_id}/chapters/{chapter_id}", response_model=ChapterOut)
def update_chapter(
    course_id: uuid.UUID,
    chapter_id: uuid.UUID,
    payload: ChapterUpdate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> ChapterOut:
    tenant_id = current_user.tenant_id
    if current_user.role == RoleEnum.TEACHER:
        profile = TeacherProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        teacher_id = profile.id if profile else uuid.uuid4()
        if not CourseService(db).assignments.is_teacher_assigned(tenant_id, course_id, teacher_id):
            raise ForbiddenError("You are not assigned to this course")
    chapter = CourseService(db).get_chapter_or_404(tenant_id, chapter_id)
    if chapter.course_id != course_id:
        raise ForbiddenError("This chapter does not belong to the given course")
    return CourseService(db).update_chapter(tenant_id, chapter_id, payload)


@router.delete("/{course_id}/chapters/{chapter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chapter(
    course_id: uuid.UUID,
    chapter_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> None:
    tenant_id = current_user.tenant_id
    if current_user.role == RoleEnum.TEACHER:
        profile = TeacherProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        teacher_id = profile.id if profile else uuid.uuid4()
        if not CourseService(db).assignments.is_teacher_assigned(tenant_id, course_id, teacher_id):
            raise ForbiddenError("You are not assigned to this course")
    chapter = CourseService(db).get_chapter_or_404(tenant_id, chapter_id)
    if chapter.course_id != course_id:
        raise ForbiddenError("This chapter does not belong to the given course")
    CourseService(db).delete_chapter(tenant_id, chapter_id)


@router.post("/{course_id}/teachers", response_model=TeacherAssignmentOut, status_code=status.HTTP_201_CREATED)
def assign_teacher(
    course_id: uuid.UUID,
    payload: TeacherAssignmentCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> TeacherAssignmentOut:
    return CourseService(db).assign_teacher(current_user.tenant_id, course_id, payload.teacher_id)


@router.delete("/{course_id}/teachers/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT)
def unassign_teacher(
    course_id: uuid.UUID,
    teacher_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> None:
    CourseService(db).unassign_teacher(current_user.tenant_id, course_id, teacher_id)


@router.get("/{course_id}/students", response_model=list[CourseEnrollmentOut])
def list_course_students(
    course_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> list[CourseEnrollmentOut]:
    tenant_id = current_user.tenant_id
    service = CourseService(db)

    if current_user.role == RoleEnum.TEACHER:
        profile = TeacherProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        teacher_id = profile.id if profile else uuid.uuid4()
        service.get_course_out_scoped(tenant_id, course_id, teacher_id=teacher_id)

    return service.list_course_students(tenant_id, course_id)


@router.post("/{course_id}/students", response_model=CourseEnrollmentOut, status_code=status.HTTP_201_CREATED)
def enroll_student(
    course_id: uuid.UUID,
    payload: CourseEnrollmentCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> CourseEnrollmentOut:
    return CourseService(db).enroll_student(current_user.tenant_id, course_id, payload.student_id)


@router.delete("/{course_id}/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def drop_student(
    course_id: uuid.UUID,
    student_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> None:
    CourseService(db).drop_student(current_user.tenant_id, course_id, student_id)


@router.get("/{course_id}/gradebook", response_model=list[CourseGradebookRow])
def get_course_gradebook(
    course_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> list[CourseGradebookRow]:
    tenant_id = current_user.tenant_id
    course_service = CourseService(db)
    course = course_service.get_course_or_404(tenant_id, course_id)

    if current_user.role == RoleEnum.TEACHER:
        profile = TeacherProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        teacher_id = profile.id if profile else uuid.uuid4()
        if not course_service.assignments.is_teacher_assigned(tenant_id, course_id, teacher_id):
            raise ForbiddenError("You are not assigned to this course")

    assignment_service = AssignmentService(db)
    rows: list[CourseGradebookRow] = []
    for enrollment in course_service.enrollments.list_by_course(tenant_id, course_id):
        found = StudentProfileRepository(db).get_with_user(tenant_id, enrollment.student_id)
        if found is None:
            continue
        _, user = found

        entries = [
            e for e in assignment_service.get_gradebook(tenant_id, enrollment.student_id) if e["subject_id"] == course.subject_id
        ]
        total_obtained = sum(e["marks_obtained"] for e in entries if e["marks_obtained"] is not None)
        total_max = sum(e["max_marks"] for e in entries if e["max_marks"] is not None and e["marks_obtained"] is not None)
        average_percent = round((total_obtained / total_max) * 100, 1) if total_max else None

        rows.append(
            CourseGradebookRow(
                student_id=enrollment.student_id,
                full_name=user.full_name,
                email=user.email,
                assignments_graded=len(entries),
                average_percent=average_percent,
            )
        )
    return rows
