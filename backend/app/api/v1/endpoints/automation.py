import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.automation import (
    AutomationRuleCreate,
    AutomationRuleOut,
    AutomationRuleUpdate,
    AutomationRunOut,
    AutomationTestResult,
)
from app.services.automation_service import AutomationService

router = APIRouter(prefix="/automation", tags=["automation"])
admin_only = require_role(RoleEnum.ADMIN)


@router.get("/rules", response_model=list[AutomationRuleOut])
def list_rules(
    event: str | None = Query(default=None),
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return AutomationService(db).list_rules(current_user.tenant_id, event)


@router.post("/rules", response_model=AutomationRuleOut, status_code=status.HTTP_201_CREATED)
def create_rule(payload: AutomationRuleCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return AutomationService(db).create_rule(current_user.tenant_id, current_user.id, payload)


@router.patch("/rules/{rule_id}", response_model=AutomationRuleOut)
def update_rule(
    rule_id: uuid.UUID, payload: AutomationRuleUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return AutomationService(db).update_rule(current_user.tenant_id, rule_id, payload)


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(rule_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    AutomationService(db).delete_rule(current_user.tenant_id, rule_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/rules/{rule_id}/test", response_model=AutomationTestResult)
def test_rule(rule_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return AutomationService(db).test_rule(current_user.tenant_id, rule_id)


@router.get("/runs", response_model=list[AutomationRunOut])
def list_runs(current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return AutomationService(db).list_runs(current_user.tenant_id)
