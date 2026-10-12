import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import DomainError, NotFoundError
from app.models.promotion import PromotionRule
from app.repositories.academic_repo import ClassGradeRepository, SectionRepository
from app.repositories.promotion_repo import PromotionRuleRepository
from app.repositories.student_repo import StudentProfileRepository
from app.schemas.promotion import PromotionExecute, PromotionRuleCreate, PromotionRuleUpdate


class PromotionService:
    def __init__(self, db: Session):
        self.db = db
        self.rules = PromotionRuleRepository(db)
        self.classes = ClassGradeRepository(db)
        self.sections = SectionRepository(db)
        self.students = StudentProfileRepository(db)

    def _class_names(self, tenant_id: uuid.UUID) -> dict[uuid.UUID, str]:
        return {c.id: c.name for c in self.classes.list(tenant_id)}

    def _rule_out(self, rule: PromotionRule, names: dict) -> dict:
        return {
            "id": rule.id,
            "source_class_id": rule.source_class_id,
            "source_class_name": names.get(rule.source_class_id),
            "target_class_id": rule.target_class_id,
            "target_class_name": names.get(rule.target_class_id) if rule.target_class_id else None,
            "pass_mark": rule.pass_mark,
            "on_fail": rule.on_fail,
            "is_active": rule.is_active,
        }

    def list_rules(self, tenant_id: uuid.UUID) -> list[dict]:
        names = self._class_names(tenant_id)
        return [self._rule_out(r, names) for r in self.rules.list_all(tenant_id)]

    def _validate_class(self, tenant_id: uuid.UUID, class_id: uuid.UUID) -> None:
        if self.classes.get_by_id(tenant_id, class_id) is None:
            raise NotFoundError("Class not found")

    def create_rule(self, tenant_id: uuid.UUID, payload: PromotionRuleCreate) -> dict:
        self._validate_class(tenant_id, payload.source_class_id)
        if payload.target_class_id:
            self._validate_class(tenant_id, payload.target_class_id)
        rule = self.rules.create(PromotionRule(tenant_id=tenant_id, **payload.model_dump()))
        self.db.commit()
        return self._rule_out(rule, self._class_names(tenant_id))

    def update_rule(self, tenant_id: uuid.UUID, rule_id: uuid.UUID, payload: PromotionRuleUpdate) -> dict:
        rule = self.rules.get_by_id(tenant_id, rule_id)
        if rule is None:
            raise NotFoundError("Promotion rule not found")
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(rule, field, value)
        self.db.commit()
        return self._rule_out(rule, self._class_names(tenant_id))

    def delete_rule(self, tenant_id: uuid.UUID, rule_id: uuid.UUID) -> None:
        rule = self.rules.get_by_id(tenant_id, rule_id)
        if rule is None:
            raise NotFoundError("Promotion rule not found")
        self.db.delete(rule)
        self.db.commit()

    def candidates(self, tenant_id: uuid.UUID, source_class_id: uuid.UUID) -> list[dict]:
        self._validate_class(tenant_id, source_class_id)
        sections = {s.id: s.name for s in self.sections.list_by_class(tenant_id, source_class_id)}
        rows = self.students.list_with_users(tenant_id, class_grade_id=source_class_id, status="active")
        rows.sort(key=lambda pu: ((pu[0].roll_number or "").zfill(10), pu[1].full_name))
        return [
            {
                "student_id": p.id, "full_name": u.full_name, "admission_number": p.admission_number,
                "roll_number": p.roll_number, "section_name": sections.get(p.section_id),
            }
            for p, u in rows
        ]

    def execute(self, tenant_id: uuid.UUID, payload: PromotionExecute) -> dict:
        self._validate_class(tenant_id, payload.source_class_id)
        if payload.target_class_id:
            self._validate_class(tenant_id, payload.target_class_id)
            if payload.target_class_id == payload.source_class_id:
                raise DomainError("Target class must differ from the source class.")
        promoted = graduated = 0
        for student_id in payload.student_ids:
            found = self.students.get_with_user(tenant_id, student_id)
            if found is None:
                continue
            profile, _ = found
            if profile.class_grade_id != payload.source_class_id:
                continue  # only students actually in the source class
            if payload.target_class_id:
                profile.class_grade_id = payload.target_class_id
                profile.section_id = None
                promoted += 1
            else:
                profile.status = "withdrawn"  # graduated out of the school
                graduated += 1
        self.db.commit()
        return {"promoted": promoted, "graduated": graduated}
