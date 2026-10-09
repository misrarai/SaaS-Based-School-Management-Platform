import uuid
from datetime import date, datetime, timezone

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import DomainError, NotFoundError
from app.core.gate_pass_pdf import render_gate_pass
from app.models.academic import ClassGrade
from app.models.front_office import (
    AdmissionEnquiry,
    Complaint,
    EnquiryFollowUp,
    GatePass,
    PhoneCallLog,
    PostalRecord,
    VisitorLog,
)
from app.models.user import StudentProfile, User
from app.repositories.academic_repo import ClassGradeRepository, SectionRepository
from app.repositories.base import BaseRepository
from app.repositories.front_office_repo import (
    AdmissionEnquiryRepository,
    ComplaintRepository,
    EnquiryFollowUpRepository,
    GatePassRepository,
    PhoneCallLogRepository,
    PostalRecordRepository,
    VisitorLogRepository,
)
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.tenant_repo import TenantRepository
from app.schemas.front_office import (
    CallCreate,
    CallUpdate,
    ComplaintCreate,
    ComplaintUpdate,
    EnquiryConversionPrefill,
    EnquiryCreate,
    EnquirySummary,
    EnquiryUpdate,
    FollowUpCreate,
    GatePassCreate,
    GatePassOut,
    PostalCreate,
    PostalUpdate,
    StudentLookupOut,
    VisitorCreate,
    VisitorUpdate,
)


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _now() -> datetime:
    return datetime.now(timezone.utc)


