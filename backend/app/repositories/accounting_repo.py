import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.accounting import (
    Account,
    AccountingSourceLink,
    FinancialPeriod,
    Voucher,
    VoucherLine,
    VoucherStatus,
    VoucherType,
)
from app.repositories.base import BaseRepository


class AccountRepository(BaseRepository[Account]):
    model = Account

    def list_ordered(self, tenant_id: uuid.UUID, active_only: bool = False) -> list[Account]:
        stmt = select(Account).where(Account.tenant_id == tenant_id)
        if active_only:
            stmt = stmt.where(Account.is_active.is_(True))
        return list(self.db.execute(stmt.order_by(Account.code)).scalars().all())

    def get_by_code(self, tenant_id: uuid.UUID, code: str) -> Account | None:
        stmt = select(Account).where(Account.tenant_id == tenant_id, Account.code == code)
        return self.db.execute(stmt).scalar_one_or_none()

    def has_children(self, tenant_id: uuid.UUID, account_id: uuid.UUID) -> bool:
        stmt = select(func.count(Account.id)).where(Account.tenant_id == tenant_id, Account.parent_id == account_id)
        return (self.db.execute(stmt).scalar() or 0) > 0

    def has_lines(self, tenant_id: uuid.UUID, account_id: uuid.UUID) -> bool:
        stmt = select(func.count(VoucherLine.id)).where(
            VoucherLine.tenant_id == tenant_id, VoucherLine.account_id == account_id
        )
        return (self.db.execute(stmt).scalar() or 0) > 0


class VoucherRepository(BaseRepository[Voucher]):
    model = Voucher

    def get_with_lines(self, tenant_id: uuid.UUID, voucher_id: uuid.UUID) -> Voucher | None:
        stmt = (
            select(Voucher)
            .options(selectinload(Voucher.lines))
            .where(Voucher.tenant_id == tenant_id, Voucher.id == voucher_id)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def search(
        self,
        tenant_id: uuid.UUID,
        voucher_type: VoucherType | None = None,
        status: VoucherStatus | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        source: str | None = None,
        query: str | None = None,
    ) -> list[Voucher]:
        stmt = select(Voucher).options(selectinload(Voucher.lines)).where(Voucher.tenant_id == tenant_id)
        if voucher_type:
            stmt = stmt.where(Voucher.voucher_type == voucher_type)
        if status:
            stmt = stmt.where(Voucher.status == status)
        if date_from:
            stmt = stmt.where(Voucher.voucher_date >= date_from)
        if date_to:
            stmt = stmt.where(Voucher.voucher_date <= date_to)
        if source:
            stmt = stmt.where(Voucher.source == source)
        if query:
            like = f"%{query}%"
            stmt = stmt.where(
                Voucher.voucher_number.ilike(like) | Voucher.narration.ilike(like) | Voucher.payee.ilike(like)
            )
        stmt = stmt.order_by(Voucher.voucher_date.desc(), Voucher.voucher_number.desc())
        return list(self.db.execute(stmt).scalars().all())

    def numbers_for_type(self, tenant_id: uuid.UUID, voucher_type: VoucherType) -> list[str]:
        stmt = select(Voucher.voucher_number).where(
            Voucher.tenant_id == tenant_id, Voucher.voucher_type == voucher_type
        )
        return list(self.db.execute(stmt).scalars().all())

    def posted_lines(
        self,
        tenant_id: uuid.UUID,
        date_from: date | None = None,
        date_to: date | None = None,
        account_id: uuid.UUID | None = None,
        before: date | None = None,
    ) -> list[tuple[VoucherLine, Voucher]]:
        stmt = (
            select(VoucherLine, Voucher)
            .join(Voucher, Voucher.id == VoucherLine.voucher_id)
            .where(Voucher.tenant_id == tenant_id, Voucher.status == VoucherStatus.POSTED)
        )
        if account_id:
            stmt = stmt.where(VoucherLine.account_id == account_id)
        if date_from:
            stmt = stmt.where(Voucher.voucher_date >= date_from)
        if date_to:
            stmt = stmt.where(Voucher.voucher_date <= date_to)
        if before:
            stmt = stmt.where(Voucher.voucher_date < before)
        stmt = stmt.order_by(Voucher.voucher_date, Voucher.voucher_number, VoucherLine.line_no)
        return [(row[0], row[1]) for row in self.db.execute(stmt).all()]


class PeriodRepository(BaseRepository[FinancialPeriod]):
    model = FinancialPeriod

    def get_month(self, tenant_id: uuid.UUID, year: int, month: int) -> FinancialPeriod | None:
        stmt = select(FinancialPeriod).where(
            FinancialPeriod.tenant_id == tenant_id, FinancialPeriod.year == year, FinancialPeriod.month == month
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_year(self, tenant_id: uuid.UUID, year: int) -> list[FinancialPeriod]:
        stmt = select(FinancialPeriod).where(FinancialPeriod.tenant_id == tenant_id, FinancialPeriod.year == year)
        return list(self.db.execute(stmt).scalars().all())


class SourceLinkRepository(BaseRepository[AccountingSourceLink]):
    model = AccountingSourceLink

    def linked_ids(self, tenant_id: uuid.UUID, source_type: str) -> set[uuid.UUID]:
        stmt = select(AccountingSourceLink.source_id).where(
            AccountingSourceLink.tenant_id == tenant_id, AccountingSourceLink.source_type == source_type
        )
        return set(self.db.execute(stmt).scalars().all())
