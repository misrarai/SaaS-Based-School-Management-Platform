"""HR setup for the payroll module: the unified employee view (teachers + non-teaching staff),
departments, designations, HR profiles and salary structures."""

import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, DomainError, NotFoundError
from app.models.payroll import Department, Designation, EmployeeProfile, SalaryStructure
from app.models.user import TeacherProfile
from app.repositories.payroll_repo import (
    DepartmentRepository,
    DesignationRepository,
    EmployeeProfileRepository,
    SalaryStructureRepository,
)
from app.repositories.staff_repo import StaffRepository
from app.repositories.teacher_repo import TeacherProfileRepository
from app.schemas.payroll import (
    DepartmentCreate,
    DepartmentUpdate,
    DesignationCreate,
    DesignationUpdate,
    EmployeeOut,
    EmployeeProfileOut,
    EmployeeProfileUpsert,
    SalaryStructureCreate,
    SalaryStructureOut,
)

TEACHER = "teacher"
STAFF = "staff"


@dataclass
class Employee:
    employee_type: str
    employee_id: uuid.UUID
    full_name: str
    employee_code: str | None
    email: str | None
    phone: str | None
    status: str  # active / inactive
    default_designation: str | None

    @property
    def teacher_id(self) -> uuid.UUID | None:
        return self.employee_id if self.employee_type == TEACHER else None

    @property
    def staff_id(self) -> uuid.UUID | None:
        return self.employee_id if self.employee_type == STAFF else None

    @property
    def key(self) -> tuple[str, uuid.UUID]:
        return (self.employee_type, self.employee_id)


def employee_key_of(obj) -> tuple[str, uuid.UUID]:
    """(employee_type, employee_id) for any row carrying teacher_id / staff_id."""
    if obj.teacher_id is not None:
        return (TEACHER, obj.teacher_id)
    return (STAFF, obj.staff_id)


def split_ref(employee_type: str, employee_id: uuid.UUID) -> tuple[uuid.UUID | None, uuid.UUID | None]:
    return (employee_id, None) if employee_type == TEACHER else (None, employee_id)


def _sum(items: list[dict]) -> float:
    return round(sum(float(i.get("amount", 0) or 0) for i in items), 2)


