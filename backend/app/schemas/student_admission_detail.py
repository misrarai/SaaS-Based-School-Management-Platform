import uuid

from pydantic import BaseModel


class StudentAdmissionDetailIn(BaseModel):
    discount_amount: float | None = None
    photo_url: str | None = None

    referred_by_family_id: uuid.UUID | None = None
    referral_discount_amount: float | None = None
    referral_note: str | None = None

    father_name: str | None = None
    father_cnic: str | None = None
    father_mobile: str | None = None
    father_qualification: str | None = None
    father_occupation: str | None = None
    guardian_mobile: str | None = None
    whatsapp_number: str | None = None
    category: str | None = None
    student_cnic: str | None = None
    caste: str | None = None
    gender: str | None = None
    current_address: str | None = None

    mother_name: str | None = None
    mother_cnic: str | None = None
    mother_mobile: str | None = None
    mother_qualification: str | None = None

    guardian_relation: str | None = None

    emergency_relation: str | None = None
    emergency_contact_name: str | None = None
    emergency_phone: str | None = None
    emergency_mobile: str | None = None
    emergency_address: str | None = None

    utm_source: str | None = None
    admission_form_number: str | None = None
    register_serial_no: str | None = None
    previous_class: str | None = None
    previous_school: str | None = None
    region: str | None = None
    blood_group: str | None = None
    student_mobile: str | None = None
    birth_place: str | None = None
    religion: str | None = None
    nationality: str | None = None


class StudentAdmissionDetailOut(StudentAdmissionDetailIn):
    model_config = {"from_attributes": True}
