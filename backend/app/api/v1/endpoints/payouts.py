import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.repositories.teacher_repo import TeacherProfileRepository
from app.schemas.payout import (
    BulkGeneratePayoutsRequest,
    GeneratePayoutRequest,
    PayoutOut,
    PayoutRateCreate,
    PayoutRateOut,
)
from app.services.payout_service import PayoutService

router = APIRouter(prefix="/payouts", tags=["payouts"])


@router.post("/rates", response_model=PayoutRateOut, status_code=status.HTTP_201_CREATED)
def create_rate(
    payload: PayoutRateCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> PayoutRateOut:
    return PayoutService(db).set_rate(current_user.tenant_id, payload)


@router.get("/rates", response_model=list[PayoutRateOut])
def list_rates(
    teacher_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[PayoutRateOut]:
    return PayoutService(db).list_rates(current_user.tenant_id, teacher_id=teacher_id)


@router.post("/generate", response_model=PayoutOut, status_code=status.HTTP_201_CREATED)
def generate_payout(
    payload: GeneratePayoutRequest,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> PayoutOut:
    return PayoutService(db).generate_payout(
        current_user.tenant_id, payload.teacher_id, payload.period_month, payload.period_year
    )


@router.post("/generate-all", response_model=list[PayoutOut], status_code=status.HTTP_201_CREATED)
def bulk_generate_payouts(
    payload: BulkGeneratePayoutsRequest,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[PayoutOut]:
    return PayoutService(db).bulk_generate_payouts(current_user.tenant_id, payload.period_month, payload.period_year)


@router.get("", response_model=list[PayoutOut])
def list_payouts(
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> list[PayoutOut]:
    tenant_id = current_user.tenant_id
    if current_user.role == RoleEnum.TEACHER:
        profile = TeacherProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        if profile is None:
            return []
        return PayoutService(db).list_payouts(tenant_id, teacher_id=profile.id)
    return PayoutService(db).list_payouts(tenant_id)


@router.post("/{payout_id}/approve", response_model=PayoutOut)
def approve_payout(
    payout_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> PayoutOut:
    return PayoutService(db).mark_approved(current_user.tenant_id, payout_id, current_user.id)


@router.post("/{payout_id}/mark-paid", response_model=PayoutOut)
def mark_payout_paid(
    payout_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> PayoutOut:
    return PayoutService(db).mark_paid(current_user.tenant_id, payout_id)