class PayrollHrService:
    def __init__(self, db: Session):
        self.db = db
        self.teachers = TeacherProfileRepository(db)
        self.staff = StaffRepository(db)
        self.departments = DepartmentRepository(db)
        self.designations = DesignationRepository(db)
        self.profiles = EmployeeProfileRepository(db)
        self.structures = SalaryStructureRepository(db)

    # --- employees ---

    def list_employees(self, tenant_id: uuid.UUID, status: str | None = "active", query: str | None = None) -> list[Employee]:
        result: list[Employee] = []
        for profile, user in self.teachers.list_with_users(tenant_id, query):
            emp_status = "active" if user.is_active else "inactive"
            result.append(
                Employee(TEACHER, profile.id, user.full_name, profile.employee_code, user.email,
                         user.phone_number, emp_status, "Teacher")
            )
        for member in self.staff.search(tenant_id, query, None):
            result.append(
                Employee(STAFF, member.id, member.full_name, member.employee_code, None, member.phone,
                         member.status, member.designation)
            )
        if status and status != "all":
            result = [e for e in result if e.status == status]
        result.sort(key=lambda e: e.full_name.lower())
        return result

    def resolve(self, tenant_id: uuid.UUID, employee_type: str, employee_id: uuid.UUID) -> Employee:
        if employee_type == TEACHER:
            found = self.teachers.get_with_user(tenant_id, employee_id)
            if found is None:
                raise NotFoundError("Teacher not found")
            profile, user = found
            return Employee(TEACHER, profile.id, user.full_name, profile.employee_code, user.email,
                            user.phone_number, "active" if user.is_active else "inactive", "Teacher")
        if employee_type == STAFF:
            member = self.staff.get_by_id(tenant_id, employee_id)
            if member is None:
                raise NotFoundError("Staff member not found")
            return Employee(STAFF, member.id, member.full_name, member.employee_code, None, member.phone,
                            member.status, member.designation)
        raise DomainError("employee_type must be 'teacher' or 'staff'")

    def resolve_row(self, tenant_id: uuid.UUID, obj) -> Employee:
        return self.resolve(tenant_id, *employee_key_of(obj))

    def name_map(self, tenant_id: uuid.UUID) -> dict[tuple[str, uuid.UUID], str]:
        return {e.key: e.full_name for e in self.list_employees(tenant_id, status="all")}

    def teacher_for_user(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> TeacherProfile:
        teacher = self.teachers.get_by_user_id(tenant_id, user_id)
        if teacher is None:
            raise NotFoundError("Teacher profile not found")
        return teacher

    def designation_label(self, tenant_id: uuid.UUID, employee: Employee) -> str | None:
        profile = self.profiles.get_for_employee(tenant_id, employee.teacher_id, employee.staff_id)
        if profile is not None and profile.designation_id is not None:
            designation = self.designations.get_by_id(tenant_id, profile.designation_id)
            if designation is not None:
                return designation.name
        return employee.default_designation

    def employees_view(self, tenant_id: uuid.UUID, status: str | None, query: str | None) -> list[EmployeeOut]:
        departments = {d.id: d.name for d in self.departments.list(tenant_id)}
        designations = {d.id: d.name for d in self.designations.list(tenant_id)}
        profiles = {employee_key_of(p): p for p in self.profiles.list(tenant_id)}
        latest: dict[tuple[str, uuid.UUID], SalaryStructure] = {}
        today = date.today()
        for s in self.structures.list_filtered(tenant_id):  # newest first
            key = employee_key_of(s)
            if key not in latest and s.effective_from <= today:
                latest[key] = s
        out = []
        for e in self.list_employees(tenant_id, status, query):
            profile = profiles.get(e.key)
            structure = latest.get(e.key)
            out.append(
                EmployeeOut(
                    employee_type=e.employee_type,
                    employee_id=e.employee_id,
                    full_name=e.full_name,
                    employee_code=e.employee_code,
                    email=e.email,
                    phone=e.phone,
                    status=e.status,
                    department_name=departments.get(profile.department_id) if profile else None,
                    designation_name=(designations.get(profile.designation_id) if profile and profile.designation_id else None)
                    or e.default_designation,
                    current_basic_salary=float(structure.basic_salary) if structure else None,
                    current_gross_salary=(float(structure.basic_salary) + _sum(structure.allowances)) if structure else None,
                    profile=EmployeeProfileOut.model_validate(profile) if profile else None,
                )
            )
        return out

    # --- departments ---

    def list_departments(self, tenant_id: uuid.UUID) -> list[Department]:
        return self.departments.list_sorted(tenant_id)

    def create_department(self, tenant_id: uuid.UUID, payload: DepartmentCreate) -> Department:
        if self.departments.get_by_name(tenant_id, payload.name.strip()) is not None:
            raise ConflictError("A department with this name already exists")
        dept = self.departments.create(Department(tenant_id=tenant_id, name=payload.name.strip(), description=payload.description))
        self.db.commit()
        self.db.refresh(dept)
        return dept

    def _department(self, tenant_id: uuid.UUID, department_id: uuid.UUID) -> Department:
        dept = self.departments.get_by_id(tenant_id, department_id)
        if dept is None:
            raise NotFoundError("Department not found")
        return dept

    def update_department(self, tenant_id: uuid.UUID, department_id: uuid.UUID, payload: DepartmentUpdate) -> Department:
        dept = self._department(tenant_id, department_id)
        data = payload.model_dump(exclude_unset=True)
        if "name" in data and data["name"]:
            other = self.departments.get_by_name(tenant_id, data["name"].strip())
            if other is not None and other.id != dept.id:
                raise ConflictError("A department with this name already exists")
            data["name"] = data["name"].strip()
        for field, value in data.items():
            setattr(dept, field, value)
        self.db.commit()
        self.db.refresh(dept)
        return dept

    def delete_department(self, tenant_id: uuid.UUID, department_id: uuid.UUID) -> None:
        dept = self._department(tenant_id, department_id)
        if self.profiles.count_using(tenant_id, department_id=dept.id) or any(
            d.department_id == dept.id for d in self.designations.list(tenant_id)
        ):
            raise ConflictError("Department is in use by employees or designations")
        self.db.delete(dept)
        self.db.commit()

    # --- designations ---

    def list_designations(self, tenant_id: uuid.UUID) -> list[Designation]:
        return self.designations.list_sorted(tenant_id)

    def create_designation(self, tenant_id: uuid.UUID, payload: DesignationCreate) -> Designation:
        if self.designations.get_by_name(tenant_id, payload.name.strip()) is not None:
            raise ConflictError("A designation with this name already exists")
        if payload.department_id is not None:
            self._department(tenant_id, payload.department_id)
        desig = self.designations.create(
            Designation(tenant_id=tenant_id, name=payload.name.strip(), department_id=payload.department_id,
                        description=payload.description)
        )
        self.db.commit()
        self.db.refresh(desig)
        return desig

    def _designation(self, tenant_id: uuid.UUID, designation_id: uuid.UUID) -> Designation:
        desig = self.designations.get_by_id(tenant_id, designation_id)
        if desig is None:
            raise NotFoundError("Designation not found")
        return desig

    def update_designation(self, tenant_id: uuid.UUID, designation_id: uuid.UUID, payload: DesignationUpdate) -> Designation:
        desig = self._designation(tenant_id, designation_id)
        data = payload.model_dump(exclude_unset=True)
        if data.get("name"):
            other = self.designations.get_by_name(tenant_id, data["name"].strip())
            if other is not None and other.id != desig.id:
                raise ConflictError("A designation with this name already exists")
            data["name"] = data["name"].strip()
        if data.get("department_id") is not None:
            self._department(tenant_id, data["department_id"])
        for field, value in data.items():
            setattr(desig, field, value)
        self.db.commit()
        self.db.refresh(desig)
        return desig

    def delete_designation(self, tenant_id: uuid.UUID, designation_id: uuid.UUID) -> None:
        desig = self._designation(tenant_id, designation_id)
        if self.profiles.count_using(tenant_id, designation_id=desig.id):
            raise ConflictError("Designation is in use by employees")
        self.db.delete(desig)
        self.db.commit()

    # --- HR profiles ---

    def get_profile(self, tenant_id: uuid.UUID, employee_type: str, employee_id: uuid.UUID) -> EmployeeProfile | None:
        employee = self.resolve(tenant_id, employee_type, employee_id)
        return self.profiles.get_for_employee(tenant_id, employee.teacher_id, employee.staff_id)

    def upsert_profile(
        self, tenant_id: uuid.UUID, employee_type: str, employee_id: uuid.UUID, payload: EmployeeProfileUpsert
    ) -> EmployeeProfile:
        employee = self.resolve(tenant_id, employee_type, employee_id)
        if payload.department_id is not None:
            self._department(tenant_id, payload.department_id)
        if payload.designation_id is not None:
            self._designation(tenant_id, payload.designation_id)
        profile = self.profiles.get_for_employee(tenant_id, employee.teacher_id, employee.staff_id)
        if profile is None:
            profile = self.profiles.create(
                EmployeeProfile(tenant_id=tenant_id, teacher_id=employee.teacher_id, staff_id=employee.staff_id)
            )
        for field, value in payload.model_dump().items():
            setattr(profile, field, value)
        self.db.commit()
        self.db.refresh(profile)
        return profile

    # --- salary structures ---

    def structure_out(self, structure: SalaryStructure, employee_name: str) -> SalaryStructureOut:
        employee_type, employee_id = employee_key_of(structure)
        total_allowances = _sum(structure.allowances)
        return SalaryStructureOut(
            id=structure.id,
            employee_type=employee_type,
            employee_id=employee_id,
            employee_name=employee_name,
            basic_salary=float(structure.basic_salary),
            allowances=structure.allowances,
            deductions=structure.deductions,
            total_allowances=total_allowances,
            total_deductions=_sum(structure.deductions),
            gross_salary=round(float(structure.basic_salary) + total_allowances, 2),
            effective_from=structure.effective_from,
            notes=structure.notes,
        )

    def create_structure(self, tenant_id: uuid.UUID, payload: SalaryStructureCreate) -> SalaryStructureOut:
        employee = self.resolve(tenant_id, payload.employee_type, payload.employee_id)
        structure = self.structures.create(
            SalaryStructure(
                tenant_id=tenant_id,
                teacher_id=employee.teacher_id,
                staff_id=employee.staff_id,
                basic_salary=payload.basic_salary,
                allowances=[a.model_dump() for a in payload.allowances],
                deductions=[d.model_dump() for d in payload.deductions],
                effective_from=payload.effective_from,
                notes=payload.notes,
            )
        )
        self.db.commit()
        self.db.refresh(structure)
        return self.structure_out(structure, employee.full_name)

    def list_structures(
        self, tenant_id: uuid.UUID, employee_type: str | None = None, employee_id: uuid.UUID | None = None
    ) -> list[SalaryStructureOut]:
        teacher_id = staff_id = None
        if employee_type and employee_id:
            employee = self.resolve(tenant_id, employee_type, employee_id)
            teacher_id, staff_id = employee.teacher_id, employee.staff_id
        names = self.name_map(tenant_id)
        return [
            self.structure_out(s, names.get(employee_key_of(s), "Unknown"))
            for s in self.structures.list_filtered(tenant_id, teacher_id, staff_id)
        ]

    def delete_structure(self, tenant_id: uuid.UUID, structure_id: uuid.UUID) -> None:
        structure = self.structures.get_by_id(tenant_id, structure_id)
        if structure is None:
            raise NotFoundError("Salary structure not found")
        self.db.delete(structure)
        self.db.commit()