class FrontOfficeService:
    def __init__(self, db: Session):
        self.db = db
        self.enquiries = AdmissionEnquiryRepository(db)
        self.follow_ups = EnquiryFollowUpRepository(db)
        self.visitors = VisitorLogRepository(db)
        self.complaints = ComplaintRepository(db)
        self.postal = PostalRecordRepository(db)
        self.gate_passes = GatePassRepository(db)
        self.calls = PhoneCallLogRepository(db)
        self.students = StudentProfileRepository(db)
        self.classes = ClassGradeRepository(db)
        self.sections = SectionRepository(db)

    # ---------- generic helpers ----------

    def _get(self, repo: BaseRepository, tenant_id: uuid.UUID, id_: uuid.UUID, label: str):
        obj = repo.get_by_id(tenant_id, id_)
        if obj is None:
            raise NotFoundError(f"{label} not found")
        return obj

    def _apply_update(self, obj, payload: BaseModel):
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(obj, field, value)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def _delete(self, repo: BaseRepository, tenant_id: uuid.UUID, id_: uuid.UUID, label: str) -> None:
        self._get(repo, tenant_id, id_, label)
        repo.delete(tenant_id, id_)
        self.db.commit()

    def _save(self, repo: BaseRepository, obj):
        repo.create(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def _validate_class(self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID | None) -> ClassGrade | None:
        if class_grade_id is None:
            return None
        grade = self.classes.get_by_id(tenant_id, class_grade_id)
        if grade is None:
            raise NotFoundError("Class not found")
        return grade

    # ---------- admission enquiries ----------

    def create_enquiry(self, tenant_id: uuid.UUID, payload: EnquiryCreate) -> AdmissionEnquiry:
        data = payload.model_dump()
        grade = self._validate_class(tenant_id, payload.class_grade_id)
        if grade is not None and not data.get("class_interested"):
            data["class_interested"] = grade.name
        data["enquiry_date"] = data.get("enquiry_date") or _today()
        return self._save(self.enquiries, AdmissionEnquiry(tenant_id=tenant_id, **data))

    def list_enquiries(self, tenant_id: uuid.UUID, **filters) -> list[AdmissionEnquiry]:
        return self.enquiries.search(tenant_id, **filters)

    def get_enquiry(self, tenant_id: uuid.UUID, enquiry_id: uuid.UUID) -> AdmissionEnquiry:
        return self._get(self.enquiries, tenant_id, enquiry_id, "Enquiry")

    def update_enquiry(self, tenant_id: uuid.UUID, enquiry_id: uuid.UUID, payload: EnquiryUpdate) -> AdmissionEnquiry:
        enquiry = self.get_enquiry(tenant_id, enquiry_id)
        if "class_grade_id" in payload.model_fields_set:
            self._validate_class(tenant_id, payload.class_grade_id)
        return self._apply_update(enquiry, payload)

    def delete_enquiry(self, tenant_id: uuid.UUID, enquiry_id: uuid.UUID) -> None:
        self.get_enquiry(tenant_id, enquiry_id)
        self.follow_ups.delete_for_enquiry(tenant_id, enquiry_id)
        self.enquiries.delete(tenant_id, enquiry_id)
        self.db.commit()

    def enquiry_summary(self, tenant_id: uuid.UUID) -> EnquirySummary:
        counts = self.enquiries.count_by_status(tenant_id)
        return EnquirySummary(
            total=sum(counts.values()),
            new=counts.get("new", 0),
            follow_up=counts.get("follow_up", 0),
            converted=counts.get("converted", 0),
            closed=counts.get("closed", 0),
            due_follow_ups_today=self.enquiries.count_due_follow_ups(tenant_id, _today()),
        )

    def add_follow_up(
        self, tenant_id: uuid.UUID, enquiry_id: uuid.UUID, payload: FollowUpCreate, user_id: uuid.UUID
    ) -> EnquiryFollowUp:
        enquiry = self.get_enquiry(tenant_id, enquiry_id)
        entry = self.follow_ups.create(
            EnquiryFollowUp(
                tenant_id=tenant_id,
                enquiry_id=enquiry.id,
                follow_up_date=payload.follow_up_date or _today(),
                note=payload.note,
                next_follow_up_date=payload.next_follow_up_date,
                created_by_user_id=user_id,
            )
        )
        enquiry.follow_up_date = payload.next_follow_up_date
        if payload.status:
            enquiry.status = payload.status
        elif enquiry.status == "new":
            enquiry.status = "follow_up"
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def list_follow_ups(self, tenant_id: uuid.UUID, enquiry_id: uuid.UUID) -> list[EnquiryFollowUp]:
        self.get_enquiry(tenant_id, enquiry_id)
        return self.follow_ups.list_for_enquiry(tenant_id, enquiry_id)

    def convert_enquiry(self, tenant_id: uuid.UUID, enquiry_id: uuid.UUID) -> EnquiryConversionPrefill:
        """Marks the enquiry converted and returns data to prefill the student admission form;
        the actual student is created through the normal POST /students flow."""
        enquiry = self.get_enquiry(tenant_id, enquiry_id)
        if enquiry.status == "closed":
            raise DomainError("A closed enquiry cannot be converted")
        enquiry.status = "converted"
        enquiry.follow_up_date = None
        self.db.commit()
        self.db.refresh(enquiry)
        return EnquiryConversionPrefill(
            enquiry_id=enquiry.id,
            full_name=enquiry.student_name,
            guardian_name=enquiry.parent_name,
            email=enquiry.email,
            phone=enquiry.phone,
            class_grade_id=enquiry.class_grade_id,
            class_interested=enquiry.class_interested,
            admission_detail={
                "father_name": enquiry.parent_name,
                "father_mobile": enquiry.phone,
                "guardian_mobile": enquiry.phone,
                "utm_source": enquiry.source,
            },
        )

    # ---------- visitors ----------

    def create_visitor(self, tenant_id: uuid.UUID, payload: VisitorCreate) -> VisitorLog:
        data = payload.model_dump()
        data["in_time"] = data.get("in_time") or _now()
        return self._save(self.visitors, VisitorLog(tenant_id=tenant_id, **data))

    def list_visitors(self, tenant_id: uuid.UUID, **filters) -> list[VisitorLog]:
        return self.visitors.search(tenant_id, **filters)

    def update_visitor(self, tenant_id: uuid.UUID, visitor_id: uuid.UUID, payload: VisitorUpdate) -> VisitorLog:
        return self._apply_update(self._get(self.visitors, tenant_id, visitor_id, "Visitor"), payload)

    def check_out_visitor(self, tenant_id: uuid.UUID, visitor_id: uuid.UUID, out_time: datetime | None) -> VisitorLog:
        visitor = self._get(self.visitors, tenant_id, visitor_id, "Visitor")
        if visitor.out_time is not None:
            raise DomainError("Visitor already checked out")
        visitor.out_time = out_time or _now()
        self.db.commit()
        self.db.refresh(visitor)
        return visitor

    def delete_visitor(self, tenant_id: uuid.UUID, visitor_id: uuid.UUID) -> None:
        self._delete(self.visitors, tenant_id, visitor_id, "Visitor")

    # ---------- complaints ----------

    def create_complaint(self, tenant_id: uuid.UUID, payload: ComplaintCreate) -> Complaint:
        data = payload.model_dump()
        data["complaint_date"] = data.get("complaint_date") or _today()
        return self._save(self.complaints, Complaint(tenant_id=tenant_id, **data))

    def list_complaints(self, tenant_id: uuid.UUID, **filters) -> list[Complaint]:
        return self.complaints.search(tenant_id, **filters)

    def update_complaint(self, tenant_id: uuid.UUID, complaint_id: uuid.UUID, payload: ComplaintUpdate) -> Complaint:
        return self._apply_update(self._get(self.complaints, tenant_id, complaint_id, "Complaint"), payload)

    def delete_complaint(self, tenant_id: uuid.UUID, complaint_id: uuid.UUID) -> None:
        self._delete(self.complaints, tenant_id, complaint_id, "Complaint")

    # ---------- postal ----------

    def create_postal(self, tenant_id: uuid.UUID, payload: PostalCreate) -> PostalRecord:
        data = payload.model_dump()
        data["record_date"] = data.get("record_date") or _today()
        return self._save(self.postal, PostalRecord(tenant_id=tenant_id, **data))

    def list_postal(self, tenant_id: uuid.UUID, **filters) -> list[PostalRecord]:
        return self.postal.search(tenant_id, **filters)

    def update_postal(self, tenant_id: uuid.UUID, record_id: uuid.UUID, payload: PostalUpdate) -> PostalRecord:
        return self._apply_update(self._get(self.postal, tenant_id, record_id, "Postal record"), payload)

    def delete_postal(self, tenant_id: uuid.UUID, record_id: uuid.UUID) -> None:
        self._delete(self.postal, tenant_id, record_id, "Postal record")

    # ---------- phone calls ----------

    def create_call(self, tenant_id: uuid.UUID, payload: CallCreate) -> PhoneCallLog:
        data = payload.model_dump()
        data["call_date"] = data.get("call_date") or _today()
        return self._save(self.calls, PhoneCallLog(tenant_id=tenant_id, **data))

    def list_calls(self, tenant_id: uuid.UUID, **filters) -> list[PhoneCallLog]:
        return self.calls.search(tenant_id, **filters)

    def update_call(self, tenant_id: uuid.UUID, call_id: uuid.UUID, payload: CallUpdate) -> PhoneCallLog:
        return self._apply_update(self._get(self.calls, tenant_id, call_id, "Call log"), payload)

    def delete_call(self, tenant_id: uuid.UUID, call_id: uuid.UUID) -> None:
        self._delete(self.calls, tenant_id, call_id, "Call log")

    # ---------- gate passes ----------

    def _student_context(self, tenant_id: uuid.UUID, student: StudentProfile) -> tuple[str, str | None, str | None]:
        user = self.db.get(User, student.user_id)
        grade = self.classes.get_by_id(tenant_id, student.class_grade_id) if student.class_grade_id else None
        section = self.sections.get_by_id(tenant_id, student.section_id) if student.section_id else None
        return (user.full_name if user else "—"), (grade.name if grade else None), (section.name if section else None)

    def lookup_student(self, tenant_id: uuid.UUID, admission_number: str) -> StudentLookupOut:
        stmt = select(StudentProfile).where(
            StudentProfile.tenant_id == tenant_id, StudentProfile.admission_number == admission_number.strip()
        )
        student = self.db.execute(stmt).scalar_one_or_none()
        if student is None:
            raise NotFoundError("No student with that admission number")
        name, class_name, section_name = self._student_context(tenant_id, student)
        return StudentLookupOut(
            student_id=student.id,
            full_name=name,
            admission_number=student.admission_number,
            class_name=class_name,
            section_name=section_name,
            guardian_name=student.guardian_name,
        )

    def _gate_pass_out(self, tenant_id: uuid.UUID, gp: GatePass) -> GatePassOut:
        student = self.students.get_by_id(tenant_id, gp.student_id)
        name, class_name, section_name = (
            self._student_context(tenant_id, student) if student else ("—", None, None)
        )
        return GatePassOut(
            id=gp.id,
            pass_number=gp.pass_number,
            student_id=gp.student_id,
            student_name=name,
            admission_number=student.admission_number if student else None,
            class_name=class_name,
            section_name=section_name,
            reason=gp.reason,
            guardian_name=gp.guardian_name,
            guardian_relation=gp.guardian_relation,
            guardian_cnic=gp.guardian_cnic,
            guardian_phone=gp.guardian_phone,
            out_time=gp.out_time,
            approved_by=gp.approved_by,
        )

    def create_gate_pass(self, tenant_id: uuid.UUID, payload: GatePassCreate, approver_name: str) -> GatePassOut:
        if payload.student_id is not None:
            student = self.students.get_by_id(tenant_id, payload.student_id)
            if student is None:
                raise NotFoundError("Student not found")
            student_id = student.id
        elif payload.admission_number:
            student_id = self.lookup_student(tenant_id, payload.admission_number).student_id
        else:
            raise DomainError("Provide a student_id or admission_number")
        gp = self.gate_passes.create(
            GatePass(
                tenant_id=tenant_id,
                pass_number=self.gate_passes.next_pass_number(tenant_id),
                student_id=student_id,
                reason=payload.reason,
                guardian_name=payload.guardian_name,
                guardian_relation=payload.guardian_relation,
                guardian_cnic=payload.guardian_cnic,
                guardian_phone=payload.guardian_phone,
                out_time=payload.out_time or _now(),
                approved_by=payload.approved_by or approver_name,
            )
        )
        self.db.commit()
        self.db.refresh(gp)
        return self._gate_pass_out(tenant_id, gp)

    def list_gate_passes(self, tenant_id: uuid.UUID, day: date | None = None) -> list[GatePassOut]:
        return [self._gate_pass_out(tenant_id, gp) for gp in self.gate_passes.search(tenant_id, day)]

    def delete_gate_pass(self, tenant_id: uuid.UUID, pass_id: uuid.UUID) -> None:
        self._delete(self.gate_passes, tenant_id, pass_id, "Gate pass")

    def gate_pass_pdf(self, tenant_id: uuid.UUID, pass_id: uuid.UUID) -> bytes:
        gp = self._get(self.gate_passes, tenant_id, pass_id, "Gate pass")
        out = self._gate_pass_out(tenant_id, gp)
        tenant = TenantRepository(self.db).get_by_id(tenant_id)
        class_label = " - ".join(p for p in (out.class_name, out.section_name) if p)
        return render_gate_pass(
            tenant_name=tenant.name if tenant else "School",
            pass_number=out.pass_number,
            student_name=out.student_name,
            admission_number=out.admission_number,
            class_label=class_label,
            reason=out.reason,
            guardian_name=out.guardian_name,
            guardian_relation=out.guardian_relation,
            guardian_cnic=out.guardian_cnic,
            guardian_phone=out.guardian_phone,
            out_time=out.out_time,
            approved_by=out.approved_by,
        )
