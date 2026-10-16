"""HR recruitment: job vacancies and the application pipeline (applied → shortlisted →
interview → offered → hired / rejected), with inline interview scheduling. Tenant-scoped."""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin

VACANCY_STATUSES = ("open", "closed")
APPLICATION_STAGES = ("applied", "shortlisted", "interview", "offered", "hired", "rejected")
INTERVIEW_RESULTS = ("pending", "pass", "fail")


class JobVacancy(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "job_vacancies"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    department: Mapped[str | None] = mapped_column(String(150), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    positions: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    posted_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="open", nullable=False, index=True)


class JobApplication(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "job_applications"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    vacancy_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("job_vacancies.id"), nullable=False, index=True)
    candidate_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    qualification: Mapped[str | None] = mapped_column(String(255), nullable=True)
    experience_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resume_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    applied_date: Mapped[date] = mapped_column(Date, nullable=False)
    stage: Mapped[str] = mapped_column(String(20), default="applied", nullable=False, index=True)
    # inline interview
    interview_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    interviewer: Mapped[str | None] = mapped_column(String(150), nullable=True)
    interview_result: Mapped[str | None] = mapped_column(String(20), nullable=True)
    interview_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
