import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.exceptions import ForbiddenError
from app.db.session import get_db
from app.models.attendance import AttendanceStatus
from app.models.user import RoleEnum, User
from app.repositories.student_repo import StudentProfileRepository
from app.schemas.attendance import (
    AdminMarkTeacherAttendanceRequest,
    AttendanceAnalyticsOut,
    AttendanceMarkRequest,
    AttendanceOut,
    AttendanceSummaryOut,
    BulkMarkStaffAttendanceRequest,
    HrAttendanceSummaryOut,
    MarkStaffAttendanceRequest,
    RosterEntryOut,
    StaffAttendanceDetailOut,
    StaffAttendanceOut,
    StaffDailyRosterEntryOut,
    TeacherAttendanceDetailOut,
    TeacherAttendanceOut,
)
from app.services.attendance_service import AttendanceService, HrAttendanceService
from app.services.notification_service import NotificationService
from app.services.parent_service import ParentService

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.get("/sessions/{session_id}/roster", response_model=list[RosterEntryOut])
def get_roster(
    session_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> list[RosterEntryOut]:
    return AttendanceService(db).get_roster_for_session(current_user.tenant_id, session_id, current_user.id)


@router.post("/sessions/{session_id}", response_model=list[AttendanceOut])
def mark_attendance(
    session_id: uuid.UUID,
    payload: AttendanceMarkRequest,
    current_user: User = Depends(require_role(RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> list[AttendanceOut]:
    records = AttendanceService(db).mark_attendance(current_user.tenant_id, session_id, current_user.id, payload.records)

    absent_records = [r for r in records if r.status == AttendanceStatus.ABSENT]
    if absent_records:
        student_repo = StudentProfileRepository(db)
        notification_service = NotificationService(db)
        for record in absent_records:
            found = student_repo.get_with_user(current_user.tenant_id, record.student_id)
            if found is None:
                continue
            _, student_user = found
            notification_service.notify_attendance_absent(
                current_user.tenant_id, record.student_id, student_user.full_name, record.marked_at.date().isoformat()
            )

    return records


@router.get("/students/{student_id}/summary", response_model=AttendanceSummaryOut)
def get_student_summary(
    student_id: uuid.UUID,
    month: int = Query(ge=1, le=12),
    year: int = Query(ge=2000, le=2100),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> AttendanceSummaryOut:
    tenant_id = current_user.tenant_id

    if current_user.role == RoleEnum.STUDENT:
        profile = StudentProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        if profile is None or profile.id != student_id:
            raise ForbiddenError("Not your attendance record")
    elif current_user.role == RoleEnum.PARENT:
        ParentService(db).assert_child(tenant_id, current_user.id, student_id)

    return AttendanceService(db).get_student_monthly_summary(tenant_id, student_id, month, year)


@router.get("/analytics", response_model=AttendanceAnalyticsOut)
def get_analytics(
    section_id: uuid.UUID | None = Query(default=None),
    class_grade_id: uuid.UUID | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> AttendanceAnalyticsOut:
    return AttendanceService(db).get_class_analytics(
        current_user.tenant_id,
        section_id=section_id,
        class_grade_id=class_grade_id,
        date_from=date_from,
        date_to=date_to,
    )


# --- Teacher attendance: self check-in/out (TEACHER), admin overrides + listing (ADMIN) ---


@router.post("/teachers/check-in", response_model=TeacherAttendanceOut, status_code=201)
def teacher_check_in(
    current_user: User = Depends(require_role(RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> TeacherAttendanceOut:
    return HrAttendanceService(db).teacher_check_in(current_user.tenant_id, current_user.id)


@router.post("/teachers/check-out", response_model=TeacherAttendanceOut)
def teacher_check_out(
    current_user: User = Depends(require_role(RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> TeacherAttendanceOut:
    return HrAttendanceService(db).teacher_check_out(current_user.tenant_id, current_user.id)


@router.get("/teachers/me/today", response_model=TeacherAttendanceOut | None)
def get_my_teacher_attendance_today(
    current_user: User = Depends(require_role(RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> TeacherAttendanceOut | None:
    return HrAttendanceService(db).get_teacher_today(current_user.tenant_id, current_user.id)


@router.get("/teachers/me", response_model=list[TeacherAttendanceOut])
def list_my_teacher_attendance(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> list[TeacherAttendanceOut]:
    return HrAttendanceService(db).list_my_teacher_attendance(current_user.tenant_id, current_user.id, date_from, date_to)


@router.get("/teachers", response_model=list[TeacherAttendanceDetailOut])
def list_teacher_attendance(
    teacher_id: uuid.UUID | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[TeacherAttendanceDetailOut]:
    return HrAttendanceService(db).list_teacher_attendance_detailed(current_user.tenant_id, teacher_id, date_from, date_to)


@router.post("/teachers/mark", response_model=TeacherAttendanceOut)
def admin_mark_teacher_attendance(
    payload: AdminMarkTeacherAttendanceRequest,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> TeacherAttendanceOut:
    return HrAttendanceService(db).admin_mark_teacher_attendance(
        current_user.tenant_id, payload.teacher_id, payload.attendance_date, payload.status, payload.note, current_user.id
    )


@router.get("/teachers/summary", response_model=HrAttendanceSummaryOut)
def get_teacher_daily_summary(
    on_date: date = Query(alias="date", default_factory=date.today),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> HrAttendanceSummaryOut:
    return HrAttendanceService(db).get_teacher_daily_summary(current_user.tenant_id, on_date)


# --- Staff attendance: admin-marked daily register (staff have no login) ---


@router.get("/staff/roster", response_model=list[StaffDailyRosterEntryOut])
def get_staff_daily_roster(
    on_date: date = Query(alias="date", default_factory=date.today),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[StaffDailyRosterEntryOut]:
    return HrAttendanceService(db).get_staff_daily_roster(current_user.tenant_id, on_date)


@router.post("/staff/mark", response_model=StaffAttendanceOut)
def mark_staff_attendance(
    payload: MarkStaffAttendanceRequest,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> StaffAttendanceOut:
    return HrAttendanceService(db).mark_staff_attendance(
        current_user.tenant_id, payload.staff_id, payload.attendance_date, payload.status, payload.note, current_user.id
    )


@router.post("/staff/bulk-mark", response_model=list[StaffAttendanceOut])
def bulk_mark_staff_attendance(
    payload: BulkMarkStaffAttendanceRequest,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[StaffAttendanceOut]:
    return HrAttendanceService(db).bulk_mark_staff_attendance(current_user.tenant_id, payload, current_user.id)


@router.get("/staff", response_model=list[StaffAttendanceDetailOut])
def list_staff_attendance(
    staff_id: uuid.UUID | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[StaffAttendanceDetailOut]:
    return HrAttendanceService(db).list_staff_attendance_detailed(current_user.tenant_id, staff_id, date_from, date_to)


@router.get("/staff/summary", response_model=HrAttendanceSummaryOut)
def get_staff_daily_summary(
    on_date: date = Query(alias="date", default_factory=date.today),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> HrAttendanceSummaryOut:
    return HrAttendanceService(db).get_staff_daily_summary(current_user.tenant_id, on_date)
