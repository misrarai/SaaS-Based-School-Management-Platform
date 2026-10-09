"""HR, payroll & leave models.

An "employee" is either a TeacherProfile (has a login) or a Staff member (no login). Every
employee-scoped table carries both a nullable teacher_id and a nullable staff_id — exactly one is
set (enforced in the service layer) — so payroll can treat both populations uniformly without
touching the existing teacher/staff tables.
"""

import enum
import uuid
from datetime import date as date_
from datetime import datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class EmploymentType(str, enum.Enum):
    PERMANENT = "permanent"
    CONTRACT = "contract"
    VISITING = "visiting"


class LeaveRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class PayrollStatus(str, enum.Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    PAID = "paid"


class PayslipAdjustmentKind(str, enum.Enum):
    BONUS = "bonus"  # added to net pay
    ADVANCE = "advance"  # ad-hoc recovery, deducted
    FINE = "fine"  # deducted


class SalaryAdvanceStatus(str, enum.Enum):
    ACTIVE = "active"
    REPAID = "repaid"


class Department(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "hr_departments"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_hr_department_tenant_name"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Designation(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "hr_designations"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_hr_designation_tenant_name"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    department_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("hr_departments.id"), nullable=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)


class EmployeeProfile(UUIDPKMixin, TimestampMixin, Base):
    """HR extension of a teacher or staff member."""

    __tablename__ = "hr_employee_profiles"
    __table_args__ = (
        UniqueConstraint("tenant_id", "teacher_id", name="uq_hr_profile_tenant_teacher"),
        UniqueConstraint("tenant_id", "staff_id", name="uq_hr_profile_tenant_staff"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("teacher_profiles.id"), nullable=True)
    staff_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("staff.id"), nullable=True)
    cnic: Mapped[str | None] = mapped_column(String(20), nullable=True)
    date_of_birth: Mapped[date_ | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    qualification: Mapped[str | None] = mapped_column(String(255), nullable=True)
    joining_date: Mapped[date_ | None] = mapped_column(Date, nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bank_account_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    department_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("hr_departments.id"), nullable=True)
    designation_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("hr_designations.id"), nullable=True)
    employment_type: Mapped[EmploymentType] = mapped_column(
        Enum(EmploymentType), default=EmploymentType.PERMANENT, nullable=False
    )
    contract_start: Mapped[date_ | None] = mapped_column(Date, nullable=True)
    contract_end: Mapped[date_ | None] = mapped_column(Date, nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    emergency_contact_relation: Mapped[str | None] = mapped_column(String(50), nullable=True)


class SalaryStructure(UUIDPKMixin, TimestampMixin, Base):
    """Versioned by effective_from: the structure used for a payroll month is the latest one whose
    effective_from is on/before the month's last day. allowances/deductions are JSON lists of
    {"type": "house_rent"|"medical"|"conveyance"|"provident_fund"|"tax"|"custom", "name": str, "amount": float}."""

    __tablename__ = "hr_salary_structures"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("teacher_profiles.id"), nullable=True)
    staff_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("staff.id"), nullable=True)
    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    allowances: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    deductions: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    effective_from: Mapped[date_] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)


class LeaveType(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "hr_leave_types"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_hr_leave_type_tenant_name"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    yearly_quota: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # 0 = no limit
    is_paid: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class LeaveRequest(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "hr_leave_requests"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("teacher_profiles.id"), nullable=True, index=True
    )
    staff_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("staff.id"), nullable=True, index=True)
    leave_type_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("hr_leave_types.id"), nullable=False)
    from_date: Mapped[date_] = mapped_column(Date, nullable=False)
    to_date: Mapped[date_] = mapped_column(Date, nullable=False)
    days: Mapped[float] = mapped_column(Numeric(5, 1), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[LeaveRequestStatus] = mapped_column(
        Enum(LeaveRequestStatus), default=LeaveRequestStatus.PENDING, nullable=False
    )
    applied_by_user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    approver_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_note: Mapped[str | None] = mapped_column(String(255), nullable=True)


class PayrollRun(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "hr_payroll_runs"
    __table_args__ = (UniqueConstraint("tenant_id", "period_month", "period_year", name="uq_hr_payroll_run_period"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)
    period_year: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[PayrollStatus] = mapped_column(Enum(PayrollStatus), default=PayrollStatus.DRAFT, nullable=False)
    generated_by_user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Payslip(UUIDPKMixin, TimestampMixin, Base):
    """Snapshot of one employee's pay for a run — names/amounts are copied in so the slip stays
    stable even if the salary structure or employee record changes later."""

    __tablename__ = "hr_payslips"
    __table_args__ = (
        UniqueConstraint("payroll_run_id", "teacher_id", name="uq_hr_payslip_run_teacher"),
        UniqueConstraint("payroll_run_id", "staff_id", name="uq_hr_payslip_run_staff"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    payroll_run_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("hr_payroll_runs.id"), nullable=False, index=True
    )
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("teacher_profiles.id"), nullable=True, index=True
    )
    staff_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("staff.id"), nullable=True, index=True)
    employee_name: Mapped[str] = mapped_column(String(255), nullable=False)
    employee_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    designation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    allowances: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    deductions: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    total_allowances: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    gross_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    working_days: Mapped[int] = mapped_column(Integer, nullable=False)
    per_day_rate: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    absent_days: Mapped[float] = mapped_column(Numeric(5, 1), default=0, nullable=False)
    unpaid_leave_days: Mapped[float] = mapped_column(Numeric(5, 1), default=0, nullable=False)
    absence_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    structure_deductions: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    advance_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    bonus: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    adjustment_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    total_deductions: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    net_pay: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[PayrollStatus] = mapped_column(Enum(PayrollStatus), default=PayrollStatus.DRAFT, nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PayslipAdjustment(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "hr_payslip_adjustments"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    payslip_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("hr_payslips.id"), nullable=False, index=True)
    kind: Mapped[PayslipAdjustmentKind] = mapped_column(Enum(PayslipAdjustmentKind), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)


class SalaryAdvance(UUIDPKMixin, TimestampMixin, Base):
    """A salary advance / loan. Recovered by monthly_installment through payroll until repaid —
    the repaid amount is the sum of its AdvanceRepayment rows."""

    __tablename__ = "hr_salary_advances"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("teacher_profiles.id"), nullable=True, index=True
    )
    staff_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("staff.id"), nullable=True, index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    monthly_installment: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    issued_on: Mapped[date_] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[SalaryAdvanceStatus] = mapped_column(
        Enum(SalaryAdvanceStatus), default=SalaryAdvanceStatus.ACTIVE, nullable=False
    )
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)


class AdvanceRepayment(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "hr_advance_repayments"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    advance_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("hr_salary_advances.id"), nullable=False, index=True
    )
    payslip_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("hr_payslips.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
