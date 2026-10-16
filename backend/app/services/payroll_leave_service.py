"""Leave types, leave requests and balances. Approving a request marks the employee's HR
attendance (TeacherAttendance / StaffAttendance) as LEAVE for every date in the range."""

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models.attendance import HrAttendanceStatus, StaffAttendance, TeacherAttendance
from app.models.payroll import LeaveRequest, LeaveRequestStatus, LeaveType
from app.repositories.attendance_repo import StaffAttendanceRepository, TeacherAttendanceRepository
from app.repositories.payroll_repo import LeaveRequestRepository, LeaveTypeRepository
from app.repositories.user_repo import UserRepository
from app.schemas.payroll import LeaveBalanceOut, LeaveRequestOut, LeaveTypeCreate, LeaveTypeUpdate
from app.services.payroll_hr_service import Employee, PayrollHrService, employee_key_of

DEFAULT_LEAVE_TYPES = [
    ("Casual", 10, True),
    ("Sick", 8, True),
    ("Annual", 14, True),
    ("Unpaid", 0, False),
]

_ACTIVE_STATUSES = (LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED)


def leave_days(from_date: date, to_date: date) -> int:
    return (to_date - from_date).days + 1


def iter_dates(from_date: date, to_date: date):
    current = from_date
    while current <= to_date:
        yield current
        current += timedelta(days=1)


