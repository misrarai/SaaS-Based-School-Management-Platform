import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.payroll import (
    EmploymentType,
    LeaveRequestStatus,
    PayrollStatus,
    PayslipAdjustmentKind,
    SalaryAdvanceStatus,
)

EmployeeType = Literal["teacher", "staff"]


class EmployeeRef(BaseModel):
    employee_type: EmployeeType
    employee_id: uuid.UUID


# --- Departments & designations ---


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)


class DepartmentOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None

    model_config = {"from_attributes": True}


class DesignationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    department_id: uuid.UUID | None = None
    description: str | None = Field(default=None, max_length=255)


class DesignationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    department_id: uuid.UUID | None = None
    description: str | None = Field(default=None, max_length=255)


class DesignationOut(BaseModel):
    id: uuid.UUID
    name: str
    department_id: uuid.UUID | None
    description: str | None

    model_config = {"from_attributes": True}


# --- Employee HR profiles ---


class EmployeeProfileUpsert(BaseModel):
    cnic: str | None = Field(default=None, max_length=20)
    date_of_birth: date | None = None
    gender: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=500)
    qualification: str | None = Field(default=None, max_length=255)
    joining_date: date | None = None
    bank_name: str | None = Field(default=None, max_length=100)
    bank_account_no: str | None = Field(default=None, max_length=50)
    department_id: uuid.UUID | None = None
    designation_id: uuid.UUID | None = None
    employment_type: EmploymentType = EmploymentType.PERMANENT
    contract_start: date | None = None
    contract_end: date | None = None
    emergency_contact_name: str | None = Field(default=None, max_length=255)
    emergency_contact_phone: str | None = Field(default=None, max_length=30)
    emergency_contact_relation: str | None = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def _contract_dates(self):
        if self.contract_start and self.contract_end and self.contract_end < self.contract_start:
            raise ValueError("contract_end must be on or after contract_start")
        return self


class EmployeeProfileOut(EmployeeProfileUpsert):
    id: uuid.UUID

    model_config = {"from_attributes": True}


class EmployeeOut(BaseModel):
    employee_type: EmployeeType
    employee_id: uuid.UUID
    full_name: str
    employee_code: str | None
    email: str | None
    phone: str | None
    status: str
    department_name: str | None
    designation_name: str | None
    current_basic_salary: float | None
    current_gross_salary: float | None
    profile: EmployeeProfileOut | None


# --- Salary structures ---

AllowanceType = Literal["house_rent", "medical", "conveyance", "custom"]
DeductionType = Literal["provident_fund", "tax", "custom"]


class AllowanceItem(BaseModel):
    type: AllowanceType = "custom"
    name: str = Field(min_length=1, max_length=100)
    amount: float = Field(ge=0)


class DeductionItem(BaseModel):
    type: DeductionType = "custom"
    name: str = Field(min_length=1, max_length=100)
    amount: float = Field(ge=0)


class SalaryStructureCreate(EmployeeRef):
    basic_salary: float = Field(ge=0)
    allowances: list[AllowanceItem] = Field(default_factory=list)
    deductions: list[DeductionItem] = Field(default_factory=list)
    effective_from: date
    notes: str | None = Field(default=None, max_length=255)


class SalaryStructureOut(BaseModel):
    id: uuid.UUID
    employee_type: EmployeeType
    employee_id: uuid.UUID
    employee_name: str
    basic_salary: float
    allowances: list[AllowanceItem]
    deductions: list[DeductionItem]
    total_allowances: float
    total_deductions: float
    gross_salary: float
    effective_from: date
    notes: str | None


# --- Leaves ---


class LeaveTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    yearly_quota: int = Field(default=0, ge=0, le=366)
    is_paid: bool = True


class LeaveTypeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    yearly_quota: int | None = Field(default=None, ge=0, le=366)
    is_paid: bool | None = None
    is_active: bool | None = None


class LeaveTypeOut(BaseModel):
    id: uuid.UUID
    name: str
    yearly_quota: int
    is_paid: bool
    is_active: bool

    model_config = {"from_attributes": True}


