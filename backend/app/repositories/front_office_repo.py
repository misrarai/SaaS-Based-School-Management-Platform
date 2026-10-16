import uuid
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func, or_, select

from app.models.front_office import (
    AdmissionEnquiry,
    Appointment,
    Complaint,
    EnquiryFollowUp,
    GatePass,
    LostFoundItem,
    PhoneCallLog,
    PostalRecord,
    VisitorLog,
)
from app.repositories.base import BaseRepository


def _day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


class AdmissionEnquiryRepository(BaseRepository[AdmissionEnquiry]):
    model = AdmissionEnquiry

    def search(
        self,
        tenant_id: uuid.UUID,
        status: str | None = None,
        query: str | None = None,
        source: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[AdmissionEnquiry]:
        stmt = select(AdmissionEnquiry).where(AdmissionEnquiry.tenant_id == tenant_id)
        if status and status != "all":
            stmt = stmt.where(AdmissionEnquiry.status == status)
        if source:
            stmt = stmt.where(AdmissionEnquiry.source == source)
        if date_from:
            stmt = stmt.where(AdmissionEnquiry.enquiry_date >= date_from)
        if date_to:
            stmt = stmt.where(AdmissionEnquiry.enquiry_date <= date_to)
        if query:
            like = f"%{query}%"
            stmt = stmt.where(
                or_(
                    AdmissionEnquiry.student_name.ilike(like),
                    AdmissionEnquiry.parent_name.ilike(like),
                    AdmissionEnquiry.phone.ilike(like),
                )
            )
        stmt = stmt.order_by(AdmissionEnquiry.enquiry_date.desc(), AdmissionEnquiry.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def count_by_status(self, tenant_id: uuid.UUID) -> dict[str, int]:
        stmt = (
            select(AdmissionEnquiry.status, func.count(AdmissionEnquiry.id))
            .where(AdmissionEnquiry.tenant_id == tenant_id)
            .group_by(AdmissionEnquiry.status)
        )
        return {row[0]: row[1] for row in self.db.execute(stmt).all()}

    def count_due_follow_ups(self, tenant_id: uuid.UUID, on_or_before: date) -> int:
        stmt = select(func.count(AdmissionEnquiry.id)).where(
            AdmissionEnquiry.tenant_id == tenant_id,
            AdmissionEnquiry.status.in_(("new", "follow_up")),
            AdmissionEnquiry.follow_up_date.is_not(None),
            AdmissionEnquiry.follow_up_date <= on_or_before,
        )
        return int(self.db.execute(stmt).scalar_one())


class EnquiryFollowUpRepository(BaseRepository[EnquiryFollowUp]):
    model = EnquiryFollowUp

    def list_for_enquiry(self, tenant_id: uuid.UUID, enquiry_id: uuid.UUID) -> list[EnquiryFollowUp]:
        stmt = (
            select(EnquiryFollowUp)
            .where(EnquiryFollowUp.tenant_id == tenant_id, EnquiryFollowUp.enquiry_id == enquiry_id)
            .order_by(EnquiryFollowUp.follow_up_date.desc(), EnquiryFollowUp.created_at.desc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def delete_for_enquiry(self, tenant_id: uuid.UUID, enquiry_id: uuid.UUID) -> None:
        for row in self.list_for_enquiry(tenant_id, enquiry_id):
            self.db.delete(row)
        self.db.flush()


class VisitorLogRepository(BaseRepository[VisitorLog]):
    model = VisitorLog

    def search(
        self, tenant_id: uuid.UUID, day: date | None = None, query: str | None = None, inside_only: bool = False
    ) -> list[VisitorLog]:
        stmt = select(VisitorLog).where(VisitorLog.tenant_id == tenant_id)
        if day:
            start, end = _day_bounds(day)
            stmt = stmt.where(VisitorLog.in_time >= start, VisitorLog.in_time < end)
        if inside_only:
            stmt = stmt.where(VisitorLog.out_time.is_(None))
        if query:
            like = f"%{query}%"
            stmt = stmt.where(
                or_(VisitorLog.visitor_name.ilike(like), VisitorLog.phone.ilike(like), VisitorLog.cnic.ilike(like))
            )
        return list(self.db.execute(stmt.order_by(VisitorLog.in_time.desc())).scalars().all())

    def count(self, tenant_id: uuid.UUID, day: date | None = None, inside_only: bool = False) -> int:
        stmt = select(func.count(VisitorLog.id)).where(VisitorLog.tenant_id == tenant_id)
        if day:
            start, end = _day_bounds(day)
            stmt = stmt.where(VisitorLog.in_time >= start, VisitorLog.in_time < end)
        if inside_only:
            stmt = stmt.where(VisitorLog.out_time.is_(None))
        return int(self.db.execute(stmt).scalar_one())


class ComplaintRepository(BaseRepository[Complaint]):
    model = Complaint

    def search(self, tenant_id: uuid.UUID, status: str | None = None, query: str | None = None) -> list[Complaint]:
        stmt = select(Complaint).where(Complaint.tenant_id == tenant_id)
        if status and status != "all":
            stmt = stmt.where(Complaint.status == status)
        if query:
            like = f"%{query}%"
            stmt = stmt.where(
                or_(
                    Complaint.complainant_name.ilike(like),
                    Complaint.complaint_type.ilike(like),
                    Complaint.description.ilike(like),
                )
            )
        stmt = stmt.order_by(Complaint.complaint_date.desc(), Complaint.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def count(self, tenant_id: uuid.UUID, status: str | None = None) -> int:
        stmt = select(func.count(Complaint.id)).where(Complaint.tenant_id == tenant_id)
        if status and status != "all":
            stmt = stmt.where(Complaint.status == status)
        return int(self.db.execute(stmt).scalar_one())


class PostalRecordRepository(BaseRepository[PostalRecord]):
    model = PostalRecord

    def search(self, tenant_id: uuid.UUID, record_type: str | None = None, query: str | None = None) -> list[PostalRecord]:
        stmt = select(PostalRecord).where(PostalRecord.tenant_id == tenant_id)
        if record_type and record_type != "all":
            stmt = stmt.where(PostalRecord.record_type == record_type)
        if query:
            like = f"%{query}%"
            stmt = stmt.where(
                or_(
                    PostalRecord.title.ilike(like),
                    PostalRecord.reference_no.ilike(like),
                    PostalRecord.from_title.ilike(like),
                    PostalRecord.to_title.ilike(like),
                )
            )
        stmt = stmt.order_by(PostalRecord.record_date.desc(), PostalRecord.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def count(self, tenant_id: uuid.UUID, day: date | None = None) -> int:
        stmt = select(func.count(PostalRecord.id)).where(PostalRecord.tenant_id == tenant_id)
        if day:
            stmt = stmt.where(PostalRecord.record_date == day)
        return int(self.db.execute(stmt).scalar_one())


class GatePassRepository(BaseRepository[GatePass]):
    model = GatePass

    def search(self, tenant_id: uuid.UUID, day: date | None = None) -> list[GatePass]:
        stmt = select(GatePass).where(GatePass.tenant_id == tenant_id)
        if day:
            start, end = _day_bounds(day)
            stmt = stmt.where(GatePass.out_time >= start, GatePass.out_time < end)
        return list(self.db.execute(stmt.order_by(GatePass.out_time.desc())).scalars().all())

    def next_pass_number(self, tenant_id: uuid.UUID) -> int:
        stmt = select(func.max(GatePass.pass_number)).where(GatePass.tenant_id == tenant_id)
        return int(self.db.execute(stmt).scalar_one() or 0) + 1

    def count(self, tenant_id: uuid.UUID, day: date | None = None) -> int:
        stmt = select(func.count(GatePass.id)).where(GatePass.tenant_id == tenant_id)
        if day:
            start, end = _day_bounds(day)
            stmt = stmt.where(GatePass.out_time >= start, GatePass.out_time < end)
        return int(self.db.execute(stmt).scalar_one())


class PhoneCallLogRepository(BaseRepository[PhoneCallLog]):
    model = PhoneCallLog

    def search(self, tenant_id: uuid.UUID, call_type: str | None = None, query: str | None = None) -> list[PhoneCallLog]:
        stmt = select(PhoneCallLog).where(PhoneCallLog.tenant_id == tenant_id)
        if call_type and call_type != "all":
            stmt = stmt.where(PhoneCallLog.call_type == call_type)
        if query:
            like = f"%{query}%"
            stmt = stmt.where(
                or_(PhoneCallLog.caller_name.ilike(like), PhoneCallLog.phone.ilike(like), PhoneCallLog.purpose.ilike(like))
            )
        stmt = stmt.order_by(PhoneCallLog.call_date.desc(), PhoneCallLog.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def count(self, tenant_id: uuid.UUID, day: date | None = None) -> int:
        stmt = select(func.count(PhoneCallLog.id)).where(PhoneCallLog.tenant_id == tenant_id)
        if day:
            stmt = stmt.where(PhoneCallLog.call_date == day)
        return int(self.db.execute(stmt).scalar_one())


class AppointmentRepository(BaseRepository[Appointment]):
    model = Appointment

    def search(
        self, tenant_id: uuid.UUID, status: str | None = None, day: date | None = None, query: str | None = None
    ) -> list[Appointment]:
        stmt = select(Appointment).where(Appointment.tenant_id == tenant_id)
        if status and status != "all":
            stmt = stmt.where(Appointment.status == status)
        if day:
            stmt = stmt.where(Appointment.appointment_date == day)
        if query:
            like = f"%{query}%"
            stmt = stmt.where(
                or_(Appointment.visitor_name.ilike(like), Appointment.phone.ilike(like), Appointment.with_whom.ilike(like))
            )
        stmt = stmt.order_by(Appointment.appointment_date.desc(), Appointment.appointment_time)
        return list(self.db.execute(stmt).scalars().all())

    def count(self, tenant_id: uuid.UUID, status: str | None = None, day: date | None = None) -> int:
        stmt = select(func.count(Appointment.id)).where(Appointment.tenant_id == tenant_id)
        if status and status != "all":
            stmt = stmt.where(Appointment.status == status)
        if day:
            stmt = stmt.where(Appointment.appointment_date == day)
        return int(self.db.execute(stmt).scalar_one())


class LostFoundRepository(BaseRepository[LostFoundItem]):
    model = LostFoundItem

    def search(
        self, tenant_id: uuid.UUID, kind: str | None = None, status: str | None = None, query: str | None = None
    ) -> list[LostFoundItem]:
        stmt = select(LostFoundItem).where(LostFoundItem.tenant_id == tenant_id)
        if kind and kind != "all":
            stmt = stmt.where(LostFoundItem.kind == kind)
        if status and status != "all":
            stmt = stmt.where(LostFoundItem.status == status)
        if query:
            like = f"%{query}%"
            stmt = stmt.where(
                or_(
                    LostFoundItem.item_name.ilike(like),
                    LostFoundItem.location.ilike(like),
                    LostFoundItem.reported_by.ilike(like),
                )
            )
        stmt = stmt.order_by(LostFoundItem.item_date.desc(), LostFoundItem.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())
