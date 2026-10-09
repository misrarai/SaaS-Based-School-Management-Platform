"""Monthly payroll runs, payslips, manual adjustments and salary advances.

Payslip math (per employee, per month):
    gross            = basic + sum(allowances)
    per_day_rate     = gross / calendar days in month
    absence days     = ABSENT (1) + HALF_DAY (0.5) from HR attendance, plus approved unpaid-leave days
    absence_deduct   = absence days x per_day_rate   (capped at gross)
    advance_deduct   = min(monthly_installment, outstanding) for each outstanding advance
    total_deductions = structure deductions + absence_deduct + advance_deduct + fines/advance adjustments
    net_pay          = gross + bonuses - total_deductions
"""

import uuid
from calendar import monthrange
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models.attendance import HrAttendanceStatus
from app.models.payroll import (
    AdvanceRepayment,
    PayrollRun,
    PayrollStatus,
    Payslip,
    PayslipAdjustment,
    PayslipAdjustmentKind,
    SalaryAdvance,
    SalaryAdvanceStatus,
    SalaryStructure,
)
from app.repositories.attendance_repo import StaffAttendanceRepository, TeacherAttendanceRepository
from app.repositories.payroll_repo import (
    AdvanceRepaymentRepository,
    PayrollRunRepository,
    PayslipAdjustmentRepository,
    PayslipRepository,
    SalaryAdvanceRepository,
    SalaryStructureRepository,
)
from app.schemas.payroll import (
    PayrollRunDetail,
    PayrollRunOut,
    PayslipAdjustmentCreate,
    PayslipAdjustmentOut,
    PayslipOut,
    SalaryAdvanceCreate,
    SalaryAdvanceOut,
)
from app.services.payroll_hr_service import Employee, PayrollHrService, employee_key_of
from app.services.payroll_leave_service import PayrollLeaveService


def _r(value: float) -> float:
    return round(float(value) + 0.0, 2)


def _sum(items: list[dict]) -> float:
    return _r(sum(float(i.get("amount", 0) or 0) for i in items))


def month_bounds(month: int, year: int) -> tuple[date, date]:
    return date(year, month, 1), date(year, month, monthrange(year, month)[1])


