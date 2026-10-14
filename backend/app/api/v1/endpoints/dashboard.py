from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select, case
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.attendance import Attendance, AttendanceStatus
from app.models.student_admission_detail import StudentAdmissionDetail
from app.models.user import RoleEnum, User
from app.models.user import StudentProfile
from app.schemas.dashboard import DashboardSummaryOut
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryOut)
def get_dashboard_summary(
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> DashboardSummaryOut:
    return DashboardService(db).get_summary(current_user.tenant_id)


class GenderCount(BaseModel):
    label: str
    count: int


class StatusCount(BaseModel):
    label: str
    count: int


class StudentAnalyticsOut(BaseModel):
    active: int
    transferred: int
    alumni: int
    left_inactive: int
    at_risk: int
    avg_attendance_pct: float | None
    gender_split: list[GenderCount]
    by_status: list[StatusCount]
    total: int


@router.get("/student-analytics", response_model=StudentAnalyticsOut)
def get_student_analytics(
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> StudentAnalyticsOut:
    tid = current_user.tenant_id

    # Status counts
    rows = db.execute(
        select(StudentProfile.status, func.count().label("cnt"))
        .where(StudentProfile.tenant_id == tid)
        .group_by(StudentProfile.status)
    ).all()
    status_map: dict[str, int] = {r.status: r.cnt for r in rows}
    total = sum(status_map.values())
    active = status_map.get("active", 0)
    transferred = status_map.get("transferred", 0)
    alumni = status_map.get("alumni", 0)
    left_inactive = sum(v for k, v in status_map.items() if k not in ("active", "transferred", "alumni"))

    # Gender split from admission details
    gender_rows = db.execute(
        select(
            func.lower(StudentAdmissionDetail.gender).label("g"),
            func.count().label("cnt"),
        )
        .where(StudentAdmissionDetail.tenant_id == tid)
        .where(StudentAdmissionDetail.gender.isnot(None))
        .group_by(func.lower(StudentAdmissionDetail.gender))
    ).all()
    gender_split = [GenderCount(label=r.g.capitalize() if r.g else "Unknown", count=r.cnt) for r in gender_rows]

    # By-status breakdown for chart
    by_status = [StatusCount(label=k.capitalize(), count=v) for k, v in status_map.items()]

    # Avg attendance in date range (on active students)
    avg_pct: float | None = None
    from app.models.schedule import ClassSession  # local import to avoid circular
    q = (
        select(
            func.count(case((Attendance.status == AttendanceStatus.PRESENT, 1))).label("present"),
            func.count(Attendance.id).label("total"),
        )
        .join(ClassSession, ClassSession.id == Attendance.class_session_id)
        .where(Attendance.tenant_id == tid)
    )
    if date_from:
        q = q.where(ClassSession.date >= date_from)
    if date_to:
        q = q.where(ClassSession.date <= date_to)
    att_row = db.execute(q).one()
    if att_row.total and att_row.total > 0:
        avg_pct = round(att_row.present / att_row.total * 100, 1)

    # At-risk: students with < 75% attendance in the period
    at_risk = 0
    student_att_q = (
        select(
            Attendance.student_id,
            func.count(case((Attendance.status == AttendanceStatus.PRESENT, 1))).label("present"),
            func.count(Attendance.id).label("total"),
        )
        .join(ClassSession, ClassSession.id == Attendance.class_session_id)
        .where(Attendance.tenant_id == tid)
        .group_by(Attendance.student_id)
    )
    if date_from:
        student_att_q = student_att_q.where(ClassSession.date >= date_from)
    if date_to:
        student_att_q = student_att_q.where(ClassSession.date <= date_to)
    for s_row in db.execute(student_att_q).all():
        if s_row.total > 0 and (s_row.present / s_row.total) < 0.75:
            at_risk += 1

    return StudentAnalyticsOut(
        active=active,
        transferred=transferred,
        alumni=alumni,
        left_inactive=left_inactive,
        at_risk=at_risk,
        avg_attendance_pct=avg_pct,
        gender_split=gender_split,
        by_status=by_status,
        total=total,
    )
