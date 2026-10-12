import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.models.hifz import Halqa, HifzDailyRecord, HifzEnrolment
from app.repositories.base import BaseRepository


class HalqaRepository(BaseRepository[Halqa]):
    model = Halqa

    def list_all(self, tenant_id: uuid.UUID) -> list[Halqa]:
        stmt = select(Halqa).where(Halqa.tenant_id == tenant_id).order_by(Halqa.name)
        return list(self.db.execute(stmt).scalars().all())

    def student_counts(self, tenant_id: uuid.UUID) -> dict[uuid.UUID, int]:
        stmt = (
            select(HifzEnrolment.halqa_id, func.count(HifzEnrolment.id))
            .where(HifzEnrolment.tenant_id == tenant_id, HifzEnrolment.status == "active")
            .group_by(HifzEnrolment.halqa_id)
        )
        return {row[0]: row[1] for row in self.db.execute(stmt).all()}


class EnrolmentRepository(BaseRepository[HifzEnrolment]):
    model = HifzEnrolment

    def search(self, tenant_id: uuid.UUID, halqa_id: uuid.UUID | None = None, status: str | None = None) -> list[HifzEnrolment]:
        stmt = select(HifzEnrolment).where(HifzEnrolment.tenant_id == tenant_id)
        if halqa_id:
            stmt = stmt.where(HifzEnrolment.halqa_id == halqa_id)
        if status and status != "all":
            stmt = stmt.where(HifzEnrolment.status == status)
        return list(self.db.execute(stmt.order_by(HifzEnrolment.start_date.desc())).scalars().all())

    def get_with_records(self, tenant_id: uuid.UUID, enrolment_id: uuid.UUID) -> HifzEnrolment | None:
        stmt = (
            select(HifzEnrolment)
            .where(HifzEnrolment.tenant_id == tenant_id, HifzEnrolment.id == enrolment_id)
            .options(selectinload(HifzEnrolment.records))
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def exists_for_student(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> bool:
        stmt = select(HifzEnrolment.id).where(
            HifzEnrolment.tenant_id == tenant_id,
            HifzEnrolment.student_id == student_id,
            HifzEnrolment.status == "active",
        )
        return self.db.execute(stmt).first() is not None

    def record_counts(self, tenant_id: uuid.UUID) -> dict[uuid.UUID, int]:
        stmt = (
            select(HifzDailyRecord.enrolment_id, func.count(HifzDailyRecord.id))
            .where(HifzDailyRecord.tenant_id == tenant_id)
            .group_by(HifzDailyRecord.enrolment_id)
        )
        return {row[0]: row[1] for row in self.db.execute(stmt).all()}


class DailyRecordRepository(BaseRepository[HifzDailyRecord]):
    model = HifzDailyRecord

    def list_for_enrolment(self, tenant_id: uuid.UUID, enrolment_id: uuid.UUID) -> list[HifzDailyRecord]:
        stmt = (
            select(HifzDailyRecord)
            .where(HifzDailyRecord.tenant_id == tenant_id, HifzDailyRecord.enrolment_id == enrolment_id)
            .order_by(HifzDailyRecord.record_date.desc())
        )
        return list(self.db.execute(stmt).scalars().all())


from app.models.hifz import Donation, Donor, Sponsorship  # noqa: E402


class DonorRepository(BaseRepository[Donor]):
    model = Donor

    def list_all(self, tenant_id: uuid.UUID) -> list[Donor]:
        return list(self.db.execute(select(Donor).where(Donor.tenant_id == tenant_id).order_by(Donor.name)).scalars().all())

    def totals(self, tenant_id: uuid.UUID) -> dict[uuid.UUID, float]:
        stmt = select(Donation.donor_id, func.coalesce(func.sum(Donation.amount), 0)).where(Donation.tenant_id == tenant_id).group_by(Donation.donor_id)
        return {row[0]: float(row[1]) for row in self.db.execute(stmt).all()}

    def active_sponsorship_counts(self, tenant_id: uuid.UUID) -> dict[uuid.UUID, int]:
        stmt = select(Sponsorship.donor_id, func.count(Sponsorship.id)).where(Sponsorship.tenant_id == tenant_id, Sponsorship.status == "active").group_by(Sponsorship.donor_id)
        return {row[0]: row[1] for row in self.db.execute(stmt).all()}


class DonationRepository(BaseRepository[Donation]):
    model = Donation

    def list_all(self, tenant_id: uuid.UUID, donor_id: uuid.UUID | None = None) -> list[Donation]:
        stmt = select(Donation).where(Donation.tenant_id == tenant_id)
        if donor_id:
            stmt = stmt.where(Donation.donor_id == donor_id)
        return list(self.db.execute(stmt.order_by(Donation.donation_date.desc())).scalars().all())


class SponsorshipRepository(BaseRepository[Sponsorship]):
    model = Sponsorship

    def list_all(self, tenant_id: uuid.UUID, status: str | None = None) -> list[Sponsorship]:
        stmt = select(Sponsorship).where(Sponsorship.tenant_id == tenant_id)
        if status and status != "all":
            stmt = stmt.where(Sponsorship.status == status)
        return list(self.db.execute(stmt.order_by(Sponsorship.start_date.desc())).scalars().all())