class PayrollRunService:
    def __init__(self, db: Session):
        self.db = db
        self.hr = PayrollHrService(db)
        self.leaves = PayrollLeaveService(db)
        self.runs = PayrollRunRepository(db)
        self.payslips = PayslipRepository(db)
        self.adjustments = PayslipAdjustmentRepository(db)
        self.structures = SalaryStructureRepository(db)
        self.advances = SalaryAdvanceRepository(db)
        self.repayments = AdvanceRepaymentRepository(db)
        self.teacher_attendance = TeacherAttendanceRepository(db)
        self.staff_attendance = StaffAttendanceRepository(db)

    # --- runs ---

    def get_run(self, tenant_id: uuid.UUID, run_id: uuid.UUID) -> PayrollRun:
        run = self.runs.get_by_id(tenant_id, run_id)
        if run is None:
            raise NotFoundError("Payroll run not found")
        return run

    def generate(self, tenant_id: uuid.UUID, month: int, year: int, user_id: uuid.UUID, notes: str | None = None):
        """Creates the run for the period, or recomputes an existing DRAFT run (keeping manual adjustments)."""
        run = self.runs.get_for_period(tenant_id, month, year)
        if run is not None and run.status != PayrollStatus.DRAFT:
            raise ConflictError("Payroll for this month has already been approved or paid")
        if run is None:
            run = self.runs.create(
                PayrollRun(tenant_id=tenant_id, period_month=month, period_year=year, generated_by_user_id=user_id,
                           notes=notes)
            )
        elif notes is not None:
            run.notes = notes

        start, end = month_bounds(month, year)
        existing = {employee_key_of(p): p for p in self.payslips.list_for_run(tenant_id, run.id)}
        touched: set = set()
        skipped: list[str] = []
        for employee in self.hr.list_employees(tenant_id, status="active"):
            structure = self.structures.current_for_employee(tenant_id, employee.teacher_id, employee.staff_id, end)
            if structure is None:
                skipped.append(employee.full_name)
                continue
            payslip = existing.get(employee.key)
            if payslip is None:
                payslip = self.payslips.create(
                    Payslip(tenant_id=tenant_id, payroll_run_id=run.id, teacher_id=employee.teacher_id,
                            staff_id=employee.staff_id, employee_name=employee.full_name, basic_salary=0,
                            gross_salary=0, working_days=0, per_day_rate=0, net_pay=0)
                )
            touched.add(employee.key)
            self._compute(tenant_id, payslip, employee, structure, start, end)

        for key, payslip in existing.items():
            if key not in touched:
                self._delete_payslip(tenant_id, payslip)

        self.db.commit()
        self.db.refresh(run)
        return run, skipped

    def _attendance_days(self, tenant_id, employee: Employee, start: date, end: date, exclude: set[date]) -> float:
        if employee.teacher_id is not None:
            records = self.teacher_attendance.list_records(tenant_id, teacher_id=employee.teacher_id,
                                                           date_from=start, date_to=end)
        else:
            records = self.staff_attendance.list_records(tenant_id, staff_id=employee.staff_id,
                                                         date_from=start, date_to=end)
        days = 0.0
        for rec in records:
            if rec.attendance_date in exclude:
                continue
            if rec.status == HrAttendanceStatus.ABSENT:
                days += 1
            elif rec.status == HrAttendanceStatus.HALF_DAY:
                days += 0.5
        return days

    def _compute(self, tenant_id, payslip: Payslip, employee: Employee, structure: SalaryStructure,
                 start: date, end: date) -> None:
        basic = _r(structure.basic_salary)
        allowances = [dict(a) for a in structure.allowances]
        deductions = [dict(d) for d in structure.deductions]
        total_allowances = _sum(allowances)
        gross = _r(basic + total_allowances)
        working_days = (end - start).days + 1
        per_day = _r(gross / working_days) if working_days else 0.0

        unpaid_dates = self.leaves.unpaid_leave_dates(tenant_id, employee, start, end)
        absent_days = self._attendance_days(tenant_id, employee, start, end, unpaid_dates)
        unpaid_days = float(len(unpaid_dates))
        absence_deduction = min(_r((absent_days + unpaid_days) * per_day), gross)

        payslip.employee_name = employee.full_name
        payslip.employee_code = employee.employee_code
        payslip.designation = self.hr.designation_label(tenant_id, employee)
        payslip.basic_salary = basic
        payslip.allowances = allowances
        payslip.deductions = deductions
        payslip.total_allowances = total_allowances
        payslip.gross_salary = gross
        payslip.working_days = working_days
        payslip.per_day_rate = per_day
        payslip.absent_days = absent_days
        payslip.unpaid_leave_days = unpaid_days
        payslip.absence_deduction = absence_deduction
        payslip.structure_deductions = _sum(deductions)
        payslip.advance_deduction = self._recover_advances(tenant_id, payslip, employee, end)
        self._apply_totals(tenant_id, payslip)

    def _recover_advances(self, tenant_id, payslip: Payslip, employee: Employee, end: date) -> float:
        affected = set()
        for old in self.repayments.list_for_payslip(tenant_id, payslip.id):
            affected.add(old.advance_id)
            self.db.delete(old)
        self.db.flush()
        total = 0.0
        advances = self.advances.list_filtered(tenant_id, employee.teacher_id, employee.staff_id)
        for advance in sorted(advances, key=lambda a: (a.issued_on, a.created_at)):
            if advance.issued_on > end:
                continue
            outstanding = _r(float(advance.amount) - self.repayments.total_for_advance(tenant_id, advance.id))
            installment = min(_r(advance.monthly_installment), outstanding)
            if installment > 0:
                self.repayments.create(
                    AdvanceRepayment(tenant_id=tenant_id, advance_id=advance.id, payslip_id=payslip.id,
                                     amount=installment)
                )
                total += installment
            affected.add(advance.id)
        for advance in advances:
            if advance.id in affected:
                self._refresh_advance_status(tenant_id, advance)
        return _r(total)

    def _refresh_advance_status(self, tenant_id, advance: SalaryAdvance) -> None:
        repaid = self.repayments.total_for_advance(tenant_id, advance.id)
        advance.status = SalaryAdvanceStatus.REPAID if repaid >= float(advance.amount) - 0.005 else SalaryAdvanceStatus.ACTIVE

    def _apply_totals(self, tenant_id, payslip: Payslip) -> None:
        adjustments = self.adjustments.list_for_payslip(tenant_id, payslip.id)
        bonus = _r(sum(float(a.amount) for a in adjustments if a.kind == PayslipAdjustmentKind.BONUS))
        adj_deduction = _r(sum(float(a.amount) for a in adjustments if a.kind != PayslipAdjustmentKind.BONUS))
        total_deductions = _r(
            float(payslip.structure_deductions) + float(payslip.absence_deduction)
            + float(payslip.advance_deduction) + adj_deduction
        )
        payslip.bonus = bonus
        payslip.adjustment_deduction = adj_deduction
        payslip.total_deductions = total_deductions
        payslip.net_pay = _r(float(payslip.gross_salary) + bonus - total_deductions)

    def _delete_payslip(self, tenant_id, payslip: Payslip) -> None:
        advance_ids = set()
        for rep in self.repayments.list_for_payslip(tenant_id, payslip.id):
            advance_ids.add(rep.advance_id)
            self.db.delete(rep)
        for adj in self.adjustments.list_for_payslip(tenant_id, payslip.id):
            self.db.delete(adj)
        self.db.flush()
        self.db.delete(payslip)
        self.db.flush()
        for advance_id in advance_ids:
            advance = self.advances.get_by_id(tenant_id, advance_id)
            if advance is not None:
                self._refresh_advance_status(tenant_id, advance)

    def delete_run(self, tenant_id: uuid.UUID, run_id: uuid.UUID) -> None:
        run = self.get_run(tenant_id, run_id)
        if run.status != PayrollStatus.DRAFT:
            raise ConflictError("Only a draft payroll run can be deleted")
        for payslip in self.payslips.list_for_run(tenant_id, run.id):
            self._delete_payslip(tenant_id, payslip)
        self.db.delete(run)
        self.db.commit()

    def approve(self, tenant_id: uuid.UUID, run_id: uuid.UUID, user_id: uuid.UUID) -> PayrollRun:
        run = self.get_run(tenant_id, run_id)
        if run.status != PayrollStatus.DRAFT:
            raise ConflictError("Only a draft payroll run can be approved")
        payslips = self.payslips.list_for_run(tenant_id, run.id)
        if not payslips:
            raise ConflictError("Payroll run has no payslips")
        run.status = PayrollStatus.APPROVED
        run.approved_by_user_id = user_id
        run.approved_at = datetime.now(timezone.utc)
        for p in payslips:
            p.status = PayrollStatus.APPROVED
        self.db.commit()
        self.db.refresh(run)
        return run

    def mark_paid(self, tenant_id: uuid.UUID, run_id: uuid.UUID) -> PayrollRun:
        run = self.get_run(tenant_id, run_id)
        if run.status != PayrollStatus.APPROVED:
            raise ConflictError("Only an approved payroll run can be marked as paid")
        now = datetime.now(timezone.utc)
        run.status = PayrollStatus.PAID
        run.paid_at = now
        for p in self.payslips.list_for_run(tenant_id, run.id):
            p.status = PayrollStatus.PAID
            p.paid_at = now
        self.db.commit()
        self.db.refresh(run)
        return run

    # --- output ---

    def payslip_out(self, payslip: Payslip, run: PayrollRun) -> PayslipOut:
        employee_type, employee_id = employee_key_of(payslip)
        return PayslipOut(
            id=payslip.id,
            payroll_run_id=payslip.payroll_run_id,
            period_month=run.period_month,
            period_year=run.period_year,
            employee_type=employee_type,
            employee_id=employee_id,
            employee_name=payslip.employee_name,
            employee_code=payslip.employee_code,
            designation=payslip.designation,
            basic_salary=float(payslip.basic_salary),
            allowances=payslip.allowances,
            deductions=payslip.deductions,
            total_allowances=float(payslip.total_allowances),
            gross_salary=float(payslip.gross_salary),
            working_days=payslip.working_days,
            per_day_rate=float(payslip.per_day_rate),
            absent_days=float(payslip.absent_days),
            unpaid_leave_days=float(payslip.unpaid_leave_days),
            absence_deduction=float(payslip.absence_deduction),
            structure_deductions=float(payslip.structure_deductions),
            advance_deduction=float(payslip.advance_deduction),
            bonus=float(payslip.bonus),
            adjustment_deduction=float(payslip.adjustment_deduction),
            total_deductions=float(payslip.total_deductions),
            net_pay=float(payslip.net_pay),
            status=payslip.status,
            paid_at=payslip.paid_at,
            adjustments=[PayslipAdjustmentOut.model_validate(a)
                         for a in self.adjustments.list_for_payslip(payslip.tenant_id, payslip.id)],
        )

    def run_out(self, run: PayrollRun, skipped: list[str] | None = None, detail: bool = False):
        payslips = self.payslips.list_for_run(run.tenant_id, run.id)
        data = dict(
            id=run.id,
            period_month=run.period_month,
            period_year=run.period_year,
            status=run.status,
            notes=run.notes,
            approved_at=run.approved_at,
            paid_at=run.paid_at,
            created_at=run.created_at,
            employee_count=len(payslips),
            total_gross=_r(sum(float(p.gross_salary) + float(p.bonus) for p in payslips)),
            total_deductions=_r(sum(float(p.total_deductions) for p in payslips)),
            total_net=_r(sum(float(p.net_pay) for p in payslips)),
            skipped_employees=skipped or [],
        )
        if detail:
            return PayrollRunDetail(**data, payslips=[self.payslip_out(p, run) for p in payslips])
        return PayrollRunOut(**data)

    def list_runs(self, tenant_id: uuid.UUID) -> list[PayrollRunOut]:
        return [self.run_out(r) for r in self.runs.list_sorted(tenant_id)]

    def get_payslip(self, tenant_id: uuid.UUID, payslip_id: uuid.UUID) -> tuple[Payslip, PayrollRun]:
        payslip = self.payslips.get_by_id(tenant_id, payslip_id)
        if payslip is None:
            raise NotFoundError("Payslip not found")
        return payslip, self.get_run(tenant_id, payslip.payroll_run_id)

    def get_own_payslip(self, tenant_id: uuid.UUID, payslip_id: uuid.UUID, teacher_id: uuid.UUID):
        payslip, run = self.get_payslip(tenant_id, payslip_id)
        if payslip.teacher_id != teacher_id or payslip.status == PayrollStatus.DRAFT:
            raise NotFoundError("Payslip not found")
        return payslip, run

    def my_payslips(self, tenant_id: uuid.UUID, teacher_id: uuid.UUID) -> list[PayslipOut]:
        payslips = self.payslips.list_for_teacher(tenant_id, teacher_id, [PayrollStatus.APPROVED, PayrollStatus.PAID])
        out = [self.payslip_out(p, self.get_run(tenant_id, p.payroll_run_id)) for p in payslips]
        out.sort(key=lambda p: (p.period_year, p.period_month), reverse=True)
        return out

    # --- adjustments ---

    def _draft_payslip(self, tenant_id, payslip_id) -> tuple[Payslip, PayrollRun]:
        payslip, run = self.get_payslip(tenant_id, payslip_id)
        if run.status != PayrollStatus.DRAFT:
            raise ConflictError("Adjustments can only be changed while the payroll run is a draft")
        return payslip, run

    def add_adjustment(self, tenant_id: uuid.UUID, payslip_id: uuid.UUID, payload: PayslipAdjustmentCreate) -> PayslipOut:
        payslip, run = self._draft_payslip(tenant_id, payslip_id)
        self.adjustments.create(
            PayslipAdjustment(tenant_id=tenant_id, payslip_id=payslip.id, kind=payload.kind, amount=payload.amount,
                              note=payload.note)
        )
        self._apply_totals(tenant_id, payslip)
        self.db.commit()
        self.db.refresh(payslip)
        return self.payslip_out(payslip, run)

    def remove_adjustment(self, tenant_id: uuid.UUID, payslip_id: uuid.UUID, adjustment_id: uuid.UUID) -> PayslipOut:
        payslip, run = self._draft_payslip(tenant_id, payslip_id)
        adj = self.adjustments.get_by_id(tenant_id, adjustment_id)
        if adj is None or adj.payslip_id != payslip.id:
            raise NotFoundError("Adjustment not found")
        self.db.delete(adj)
        self.db.flush()
        self._apply_totals(tenant_id, payslip)
        self.db.commit()
        self.db.refresh(payslip)
        return self.payslip_out(payslip, run)

    # --- advances ---

    def advance_out(self, advance: SalaryAdvance, names: dict) -> SalaryAdvanceOut:
        employee_type, employee_id = employee_key_of(advance)
        repaid = self.repayments.total_for_advance(advance.tenant_id, advance.id)
        return SalaryAdvanceOut(
            id=advance.id,
            employee_type=employee_type,
            employee_id=employee_id,
            employee_name=names.get((employee_type, employee_id), "Unknown"),
            amount=float(advance.amount),
            monthly_installment=float(advance.monthly_installment),
            issued_on=advance.issued_on,
            reason=advance.reason,
            status=advance.status,
            amount_repaid=_r(repaid),
            balance=_r(max(float(advance.amount) - repaid, 0)),
            created_at=advance.created_at,
        )

    def create_advance(self, tenant_id: uuid.UUID, payload: SalaryAdvanceCreate, user_id: uuid.UUID) -> SalaryAdvanceOut:
        employee = self.hr.resolve(tenant_id, payload.employee_type, payload.employee_id)
        advance = self.advances.create(
            SalaryAdvance(tenant_id=tenant_id, teacher_id=employee.teacher_id, staff_id=employee.staff_id,
                          amount=payload.amount, monthly_installment=payload.monthly_installment,
                          issued_on=payload.issued_on, reason=payload.reason, created_by_user_id=user_id)
        )
        self.db.commit()
        self.db.refresh(advance)
        return self.advance_out(advance, {employee.key: employee.full_name})

    def list_advances(
        self, tenant_id: uuid.UUID, employee_type: str | None = None, employee_id: uuid.UUID | None = None,
        status: SalaryAdvanceStatus | None = None,
    ) -> list[SalaryAdvanceOut]:
        teacher_id = staff_id = None
        if employee_type and employee_id:
            employee = self.hr.resolve(tenant_id, employee_type, employee_id)
            teacher_id, staff_id = employee.teacher_id, employee.staff_id
        names = self.hr.name_map(tenant_id)
        return [self.advance_out(a, names) for a in self.advances.list_filtered(tenant_id, teacher_id, staff_id, status)]

    def delete_advance(self, tenant_id: uuid.UUID, advance_id: uuid.UUID) -> None:
        advance = self.advances.get_by_id(tenant_id, advance_id)
        if advance is None:
            raise NotFoundError("Advance not found")
        if self.repayments.count_for_advance(tenant_id, advance.id):
            raise ConflictError("Advance already has repayments through payroll and cannot be deleted")
        self.db.delete(advance)
        self.db.commit()
