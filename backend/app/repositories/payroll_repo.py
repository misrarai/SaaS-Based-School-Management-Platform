import uuid
from datetime import date

from sqlalchemy import func, select

from app.models.payroll import (
    AdvanceRepayment,
    Department,
    Designation,
    EmployeeProfile,
    LeaveRequest,
    LeaveRequestStatus,
    LeaveType,
    PayrollRun,
    Payslip,
    PayslipAdjustment,
    SalaryAdvance,
    SalaryStructure,
)
from app.repositories.base import BaseRepository


def _employee_filter(model, teacher_id: uuid.UUID | None, staff_id: uuid.UUID | None):
    if teacher_id is not None:
        return model.teacher_id == teacher_id
    return model.staff_id == staff_id


class DepartmentRepository(BaseRepository[Department]):
    model = Department

    def list_sorted(self, tenant_id: uuid.UUID) -> list[Department]:
        stmt = select(Department).where(Department.tenant_id == tenant_id).order_by(Department.name)
        return list(self.db.execute(stmt).scalars().all())

    def get_by_name(self, tenant_id: uuid.UUID, name: str) -> Department | None:
        stmt = select(Department).where(Department.tenant_id == tenant_id, func.lower(Department.name) == name.lower())
        return self.db.execute(stmt).scalar_one_or_none()


class DesignationRepository(BaseRepository[Designation]):
    model = Designation

    def list_sorted(self, tenant_id: uuid.UUID) -> list[Designation]:
        stmt = select(Designation).where(Designation.tenant_id == tenant_id).order_by(Designation.name)
        return list(self.db.execute(stmt).scalars().all())

    def get_by_name(self, tenant_id: uuid.UUID, name: str) -> Designation | None:
        stmt = select(Designation).where(
            Designation.tenant_id == tenant_id, func.lower(Designation.name) == name.lower()
        )
        return self.db.execute(stmt).scalar_one_or_none()