class PayrollLeaveService:
    def __init__(self, db: Session):
        self.db = db
        self.hr = PayrollHrService(db)
        self.types = LeaveTypeRepository(db)
        self.requests = LeaveRequestRepository(db)
        self.users = UserRepository(db)
        self.teacher_attendance = TeacherAttendanceRepository(db)
        self.staff_attendance = StaffAttendanceRepository(db)

    # --- leave types ---

    def ensure_default_types(self, tenant_id: uuid.UUID) -> None:
        if self.types.list(tenant_id):
            return
        for name, quota, is_paid in DEFAULT_LEAVE_TYPES:
            self.types.create(LeaveType(tenant_id=tenant_id, name=name, yearly_quota=quota, is_paid=is_paid))
        self.db.commit()

    def list_types(self, tenant_id: uuid.UUID, active_only: bool = False) -> list[LeaveType]:
        self.ensure_default_types(tenant_id)
        return self.types.list_sorted(tenant_id, active_only)

    def create_type(self, tenant_id: uuid.UUID, payload: LeaveTypeCreate) -> LeaveType:
        self.ensure_default_types(tenant_id)
        if self.types.get_by_name(tenant_id, payload.name.strip()) is not None:
            raise ConflictError("A leave type with this name already exists")
        leave_type = self.types.create(
            LeaveType(tenant_id=tenant_id, name=payload.name.strip(), yearly_quota=payload.yearly_quota,
                      is_paid=payload.is_paid)
        )
        self.db.commit()
        self.db.refresh(leave_type)
        return leave_type

    def _type(self, tenant_id: uuid.UUID, leave_type_id: uuid.UUID) -> LeaveType:
        leave_type = self.types.get_by_id(tenant_id, leave_type_id)
        if leave_type is None:
            raise NotFoundError("Leave type not found")
        return leave_type

    def update_type(self, tenant_id: uuid.UUID, leave_type_id: uuid.UUID, payload: LeaveTypeUpdate) -> LeaveType:
        leave_type = self._type(tenant_id, leave_type_id)
        data = payload.model_dump(exclude_unset=True)
        if data.get("name"):
            other = self.types.get_by_name(tenant_id, data["name"].strip())
            if other is not None and other.id != leave_type.id:
                raise ConflictError("A leave type with this name already exists")
            data["name"] = data["name"].strip()
        for field, value in data.items():
            if value is not None:
                setattr(leave_type, field, value)
        self.db.commit()
        self.db.refresh(leave_type)
        return leave_type

    # --- balances ---

    def _used_and_pending(
        self, tenant_id: uuid.UUID, employee: Employee, leave_type_id: uuid.UUID, year: int,
        exclude_id: uuid.UUID | None = None,
    ) -> tuple[float, float]:
        used = pending = 0.0
        for req in self.requests.list_filtered(
            tenant_id, employee.teacher_id, employee.staff_id,
            date_from=date(year, 1, 1), date_to=date(year, 12, 31),
        ):
            if req.leave_type_id != leave_type_id or req.from_date.year != year or req.id == exclude_id:
                continue
            if req.status == LeaveRequestStatus.APPROVED:
                used += float(req.days)
            elif req.status == LeaveRequestStatus.PENDING:
                pending += float(req.days)
        return used, pending

    def balances(self, tenant_id: uuid.UUID, employee: Employee, year: int) -> list[LeaveBalanceOut]:
        out = []
        for lt in self.list_types(tenant_id):
            used, pending = self._used_and_pending(tenant_id, employee, lt.id, year)
            out.append(
                LeaveBalanceOut(
                    leave_type_id=lt.id,
                    leave_type_name=lt.name,
                    is_paid=lt.is_paid,
                    yearly_quota=lt.yearly_quota,
                    used=used,
                    pending=pending,
                    remaining=(lt.yearly_quota - used) if lt.yearly_quota > 0 else None,
                )
            )
        return out

    def balances_for(self, tenant_id: uuid.UUID, employee_type: str, employee_id: uuid.UUID, year: int):
        return self.balances(tenant_id, self.hr.resolve(tenant_id, employee_type, employee_id), year)

    # --- requests ---

    def to_out(self, req: LeaveRequest, names: dict | None = None, type_names: dict | None = None) -> LeaveRequestOut:
        employee_type, employee_id = employee_key_of(req)
        if names is None:
            names = {(employee_type, employee_id): self.hr.resolve(req.tenant_id, employee_type, employee_id).full_name}
        if type_names is None:
            type_names = {lt.id: lt.name for lt in self.types.list(req.tenant_id)}
        approver_name = None
        if req.approver_user_id is not None:
            approver = self.users.get_by_id(req.tenant_id, req.approver_user_id)
            approver_name = approver.full_name if approver else None
        return LeaveRequestOut(
            id=req.id,
            employee_type=employee_type,
            employee_id=employee_id,
            employee_name=names.get((employee_type, employee_id), "Unknown"),
            leave_type_id=req.leave_type_id,
            leave_type_name=type_names.get(req.leave_type_id, "Unknown"),
            from_date=req.from_date,
            to_date=req.to_date,
            days=float(req.days),
            reason=req.reason,
            status=req.status,
            approver_user_id=req.approver_user_id,
            approver_name=approver_name,
            decided_at=req.decided_at,
            decision_note=req.decision_note,
            created_at=req.created_at,
        )

    def list_out(self, tenant_id: uuid.UUID, requests: list[LeaveRequest]) -> list[LeaveRequestOut]:
        names = self.hr.name_map(tenant_id)
        type_names = {lt.id: lt.name for lt in self.types.list(tenant_id)}
        return [self.to_out(r, names, type_names) for r in requests]

    def list_requests(
        self,
        tenant_id: uuid.UUID,
        status: LeaveRequestStatus | None = None,
        employee_type: str | None = None,
        employee_id: uuid.UUID | None = None,
    ) -> list[LeaveRequestOut]:
        teacher_id = staff_id = None
        if employee_type and employee_id:
            employee = self.hr.resolve(tenant_id, employee_type, employee_id)
            teacher_id, staff_id = employee.teacher_id, employee.staff_id
        return self.list_out(tenant_id, self.requests.list_filtered(tenant_id, teacher_id, staff_id, status))

    def _check_quota(self, tenant_id, employee: Employee, leave_type: LeaveType, req_year: int, days: float,
                     include_pending: bool, exclude_id: uuid.UUID | None = None) -> None:
        if not leave_type.is_paid or leave_type.yearly_quota <= 0:
            return
        used, pending = self._used_and_pending(tenant_id, employee, leave_type.id, req_year, exclude_id)
        committed = used + (pending if include_pending else 0)
        if committed + days > leave_type.yearly_quota:
            remaining = max(leave_type.yearly_quota - committed, 0)
            raise ConflictError(
                f"Insufficient {leave_type.name} leave balance: {remaining:g} day(s) available, {days:g} requested"
            )

    def apply(
        self, tenant_id: uuid.UUID, employee: Employee, payload, applied_by_user_id: uuid.UUID
    ) -> LeaveRequest:
        self.ensure_default_types(tenant_id)
        leave_type = self._type(tenant_id, payload.leave_type_id)
        if not leave_type.is_active:
            raise ConflictError("This leave type is not active")
        if payload.from_date.year != payload.to_date.year:
            raise ConflictError("A leave request cannot span two calendar years; split it into two requests")
        overlapping = [
            r for r in self.requests.list_filtered(
                tenant_id, employee.teacher_id, employee.staff_id, date_from=payload.from_date, date_to=payload.to_date
            )
            if r.status in _ACTIVE_STATUSES
        ]
        if overlapping:
            raise ConflictError("These dates overlap an existing pending or approved leave request")
        days = leave_days(payload.from_date, payload.to_date)
        self._check_quota(tenant_id, employee, leave_type, payload.from_date.year, days, include_pending=True)
        req = self.requests.create(
            LeaveRequest(
                tenant_id=tenant_id,
                teacher_id=employee.teacher_id,
                staff_id=employee.staff_id,
                leave_type_id=leave_type.id,
                from_date=payload.from_date,
                to_date=payload.to_date,
                days=days,
                reason=payload.reason,
                applied_by_user_id=applied_by_user_id,
            )
        )
        self.db.commit()
        self.db.refresh(req)
        return req

    def apply_for_employee(self, tenant_id: uuid.UUID, payload, applied_by_user_id: uuid.UUID) -> LeaveRequest:
        employee = self.hr.resolve(tenant_id, payload.employee_type, payload.employee_id)
        return self.apply(tenant_id, employee, payload, applied_by_user_id)

    def _request(self, tenant_id: uuid.UUID, request_id: uuid.UUID) -> LeaveRequest:
        req = self.requests.get_by_id(tenant_id, request_id)
        if req is None:
            raise NotFoundError("Leave request not found")
        return req

    def approve(self, tenant_id: uuid.UUID, request_id: uuid.UUID, approver_id: uuid.UUID, note: str | None) -> LeaveRequest:
        req = self._request(tenant_id, request_id)
        if req.status != LeaveRequestStatus.PENDING:
            raise ConflictError("Only a pending leave request can be approved")
        leave_type = self._type(tenant_id, req.leave_type_id)
        employee = self.hr.resolve_row(tenant_id, req)
        self._check_quota(tenant_id, employee, leave_type, req.from_date.year, float(req.days),
                          include_pending=False, exclude_id=req.id)
        now = datetime.now(timezone.utc)
        req.status = LeaveRequestStatus.APPROVED
        req.approver_user_id = approver_id
        req.decided_at = now
        req.decision_note = note
        self._mark_attendance_leave(tenant_id, req, leave_type, approver_id, now)
        self.db.commit()
        self.db.refresh(req)
        return req

    def _mark_attendance_leave(self, tenant_id, req: LeaveRequest, leave_type: LeaveType, approver_id, now) -> None:
        note = f"{leave_type.name} leave (approved)"
        for day in iter_dates(req.from_date, req.to_date):
            if req.teacher_id is not None:
                record = self.teacher_attendance.get_for_teacher_date(tenant_id, req.teacher_id, day)
                if record is None:
                    self.teacher_attendance.create(
                        TeacherAttendance(tenant_id=tenant_id, teacher_id=req.teacher_id, attendance_date=day,
                                          status=HrAttendanceStatus.LEAVE, marked_by_user_id=approver_id, note=note)
                    )
                else:
                    record.status = HrAttendanceStatus.LEAVE
                    record.marked_by_user_id = approver_id
                    record.note = note
            else:
                record = self.staff_attendance.get_for_staff_date(tenant_id, req.staff_id, day)
                if record is None:
                    self.staff_attendance.create(
                        StaffAttendance(tenant_id=tenant_id, staff_id=req.staff_id, attendance_date=day,
                                        status=HrAttendanceStatus.LEAVE, marked_by_user_id=approver_id,
                                        marked_at=now, note=note)
                    )
                else:
                    record.status = HrAttendanceStatus.LEAVE
                    record.marked_by_user_id = approver_id
                    record.marked_at = now
                    record.note = note

    def reject(self, tenant_id: uuid.UUID, request_id: uuid.UUID, approver_id: uuid.UUID, note: str | None) -> LeaveRequest:
        req = self._request(tenant_id, request_id)
        if req.status != LeaveRequestStatus.PENDING:
            raise ConflictError("Only a pending leave request can be rejected")
        req.status = LeaveRequestStatus.REJECTED
        req.approver_user_id = approver_id
        req.decided_at = datetime.now(timezone.utc)
        req.decision_note = note
        self.db.commit()
        self.db.refresh(req)
        return req

    def cancel_own(self, tenant_id: uuid.UUID, request_id: uuid.UUID, teacher_id: uuid.UUID) -> LeaveRequest:
        req = self._request(tenant_id, request_id)
        if req.teacher_id != teacher_id:
            raise NotFoundError("Leave request not found")
        if req.status != LeaveRequestStatus.PENDING:
            raise ConflictError("Only a pending leave request can be cancelled")
        req.status = LeaveRequestStatus.CANCELLED
        self.db.commit()
        self.db.refresh(req)
        return req

    def unpaid_leave_dates(self, tenant_id: uuid.UUID, employee: Employee, start: date, end: date) -> set[date]:
        unpaid_types = {lt.id for lt in self.types.list(tenant_id) if not lt.is_paid}
        dates: set[date] = set()
        for req in self.requests.list_filtered(
            tenant_id, employee.teacher_id, employee.staff_id, LeaveRequestStatus.APPROVED, start, end
        ):
            if req.leave_type_id in unpaid_types:
                for day in iter_dates(max(req.from_date, start), min(req.to_date, end)):
                    dates.add(day)
        return dates
