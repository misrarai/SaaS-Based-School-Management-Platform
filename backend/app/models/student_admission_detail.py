import uuid

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class StudentAdmissionDetail(UUIDPKMixin, TimestampMixin, Base):
    """Extended admission-form data for a student, kept separate from StudentProfile
    (which holds core academic/status fields) so that profile stays lean while the
    full admission form (father/mother/guardian/emergency/other info) has a home."""

    __tablename__ = "student_admission_details"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("student_profiles.id"), nullable=False, unique=True, index=True
    )

    # Academic data
    discount_amount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Referral (folds into the fee module's discount snapshot at invoice time)
    referred_by_family_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("families.id"), nullable=True
    )
    referral_discount_amount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    referral_note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Student & father information
    father_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    father_cnic: Mapped[str | None] = mapped_column(String(30), nullable=True)
    father_mobile: Mapped[str | None] = mapped_column(String(30), nullable=True)
    father_qualification: Mapped[str | None] = mapped_column(String(255), nullable=True)
    father_occupation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    guardian_mobile: Mapped[str | None] = mapped_column(String(30), nullable=True)
    whatsapp_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    student_cnic: Mapped[str | None] = mapped_column(String(30), nullable=True)
    caste: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    current_address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Mother information
    mother_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mother_cnic: Mapped[str | None] = mapped_column(String(30), nullable=True)
    mother_mobile: Mapped[str | None] = mapped_column(String(30), nullable=True)
    mother_qualification: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Guardian information
    guardian_relation: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Emergency contact information
    emergency_relation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    emergency_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    emergency_mobile: Mapped[str | None] = mapped_column(String(30), nullable=True)
    emergency_address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Other information
    utm_source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    admission_form_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    register_serial_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    previous_class: Mapped[str | None] = mapped_column(String(100), nullable=True)
    previous_school: Mapped[str | None] = mapped_column(String(255), nullable=True)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    blood_group: Mapped[str | None] = mapped_column(String(10), nullable=True)
    student_mobile: Mapped[str | None] = mapped_column(String(30), nullable=True)
    birth_place: Mapped[str | None] = mapped_column(String(255), nullable=True)
    religion: Mapped[str | None] = mapped_column(String(100), nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(100), nullable=True)
