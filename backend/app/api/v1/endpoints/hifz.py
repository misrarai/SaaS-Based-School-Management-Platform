import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.hifz import (
    DailyRecordCreate,
    DailyRecordOut,
    DonationCreate,
    DonationOut,
    DonorCreate,
    DonorOut,
    DonorUpdate,
    EnrolmentCreate,
    EnrolmentOut,
    EnrolmentUpdate,
    HalqaCreate,
    HalqaOut,
    HalqaUpdate,
    SponsorshipCreate,
    SponsorshipOut,
    SponsorshipUpdate,
)
from app.services.hifz_service import HifzService

router = APIRouter(prefix="/hifz", tags=["hifz"])
admin_only = require_role(RoleEnum.ADMIN)


@router.get("/halqas", response_model=list[HalqaOut])
def list_halqas(current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HifzService(db).list_halqas(current_user.tenant_id)


@router.post("/halqas", response_model=HalqaOut, status_code=status.HTTP_201_CREATED)
def create_halqa(payload: HalqaCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HifzService(db).create_halqa(current_user.tenant_id, payload)


@router.patch("/halqas/{halqa_id}", response_model=HalqaOut)
def update_halqa(halqa_id: uuid.UUID, payload: HalqaUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HifzService(db).update_halqa(current_user.tenant_id, halqa_id, payload)


@router.get("/enrolments", response_model=list[EnrolmentOut])
def list_enrolments(
    halqa_id: uuid.UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return HifzService(db).list_enrolments(current_user.tenant_id, halqa_id, status_filter)


@router.post("/enrolments", response_model=EnrolmentOut, status_code=status.HTTP_201_CREATED)
def create_enrolment(payload: EnrolmentCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HifzService(db).create_enrolment(current_user.tenant_id, payload)


@router.patch("/enrolments/{enrolment_id}", response_model=EnrolmentOut)
def update_enrolment(enrolment_id: uuid.UUID, payload: EnrolmentUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HifzService(db).update_enrolment(current_user.tenant_id, enrolment_id, payload)


@router.get("/enrolments/{enrolment_id}/records", response_model=list[DailyRecordOut])
def list_records(enrolment_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HifzService(db).list_records(current_user.tenant_id, enrolment_id)


@router.post("/enrolments/{enrolment_id}/records", response_model=DailyRecordOut, status_code=status.HTTP_201_CREATED)
def add_record(enrolment_id: uuid.UUID, payload: DailyRecordCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HifzService(db).add_record(current_user.tenant_id, enrolment_id, payload)


# ---------- Donors ----------


@router.get("/donors", response_model=list[DonorOut])
def list_donors(current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HifzService(db).list_donors(current_user.tenant_id)


@router.post("/donors", response_model=DonorOut, status_code=status.HTTP_201_CREATED)
def create_donor(payload: DonorCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HifzService(db).create_donor(current_user.tenant_id, payload)


@router.patch("/donors/{donor_id}", response_model=DonorOut)
def update_donor(donor_id: uuid.UUID, payload: DonorUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HifzService(db).update_donor(current_user.tenant_id, donor_id, payload)


# ---------- Donations ----------


@router.get("/donations", response_model=list[DonationOut])
def list_donations(donor_id: uuid.UUID | None = Query(default=None), current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HifzService(db).list_donations(current_user.tenant_id, donor_id)


@router.post("/donations", response_model=DonationOut, status_code=status.HTTP_201_CREATED)
def create_donation(payload: DonationCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HifzService(db).create_donation(current_user.tenant_id, payload)


# ---------- Sponsorships ----------


@router.get("/sponsorships", response_model=list[SponsorshipOut])
def list_sponsorships(status_filter: str | None = Query(default=None, alias="status"), current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HifzService(db).list_sponsorships(current_user.tenant_id, status_filter)


@router.post("/sponsorships", response_model=SponsorshipOut, status_code=status.HTTP_201_CREATED)
def create_sponsorship(payload: SponsorshipCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HifzService(db).create_sponsorship(current_user.tenant_id, payload)


@router.patch("/sponsorships/{sponsorship_id}", response_model=SponsorshipOut)
def update_sponsorship(sponsorship_id: uuid.UUID, payload: SponsorshipUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HifzService(db).update_sponsorship(current_user.tenant_id, sponsorship_id, payload)
