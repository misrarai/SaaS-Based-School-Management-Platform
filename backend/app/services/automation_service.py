"""The automation engine. `fire(tenant_id, event, ctx)` is called from domain code (attendance
marked, payment verified, result published); it finds the admin's active rules for that event,
renders their message template with the event's tokens, and dispatches through the existing
SMS / email / WhatsApp services — logging an AutomationRun for each rule. Every call is wrapped so
a misconfigured rule can never break the business action that triggered it."""

import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.automation import AutomationRule, AutomationRun
from app.repositories.automation_repo import AutomationRuleRepository, AutomationRunRepository
from app.repositories.parent_repo import ParentProfileRepository, ParentStudentLinkRepository
from app.repositories.user_repo import UserRepository
from app.schemas.automation import AutomationRuleCreate, AutomationRuleUpdate
from app.services.email_service import EmailService
from app.services.sms_service import SmsService
from app.services.whatsapp_service import WhatsAppService

SAMPLE_CTX = {
    "student_name": "Ali Khan",
    "class": "Grade 5",
    "date": "2026-10-12",
    "amount": "5000",
    "due_date": "2026-10-20",
    "invoice": "INV-0001",
    "exam": "Mid Term 2026",
}


def render_template(template: str, ctx: dict) -> str:
    out = template
    for key, value in ctx.items():
        out = out.replace("{" + key + "}", str(value))
    return out


class AutomationService:
    def __init__(self, db: Session):
        self.db = db
        self.rules = AutomationRuleRepository(db)
        self.runs = AutomationRunRepository(db)
        self.parent_links = ParentStudentLinkRepository(db)
        self.parent_profiles = ParentProfileRepository(db)
        self.users = UserRepository(db)
        self.sms = SmsService()
        self.email = EmailService()
        self.whatsapp = WhatsAppService()

    # ---------- recipients ----------
    def _parent_contacts(self, tenant_id: uuid.UUID, student_id: uuid.UUID, channel: str) -> list[str]:
        contacts: list[str] = []
        for parent_id in self.parent_links.list_parent_ids_for_student(tenant_id, student_id):
            profile = self.parent_profiles.get_by_id(tenant_id, parent_id)
            if profile is None:
                continue
            if channel in ("sms", "whatsapp") and not profile.whatsapp_opt_in:
                continue
            user = self.users.get_by_id(tenant_id, profile.user_id)
            if user is None:
                continue
            value = user.phone_number if channel in ("sms", "whatsapp") else user.email
            if value:
                contacts.append(value)
        return contacts

    def _reachable_parent_count(self, tenant_id: uuid.UUID, channel: str) -> int:
        count = 0
        for profile in self.parent_profiles.list(tenant_id):
            if channel in ("sms", "whatsapp") and not profile.whatsapp_opt_in:
                continue
            user = self.users.get_by_id(tenant_id, profile.user_id)
            if user is None:
                continue
            if (user.phone_number if channel in ("sms", "whatsapp") else user.email):
                count += 1
        return count

    # ---------- dispatch ----------
    def _dispatch(self, channel: str, target: str, subject: str | None, message: str, student_name: str) -> str:
        """Returns 'sent' | 'failed' | 'skipped'."""
        try:
            if channel == "sms":
                return self.sms.send(target, message).status
            if channel == "email":
                if not self.email.is_configured():
                    return "skipped"
                return "sent" if self.email.send(target, subject or "Notification", message) else "failed"
            if channel == "whatsapp":
                if not self.whatsapp.is_configured():
                    return "skipped"
                res = self.whatsapp.send_template(target, body_params=[student_name, subject or "", message])
                return "sent" if res.success else "failed"
        except Exception:
            return "failed"
        return "skipped"

    def _execute(self, tenant_id: uuid.UUID, rule: AutomationRule, ctx: dict, record: bool = True) -> dict:
        message = render_template(rule.message_template, ctx)
        student_id = ctx.get("student_id")
        contacts = self._parent_contacts(tenant_id, student_id, rule.channel) if student_id else []
        counts = {"sent": 0, "failed": 0, "skipped": 0}
        for target in contacts:
            counts[self._dispatch(rule.channel, target, rule.subject, message, ctx.get("student_name", ""))] += 1
        detail = f"{rule.channel} · {len(contacts)} recipient(s)"
        if record:
            self.runs.create(
                AutomationRun(
                    tenant_id=tenant_id, rule_id=rule.id, event=rule.event, recipients=len(contacts),
                    sent=counts["sent"], failed=counts["failed"], skipped=counts["skipped"], detail=detail,
                )
            )
            self.db.commit()
        return {"recipients": len(contacts), **counts, "detail": detail, "preview": message}

    # ---------- public: fire from domain code ----------
    def fire(self, tenant_id: uuid.UUID, event: str, ctx: dict) -> None:
        try:
            for rule in self.rules.list_active_for_event(tenant_id, event):
                self._execute(tenant_id, rule, ctx, record=True)
        except Exception:
            self.db.rollback()  # never let automation break the triggering action

    # ---------- CRUD ----------
    def list_rules(self, tenant_id: uuid.UUID, event: str | None = None) -> list[AutomationRule]:
        return self.rules.list_all(tenant_id, event)

    def _get(self, tenant_id: uuid.UUID, rule_id: uuid.UUID) -> AutomationRule:
        rule = self.rules.get_by_id(tenant_id, rule_id)
        if rule is None:
            raise NotFoundError("Automation rule not found")
        return rule

    def create_rule(self, tenant_id: uuid.UUID, user_id: uuid.UUID | None, payload: AutomationRuleCreate) -> AutomationRule:
        rule = AutomationRule(tenant_id=tenant_id, created_by_user_id=user_id, **payload.model_dump())
        self.rules.create(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def update_rule(self, tenant_id: uuid.UUID, rule_id: uuid.UUID, payload: AutomationRuleUpdate) -> AutomationRule:
        rule = self._get(tenant_id, rule_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(rule, field, value)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def delete_rule(self, tenant_id: uuid.UUID, rule_id: uuid.UUID) -> None:
        self.db.delete(self._get(tenant_id, rule_id))
        self.db.commit()

    def list_runs(self, tenant_id: uuid.UUID) -> list[AutomationRun]:
        return self.runs.list_recent(tenant_id)

    def test_rule(self, tenant_id: uuid.UUID, rule_id: uuid.UUID) -> dict:
        rule = self._get(tenant_id, rule_id)
        preview = render_template(rule.message_template, SAMPLE_CTX)
        reach = self._reachable_parent_count(tenant_id, rule.channel)
        gated = (rule.channel == "sms" and not self.sms.is_configured()) or (
            rule.channel == "email" and not self.email.is_configured()
        ) or (rule.channel == "whatsapp" and not self.whatsapp.is_configured())
        detail = (
            f"{rule.channel} gateway not configured — messages would be skipped." if gated
            else f"{rule.channel} gateway ready."
        ) + f" {reach} parent(s) reachable on this channel."
        return {"recipients": reach, "sent": 0, "failed": 0, "skipped": reach if gated else 0, "detail": detail, "preview": preview}