class _LeaveDates(BaseModel):
    leave_type_id: uuid.UUID
    from_date: date
    to_date: date
    reason: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _dates(self):
        if self.to_date < self.from_date:
            raise ValueError("to_date must be on or after from_date")
        if (self.to_date - self.from_date).days > 365:
            raise ValueError("A single leave request cannot exceed one year")
        return self


class MyLeaveRequestCreate(_LeaveDates):
    pass


class LeaveRequestCreate(_LeaveDates):
    employee_type: EmployeeType
    employee_id: uuid.UUID


class LeaveDecision(BaseModel):
    note: str | None = Field(default=None, max_length=255)


class LeaveRequestOut(BaseModel):
    id: uuid.UUID
    employee_type: EmployeeType
    employee_id: uuid.UUID
    employee_name: str
    leave_type_id: uuid.UUID
    leave_type_name: str
    from_date: date
    to_date: date
    days: float
    reason: str | None
    status: LeaveRequestStatus
    approver_user_id: uuid.UUID | None
    approver_name: str | None
    decided_at: datetime | None
    decision_note: str | None
    created_at: datetime


class LeaveBalanceOut(BaseModel):
    leave_type_id: uuid.UUID
    leave_type_name: str
    is_paid: bool
    yearly_quota: int
    used: float
    pending: float
    remaining: float | None  # None = unlimited quota


# --- Payroll ---


class PayrollRunCreate(BaseModel):
    period_month: int = Field(ge=1, le=12)
    period_year: int = Field(ge=2000, le=2100)
    notes: str | None = Field(default=None, max_length=255)


class PayslipAdjustmentCreate(BaseModel):
    kind: PayslipAdjustmentKind
    amount: float = Field(gt=0)
    note: str | None = Field(default=None, max_length=255)


class PayslipAdjustmentOut(BaseModel):
    id: uuid.UUID
    kind: PayslipAdjustmentKind
    amount: float
    note: str | None

    model_config = {"from_attributes": True}


class PayslipLine(BaseModel):
    type: str
    name: str
    amount: float


class PayslipOut(BaseModel):
    id: uuid.UUID
    payroll_run_id: uuid.UUID
    period_month: int
    period_year: int
    employee_type: EmployeeType
    employee_id: uuid.UUID
    employee_name: str
    employee_code: str | None
    designation: str | None
    basic_salary: float
    allowances: list[PayslipLine]
    deductions: list[PayslipLine]
    total_allowances: float
    gross_salary: float
    working_days: int
    per_day_rate: float
    absent_days: float
    unpaid_leave_days: float
    absence_deduction: float
    structure_deductions: float
    advance_deduction: float
    bonus: float
    adjustment_deduction: float
    total_deductions: float
    net_pay: float
    status: PayrollStatus
    paid_at: datetime | None
    adjustments: list[PayslipAdjustmentOut]


class PayrollRunOut(BaseModel):
    id: uuid.UUID
    period_month: int
    period_year: int
    status: PayrollStatus
    notes: str | None
    approved_at: datetime | None
    paid_at: datetime | None
    created_at: datetime
    employee_count: int
    total_gross: float
    total_deductions: float
    total_net: float
    skipped_employees: list[str] = Field(default_factory=list)


class PayrollRunDetail(PayrollRunOut):
    payslips: list[PayslipOut]


# --- Advances ---


class SalaryAdvanceCreate(EmployeeRef):
    amount: float = Field(gt=0)
    monthly_installment: float = Field(gt=0)
    issued_on: date
    reason: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def _installment(self):
        if self.monthly_installment > self.amount:
            raise ValueError("monthly_installment cannot exceed the advance amount")
        return self


class SalaryAdvanceOut(BaseModel):
    id: uuid.UUID
    employee_type: EmployeeType
    employee_id: uuid.UUID
    employee_name: str
    amount: float
    monthly_installment: float
    issued_on: date
    reason: str | None
    status: SalaryAdvanceStatus
    amount_repaid: float
    balance: float
    created_at: datetime