class EmployeeProfileRepository(BaseRepository[EmployeeProfile]):
    model = EmployeeProfile

    def get_for_employee(
        self, tenant_id: uuid.UUID, teacher_id: uuid.UUID | None, staff_id: uuid.UUID | None
    ) -> EmployeeProfile | None:
        stmt = select(EmployeeProfile).where(
            EmployeeProfile.tenant_id == tenant_id, _employee_filter(EmployeeProfile, teacher_id, staff_id)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def count_using(self, tenant_id: uuid.UUID, department_id=None, designation_id=None) -> int:
        stmt = select(func.count()).select_from(EmployeeProfile).where(EmployeeProfile.tenant_id == tenant_id)
        if department_id is not None:
            stmt = stmt.where(EmployeeProfile.department_id == department_id)
        if designation_id is not None:
            stmt = stmt.where(EmployeeProfile.designation_id == designation_id)
        return int(self.db.execute(stmt).scalar_one())


class SalaryStructureRepository(BaseRepository[SalaryStructure]):
    model = SalaryStructure

    def list_filtered(
        self, tenant_id: uuid.UUID, teacher_id: uuid.UUID | None = None, staff_id: uuid.UUID | None = None
    ) -> list[SalaryStructure]:
        stmt = select(SalaryStructure).where(SalaryStructure.tenant_id == tenant_id)
        if teacher_id is not None or staff_id is not None:
            stmt = stmt.where(_employee_filter(SalaryStructure, teacher_id, staff_id))
        stmt = stmt.order_by(SalaryStructure.effective_from.desc(), SalaryStructure.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def current_for_employee(
        self, tenant_id: uuid.UUID, teacher_id: uuid.UUID | None, staff_id: uuid.UUID | None, as_of: date
    ) -> SalaryStructure | None:
        stmt = (
            select(SalaryStructure)
            .where(
                SalaryStructure.tenant_id == tenant_id,
                _employee_filter(SalaryStructure, teacher_id, staff_id),
                SalaryStructure.effective_from <= as_of,
            )
            .order_by(SalaryStructure.effective_from.desc(), SalaryStructure.created_at.desc())
            .limit(1)
        )
        return self.db.execute(stmt).scalar_one_or_none()


class LeaveTypeRepository(BaseRepository[LeaveType]):
    model = LeaveType

    def list_sorted(self, tenant_id: uuid.UUID, active_only: bool = False) -> list[LeaveType]:
        stmt = select(LeaveType).where(LeaveType.tenant_id == tenant_id)
        if active_only:
            stmt = stmt.where(LeaveType.is_active.is_(True))
        return list(self.db.execute(stmt.order_by(LeaveType.name)).scalars().all())

    def get_by_name(self, tenant_id: uuid.UUID, name: str) -> LeaveType | None:
        stmt = select(LeaveType).where(LeaveType.tenant_id == tenant_id, func.lower(LeaveType.name) == name.lower())
        return self.db.execute(stmt).scalar_one_or_none()


class LeaveRequestRepository(BaseRepository[LeaveRequest]):
    model = LeaveRequest

    def list_filtered(
        self,
        tenant_id: uuid.UUID,
        teacher_id: uuid.UUID | None = None,
        staff_id: uuid.UUID | None = None,
        status: LeaveRequestStatus | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[LeaveRequest]:
        stmt = select(LeaveRequest).where(LeaveRequest.tenant_id == tenant_id)
        if teacher_id is not None or staff_id is not None:
            stmt = stmt.where(_employee_filter(LeaveRequest, teacher_id, staff_id))
        if status is not None:
            stmt = stmt.where(LeaveRequest.status == status)
        if date_from is not None:
            stmt = stmt.where(LeaveRequest.to_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(LeaveRequest.from_date <= date_to)
        stmt = stmt.order_by(LeaveRequest.from_date.desc(), LeaveRequest.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())


class PayrollRunRepository(BaseRepository[PayrollRun]):
    model = PayrollRun

    def get_for_period(self, tenant_id: uuid.UUID, month: int, year: int) -> PayrollRun | None:
        stmt = select(PayrollRun).where(
            PayrollRun.tenant_id == tenant_id, PayrollRun.period_month == month, PayrollRun.period_year == year
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_sorted(self, tenant_id: uuid.UUID) -> list[PayrollRun]:
        stmt = (
            select(PayrollRun)
            .where(PayrollRun.tenant_id == tenant_id)
            .order_by(PayrollRun.period_year.desc(), PayrollRun.period_month.desc())
        )
        return list(self.db.execute(stmt).scalars().all())


class PayslipRepository(BaseRepository[Payslip]):
    model = Payslip

    def list_for_run(self, tenant_id: uuid.UUID, run_id: uuid.UUID) -> list[Payslip]:
        stmt = (
            select(Payslip)
            .where(Payslip.tenant_id == tenant_id, Payslip.payroll_run_id == run_id)
            .order_by(Payslip.employee_name)
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_in_run(
        self, tenant_id: uuid.UUID, run_id: uuid.UUID, teacher_id: uuid.UUID | None, staff_id: uuid.UUID | None
    ) -> Payslip | None:
        stmt = select(Payslip).where(
            Payslip.tenant_id == tenant_id,
            Payslip.payroll_run_id == run_id,
            _employee_filter(Payslip, teacher_id, staff_id),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_for_teacher(self, tenant_id: uuid.UUID, teacher_id: uuid.UUID, statuses) -> list[Payslip]:
        stmt = select(Payslip).where(
            Payslip.tenant_id == tenant_id, Payslip.teacher_id == teacher_id, Payslip.status.in_(statuses)
        )
        return list(self.db.execute(stmt).scalars().all())


class PayslipAdjustmentRepository(BaseRepository[PayslipAdjustment]):
    model = PayslipAdjustment

    def list_for_payslip(self, tenant_id: uuid.UUID, payslip_id: uuid.UUID) -> list[PayslipAdjustment]:
        stmt = select(PayslipAdjustment).where(
            PayslipAdjustment.tenant_id == tenant_id, PayslipAdjustment.payslip_id == payslip_id
        ).order_by(PayslipAdjustment.created_at)
        return list(self.db.execute(stmt).scalars().all())


class SalaryAdvanceRepository(BaseRepository[SalaryAdvance]):
    model = SalaryAdvance

    def list_filtered(
        self,
        tenant_id: uuid.UUID,
        teacher_id: uuid.UUID | None = None,
        staff_id: uuid.UUID | None = None,
        status=None,
    ) -> list[SalaryAdvance]:
        stmt = select(SalaryAdvance).where(SalaryAdvance.tenant_id == tenant_id)
        if teacher_id is not None or staff_id is not None:
            stmt = stmt.where(_employee_filter(SalaryAdvance, teacher_id, staff_id))
        if status is not None:
            stmt = stmt.where(SalaryAdvance.status == status)
        stmt = stmt.order_by(SalaryAdvance.issued_on.desc(), SalaryAdvance.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())


class AdvanceRepaymentRepository(BaseRepository[AdvanceRepayment]):
    model = AdvanceRepayment

    def total_for_advance(self, tenant_id: uuid.UUID, advance_id: uuid.UUID) -> float:
        stmt = select(func.coalesce(func.sum(AdvanceRepayment.amount), 0)).where(
            AdvanceRepayment.tenant_id == tenant_id, AdvanceRepayment.advance_id == advance_id
        )
        return float(self.db.execute(stmt).scalar_one())

    def list_for_payslip(self, tenant_id: uuid.UUID, payslip_id: uuid.UUID) -> list[AdvanceRepayment]:
        stmt = select(AdvanceRepayment).where(
            AdvanceRepayment.tenant_id == tenant_id, AdvanceRepayment.payslip_id == payslip_id
        )
        return list(self.db.execute(stmt).scalars().all())

    def count_for_advance(self, tenant_id: uuid.UUID, advance_id: uuid.UUID) -> int:
        stmt = select(func.count()).select_from(AdvanceRepayment).where(
            AdvanceRepayment.tenant_id == tenant_id, AdvanceRepayment.advance_id == advance_id
        )
        return int(self.db.execute(stmt).scalar_one())
