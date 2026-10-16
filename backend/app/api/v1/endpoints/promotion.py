import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.promotion import (
    PromotionCandidate,
    PromotionExecute,
    PromotionResult,
    PromotionRuleCreate,
    PromotionRuleOut,
    PromotionRuleUpdate,
)
from app.services.promotion_service import PromotionService

router = APIRouter(prefix="/promotion", tags=["promotion"])
admin_only = require_role(RoleEnum.ADMIN)


@router.get("/rules", response_model=list[PromotionRuleOut])
def list_rules(current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return PromotionService(db).list_rules(current_user.tenant_id)


@router.post("/rules", response_model=PromotionRuleOut, status_code=status.HTTP_201_CREATED)
def create_rule(payload: PromotionRuleCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return PromotionService(db).create_rule(current_user.tenant_id, payload)


@router.patch("/rules/{rule_id}", response_model=PromotionRuleOut)
def update_rule(rule_id: uuid.UUID, payload: PromotionRuleUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return PromotionService(db).update_rule(current_user.tenant_id, rule_id, payload)


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(rule_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    PromotionService(db).delete_rule(current_user.tenant_id, rule_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/candidates", response_model=list[PromotionCandidate])
def candidates(source_class_id: uuid.UUID = Query(...), current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return PromotionService(db).candidates(current_user.tenant_id, source_class_id)


@router.post("/execute", response_model=PromotionResult)
def execute(payload: PromotionExecute, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return PromotionService(db).execute(current_user.tenant_id, payload)
