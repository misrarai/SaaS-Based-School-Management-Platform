import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models.hifz import Donation, Donor, Halqa, HifzDailyRecord, HifzEnrolment, Sponsorship
from app.repositories.hifz_repo import (
    DailyRecordRepository,
    DonationRepository,
    DonorRepository,
    EnrolmentRepository,
    HalqaRepository,
    SponsorshipRepository,
)
from app.repositories.student_repo import StudentProfileRepository
from app.schemas.hifz import (
    DailyRecordCreate,
    DonationCreate,
    DonorCreate,
    DonorUpdate,
    EnrolmentCreate,
    EnrolmentUpdate,
    HalqaCreate,
    HalqaUpdate,
    SponsorshipCreate,
    SponsorshipUpdate,
)


class HifzService:
    def __init__(self, db: Session):
        self.db = db
        self.halqas = HalqaRepository(db)
        self.enrolments = EnrolmentRepository(db)
        self.records = DailyRecordRepository(db)
        self.donors = DonorRepository(db)
        self.donations = DonationRepository(db)
        self.sponsorships = SponsorshipRepository(db)
        self.students = StudentProfileRepository(db)

    # ---------- halqas ----------
    def list_halqas(self, tenant_id: uuid.UUID) -> list[dict]:
        counts = self.halqas.student_counts(tenant_id)
        return [
            {
                "id": h.id, "name": h.name, "incharge": h.incharge, "description": h.description,
                "is_active": h.is_active, "student_count": counts.get(h.id, 0),
            }
            for h in self.halqas.list_all(tenant_id)
        ]

    def create_halqa(self, tenant_id: uuid.UUID, payload: HalqaCreate) -> dict:
        halqa = self.halqas.create(Halqa(tenant_id=tenant_id, **payload.model_dump()))
        self.db.commit()
        return {"id": halqa.id, "name": halqa.name, "incharge": halqa.incharge,
                "description": halqa.description, "is_active": halqa.is_active, "student_count": 0}

    def update_halqa(self, tenant_id: uuid.UUID, halqa_id: uuid.UUID, payload: HalqaUpdate) -> dict:
        halqa = self.halqas.get_by_id(tenant_id, halqa_id)
        if halqa is None:
            raise NotFoundError("Halqa not found")
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(halqa, field, value)
        self.db.commit()
        counts = self.halqas.student_counts(tenant_id)
        return {"id": halqa.id, "name": halqa.name, "incharge": halqa.incharge,
                "description": halqa.description, "is_active": halqa.is_active, "student_count": counts.get(halqa.id, 0)}

    # ---------- enrolments ----------
    def _student_map(self, tenant_id: uuid.UUID) -> dict[uuid.UUID, tuple[str, str | None]]:
        return {p.id: (u.full_name, p.admission_number) for p, u in self.students.list_with_users(tenant_id)}

    def _halqa_names(self, tenant_id: uuid.UUID) -> dict[uuid.UUID, str]:
        return {h.id: h.name for h in self.halqas.list_all(tenant_id)}

    def _enrolment_out(self, e: HifzEnrolment, students: dict, halqas: dict, rec_counts: dict) -> dict:
        name, adm = students.get(e.student_id, (None, None))
        return {
            "id": e.id, "halqa_id": e.halqa_id, "halqa_name": halqas.get(e.halqa_id),
            "student_id": e.student_id, "student_name": name, "admission_number": adm,
            "start_date": e.start_date, "current_juz": e.current_juz, "current_page": e.current_page,
            "status": e.status, "notes": e.notes, "records_count": rec_counts.get(e.id, 0),
        }

    def list_enrolments(self, tenant_id: uuid.UUID, halqa_id=None, status=None) -> list[dict]:
        students = self._student_map(tenant_id)
        halqas = self._halqa_names(tenant_id)
        rec_counts = self.enrolments.record_counts(tenant_id)
        return [self._enrolment_out(e, students, halqas, rec_counts) for e in self.enrolments.search(tenant_id, halqa_id, status)]

    def create_enrolment(self, tenant_id: uuid.UUID, payload: EnrolmentCreate) -> dict:
        if self.students.get_with_user(tenant_id, payload.student_id) is None:
            raise NotFoundError("Student not found")
        if self.halqas.get_by_id(tenant_id, payload.halqa_id) is None:
            raise NotFoundError("Halqa not found")
        if self.enrolments.exists_for_student(tenant_id, payload.student_id):
            raise ConflictError("This student already has an active Hifz enrolment.")
        e = self.enrolments.create(HifzEnrolment(
            tenant_id=tenant_id, halqa_id=payload.halqa_id, student_id=payload.student_id,
            start_date=payload.start_date or date.today(), current_juz=payload.current_juz, current_page=payload.current_page,
        ))
        self.db.commit()
        students = self._student_map(tenant_id)
        return self._enrolment_out(e, students, self._halqa_names(tenant_id), {})

    def _get_enrolment(self, tenant_id, enrolment_id) -> HifzEnrolment:
        e = self.enrolments.get_by_id(tenant_id, enrolment_id)
        if e is None:
            raise NotFoundError("Enrolment not found")
        return e

    def update_enrolment(self, tenant_id, enrolment_id, payload: EnrolmentUpdate) -> dict:
        e = self._get_enrolment(tenant_id, enrolment_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(e, field, value)
        self.db.commit()
        students = self._student_map(tenant_id)
        rec_counts = self.enrolments.record_counts(tenant_id)
        return self._enrolment_out(e, students, self._halqa_names(tenant_id), rec_counts)

    # ---------- daily records ----------
    def list_records(self, tenant_id, enrolment_id) -> list[HifzDailyRecord]:
        self._get_enrolment(tenant_id, enrolment_id)
        return self.records.list_for_enrolment(tenant_id, enrolment_id)

    def add_record(self, tenant_id, enrolment_id, payload: DailyRecordCreate) -> HifzDailyRecord:
        self._get_enrolment(tenant_id, enrolment_id)
        data = payload.model_dump()
        data["record_date"] = data.get("record_date") or date.today()
        rec = self.records.create(HifzDailyRecord(tenant_id=tenant_id, enrolment_id=enrolment_id, **data))
        self.db.commit()
        self.db.refresh(rec)
        return rec

    # ---------- donors ----------
    def list_donors(self, tenant_id: uuid.UUID) -> list[dict]:
        totals = self.donors.totals(tenant_id)
        sponsors = self.donors.active_sponsorship_counts(tenant_id)
        return [
            {
                "id": d.id, "name": d.name, "phone": d.phone, "email": d.email, "address": d.address,
                "is_active": d.is_active, "total_donated": totals.get(d.id, 0.0), "active_sponsorships": sponsors.get(d.id, 0),
            }
            for d in self.donors.list_all(tenant_id)
        ]

    def create_donor(self, tenant_id: uuid.UUID, payload: DonorCreate) -> dict:
        d = self.donors.create(Donor(tenant_id=tenant_id, **payload.model_dump()))
        self.db.commit()
        return {"id": d.id, "name": d.name, "phone": d.phone, "email": d.email, "address": d.address, "is_active": d.is_active, "total_donated": 0.0, "active_sponsorships": 0}

    def update_donor(self, tenant_id, donor_id, payload: DonorUpdate) -> dict:
        d = self.donors.get_by_id(tenant_id, donor_id)
        if d is None:
            raise NotFoundError("Donor not found")
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(d, field, value)
        self.db.commit()
        totals = self.donors.totals(tenant_id)
        sponsors = self.donors.active_sponsorship_counts(tenant_id)
        return {"id": d.id, "name": d.name, "phone": d.phone, "email": d.email, "address": d.address, "is_active": d.is_active, "total_donated": totals.get(d.id, 0.0), "active_sponsorships": sponsors.get(d.id, 0)}

    def _donor_names(self, tenant_id) -> dict:
        return {d.id: d.name for d in self.donors.list_all(tenant_id)}

    # ---------- donations ----------
    def list_donations(self, tenant_id, donor_id=None) -> list[dict]:
        names = self._donor_names(tenant_id)
        return [
            {"id": x.id, "donor_id": x.donor_id, "donor_name": names.get(x.donor_id), "amount": float(x.amount),
             "donation_date": x.donation_date, "purpose": x.purpose, "payment_method": x.payment_method, "notes": x.notes}
            for x in self.donations.list_all(tenant_id, donor_id)
        ]

    def create_donation(self, tenant_id, payload: DonationCreate) -> dict:
        if self.donors.get_by_id(tenant_id, payload.donor_id) is None:
            raise NotFoundError("Donor not found")
        data = payload.model_dump()
        data["donation_date"] = data.get("donation_date") or date.today()
        x = self.donations.create(Donation(tenant_id=tenant_id, **data))
        self.db.commit()
        names = self._donor_names(tenant_id)
        return {"id": x.id, "donor_id": x.donor_id, "donor_name": names.get(x.donor_id), "amount": float(x.amount),
                "donation_date": x.donation_date, "purpose": x.purpose, "payment_method": x.payment_method, "notes": x.notes}

    # ---------- sponsorships ----------
    def list_sponsorships(self, tenant_id, status=None) -> list[dict]:
        donors = self._donor_names(tenant_id)
        students = {p.id: u.full_name for p, u in self.students.list_with_users(tenant_id)}
        return [
            {"id": s.id, "donor_id": s.donor_id, "donor_name": donors.get(s.donor_id), "student_id": s.student_id,
             "student_name": students.get(s.student_id), "monthly_amount": float(s.monthly_amount),
             "start_date": s.start_date, "status": s.status, "notes": s.notes}
            for s in self.sponsorships.list_all(tenant_id, status)
        ]

    def create_sponsorship(self, tenant_id, payload: SponsorshipCreate) -> dict:
        if self.donors.get_by_id(tenant_id, payload.donor_id) is None:
            raise NotFoundError("Donor not found")
        if self.students.get_with_user(tenant_id, payload.student_id) is None:
            raise NotFoundError("Student not found")
        data = payload.model_dump()
        data["start_date"] = data.get("start_date") or date.today()
        s = self.sponsorships.create(Sponsorship(tenant_id=tenant_id, **data))
        self.db.commit()
        return self._sponsorship_out(tenant_id, s)

    def update_sponsorship(self, tenant_id, sponsorship_id, payload: SponsorshipUpdate) -> dict:
        s = self.sponsorships.get_by_id(tenant_id, sponsorship_id)
        if s is None:
            raise NotFoundError("Sponsorship not found")
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(s, field, value)
        self.db.commit()
        return self._sponsorship_out(tenant_id, s)

    def _sponsorship_out(self, tenant_id, s: Sponsorship) -> dict:
        donors = self._donor_names(tenant_id)
        found = self.students.get_with_user(tenant_id, s.student_id)
        return {"id": s.id, "donor_id": s.donor_id, "donor_name": donors.get(s.donor_id), "student_id": s.student_id,
                "student_name": found[1].full_name if found else None, "monthly_amount": float(s.monthly_amount),
                "start_date": s.start_date, "status": s.status, "notes": s.notes}
