import uuid
from datetime import date

from sqlalchemy import func, or_, select

from app.models.library import (
    Book,
    BookCategory,
    BookCopy,
    BookIssue,
    BookReservation,
    LibraryMember,
    LibrarySettings,
)
from app.repositories.base import BaseRepository


class LibrarySettingsRepository(BaseRepository[LibrarySettings]):
    model = LibrarySettings

    def get_for_tenant(self, tenant_id: uuid.UUID) -> LibrarySettings | None:
        stmt = select(LibrarySettings).where(LibrarySettings.tenant_id == tenant_id)
        return self.db.execute(stmt).scalar_one_or_none()


class BookCategoryRepository(BaseRepository[BookCategory]):
    model = BookCategory

    def list_ordered(self, tenant_id: uuid.UUID) -> list[BookCategory]:
        stmt = select(BookCategory).where(BookCategory.tenant_id == tenant_id).order_by(BookCategory.name)
        return list(self.db.execute(stmt).scalars().all())

    def get_by_name(self, tenant_id: uuid.UUID, name: str) -> BookCategory | None:
        stmt = select(BookCategory).where(BookCategory.tenant_id == tenant_id, func.lower(BookCategory.name) == name.lower())
        return self.db.execute(stmt).scalar_one_or_none()


class BookRepository(BaseRepository[Book]):
    model = Book

    def search(
        self,
        tenant_id: uuid.UUID,
        query: str | None = None,
        category_id: uuid.UUID | None = None,
    ) -> list[Book]:
        stmt = select(Book).where(Book.tenant_id == tenant_id)
        if category_id:
            stmt = stmt.where(Book.category_id == category_id)
        if query:
            like = f"%{query}%"
            cat_ids = select(BookCategory.id).where(BookCategory.tenant_id == tenant_id, BookCategory.name.ilike(like))
            stmt = stmt.where(
                or_(
                    Book.title.ilike(like),
                    Book.author.ilike(like),
                    Book.isbn.ilike(like),
                    Book.subject.ilike(like),
                    Book.publisher.ilike(like),
                    Book.category_id.in_(cat_ids),
                )
            )
        return list(self.db.execute(stmt.order_by(Book.title)).scalars().all())

    def get_many(self, tenant_id: uuid.UUID, ids: set[uuid.UUID]) -> dict[uuid.UUID, Book]:
        if not ids:
            return {}
        stmt = select(Book).where(Book.tenant_id == tenant_id, Book.id.in_(ids))
        return {b.id: b for b in self.db.execute(stmt).scalars().all()}


class BookCopyRepository(BaseRepository[BookCopy]):
    model = BookCopy

    def list_for_book(self, tenant_id: uuid.UUID, book_id: uuid.UUID) -> list[BookCopy]:
        stmt = (
            select(BookCopy)
            .where(BookCopy.tenant_id == tenant_id, BookCopy.book_id == book_id)
            .order_by(BookCopy.accession_number)
        )
        return list(self.db.execute(stmt).scalars().all())

    def status_counts(self, tenant_id: uuid.UUID, book_ids: list[uuid.UUID] | None = None) -> dict[uuid.UUID, dict[str, int]]:
        stmt = (
            select(BookCopy.book_id, BookCopy.status, func.count())
            .where(BookCopy.tenant_id == tenant_id)
            .group_by(BookCopy.book_id, BookCopy.status)
        )
        if book_ids is not None:
            if not book_ids:
                return {}
            stmt = stmt.where(BookCopy.book_id.in_(book_ids))
        result: dict[uuid.UUID, dict[str, int]] = {}
        for book_id, status, count in self.db.execute(stmt).all():
            result.setdefault(book_id, {})[status] = count
        return result

    def find_by_identifier(self, tenant_id: uuid.UUID, identifier: str) -> BookCopy | None:
        stmt = select(BookCopy).where(
            BookCopy.tenant_id == tenant_id,
            or_(BookCopy.accession_number == identifier, BookCopy.barcode == identifier),
        )
        return self.db.execute(stmt).scalars().first()

    def get_by_accession(self, tenant_id: uuid.UUID, accession_number: str) -> BookCopy | None:
        stmt = select(BookCopy).where(BookCopy.tenant_id == tenant_id, BookCopy.accession_number == accession_number)
        return self.db.execute(stmt).scalar_one_or_none()

    def max_numeric_accession(self, tenant_id: uuid.UUID) -> int:
        stmt = select(BookCopy.accession_number).where(BookCopy.tenant_id == tenant_id)
        best = 0
        for (value,) in self.db.execute(stmt).all():
            if value and value.isdigit():
                best = max(best, int(value))
        return best

    def get_many(self, tenant_id: uuid.UUID, ids: set[uuid.UUID]) -> dict[uuid.UUID, BookCopy]:
        if not ids:
            return {}
        stmt = select(BookCopy).where(BookCopy.tenant_id == tenant_id, BookCopy.id.in_(ids))
        return {c.id: c for c in self.db.execute(stmt).scalars().all()}

    def count_by_status(self, tenant_id: uuid.UUID) -> dict[str, int]:
        stmt = select(BookCopy.status, func.count()).where(BookCopy.tenant_id == tenant_id).group_by(BookCopy.status)
        return {status: count for status, count in self.db.execute(stmt).all()}


class LibraryMemberRepository(BaseRepository[LibraryMember]):
    model = LibraryMember

    def find(
        self,
        tenant_id: uuid.UUID,
        *,
        student_id: uuid.UUID | None = None,
        teacher_id: uuid.UUID | None = None,
        staff_id: uuid.UUID | None = None,
    ) -> LibraryMember | None:
        stmt = select(LibraryMember).where(LibraryMember.tenant_id == tenant_id)
        if student_id:
            stmt = stmt.where(LibraryMember.student_id == student_id)
        elif teacher_id:
            stmt = stmt.where(LibraryMember.teacher_id == teacher_id)
        elif staff_id:
            stmt = stmt.where(LibraryMember.staff_id == staff_id)
        else:
            return None
        return self.db.execute(stmt).scalars().first()

    def list_filtered(self, tenant_id: uuid.UUID, member_type: str | None = None) -> list[LibraryMember]:
        stmt = select(LibraryMember).where(LibraryMember.tenant_id == tenant_id)
        if member_type and member_type != "all":
            stmt = stmt.where(LibraryMember.member_type == member_type)
        return list(self.db.execute(stmt.order_by(LibraryMember.card_number)).scalars().all())

    def get_many(self, tenant_id: uuid.UUID, ids: set[uuid.UUID]) -> dict[uuid.UUID, LibraryMember]:
        if not ids:
            return {}
        stmt = select(LibraryMember).where(LibraryMember.tenant_id == tenant_id, LibraryMember.id.in_(ids))
        return {m.id: m for m in self.db.execute(stmt).scalars().all()}

    def next_card_number(self, tenant_id: uuid.UUID) -> str:
        stmt = select(LibraryMember.card_number).where(LibraryMember.tenant_id == tenant_id)
        best = 0
        for (value,) in self.db.execute(stmt).all():
            digits = value.removeprefix("LIB-")
            if digits.isdigit():
                best = max(best, int(digits))
        return f"LIB-{best + 1:04d}"


class BookIssueRepository(BaseRepository[BookIssue]):
    model = BookIssue

    def query(
        self,
        tenant_id: uuid.UUID,
        *,
        status: str | None = None,
        member_ids: list[uuid.UUID] | None = None,
        overdue_as_of: date | None = None,
        fine_status: str | None = None,
        paid_from: date | None = None,
        paid_to: date | None = None,
    ) -> list[BookIssue]:
        stmt = select(BookIssue).where(BookIssue.tenant_id == tenant_id)
        if status and status != "all":
            stmt = stmt.where(BookIssue.status == status)
        if member_ids is not None:
            if not member_ids:
                return []
            stmt = stmt.where(BookIssue.member_id.in_(member_ids))
        if overdue_as_of is not None:
            stmt = stmt.where(BookIssue.status == "issued", BookIssue.due_date < overdue_as_of)
        if fine_status:
            stmt = stmt.where(BookIssue.fine_status == fine_status)
        if paid_from:
            stmt = stmt.where(BookIssue.fine_paid_on >= paid_from)
        if paid_to:
            stmt = stmt.where(BookIssue.fine_paid_on <= paid_to)
        stmt = stmt.order_by(BookIssue.issued_on.desc(), BookIssue.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def active_for_copy(self, tenant_id: uuid.UUID, copy_id: uuid.UUID) -> BookIssue | None:
        stmt = select(BookIssue).where(
            BookIssue.tenant_id == tenant_id, BookIssue.copy_id == copy_id, BookIssue.status == "issued"
        )
        return self.db.execute(stmt).scalars().first()

    def active_count_for_member(self, tenant_id: uuid.UUID, member_id: uuid.UUID) -> int:
        stmt = select(func.count()).where(
            BookIssue.tenant_id == tenant_id, BookIssue.member_id == member_id, BookIssue.status == "issued"
        )
        return int(self.db.execute(stmt).scalar_one())

    def member_has_book(self, tenant_id: uuid.UUID, member_id: uuid.UUID, book_id: uuid.UUID) -> bool:
        stmt = select(func.count()).where(
            BookIssue.tenant_id == tenant_id,
            BookIssue.member_id == member_id,
            BookIssue.book_id == book_id,
            BookIssue.status == "issued",
        )
        return int(self.db.execute(stmt).scalar_one()) > 0

    def count_for_copy(self, tenant_id: uuid.UUID, copy_id: uuid.UUID) -> int:
        stmt = select(func.count()).where(BookIssue.tenant_id == tenant_id, BookIssue.copy_id == copy_id)
        return int(self.db.execute(stmt).scalar_one())

    def count_for_book(self, tenant_id: uuid.UUID, book_id: uuid.UUID) -> int:
        stmt = select(func.count()).where(BookIssue.tenant_id == tenant_id, BookIssue.book_id == book_id)
        return int(self.db.execute(stmt).scalar_one())

    def most_issued(
        self, tenant_id: uuid.UUID, limit: int, date_from: date | None = None, date_to: date | None = None
    ) -> list[tuple[uuid.UUID, int]]:
        stmt = select(BookIssue.book_id, func.count().label("n")).where(BookIssue.tenant_id == tenant_id)
        if date_from:
            stmt = stmt.where(BookIssue.issued_on >= date_from)
        if date_to:
            stmt = stmt.where(BookIssue.issued_on <= date_to)
        stmt = stmt.group_by(BookIssue.book_id).order_by(func.count().desc()).limit(limit)
        return [(book_id, int(n)) for book_id, n in self.db.execute(stmt).all()]


class BookReservationRepository(BaseRepository[BookReservation]):
    model = BookReservation

    def query(
        self,
        tenant_id: uuid.UUID,
        *,
        status: str | None = None,
        member_ids: list[uuid.UUID] | None = None,
        book_id: uuid.UUID | None = None,
    ) -> list[BookReservation]:
        stmt = select(BookReservation).where(BookReservation.tenant_id == tenant_id)
        if status == "active":
            stmt = stmt.where(BookReservation.status.in_(("pending", "ready")))
        elif status and status != "all":
            stmt = stmt.where(BookReservation.status == status)
        if member_ids is not None:
            if not member_ids:
                return []
            stmt = stmt.where(BookReservation.member_id.in_(member_ids))
        if book_id:
            stmt = stmt.where(BookReservation.book_id == book_id)
        stmt = stmt.order_by(BookReservation.reserved_at)
        return list(self.db.execute(stmt).scalars().all())

    def oldest_pending(self, tenant_id: uuid.UUID, book_id: uuid.UUID) -> BookReservation | None:
        stmt = (
            select(BookReservation)
            .where(
                BookReservation.tenant_id == tenant_id,
                BookReservation.book_id == book_id,
                BookReservation.status == "pending",
            )
            .order_by(BookReservation.reserved_at)
        )
        return self.db.execute(stmt).scalars().first()

    def active_for_member_book(
        self, tenant_id: uuid.UUID, member_id: uuid.UUID, book_id: uuid.UUID
    ) -> BookReservation | None:
        stmt = select(BookReservation).where(
            BookReservation.tenant_id == tenant_id,
            BookReservation.member_id == member_id,
            BookReservation.book_id == book_id,
            BookReservation.status.in_(("pending", "ready")),
        )
        return self.db.execute(stmt).scalars().first()

    def ready_for_copy(self, tenant_id: uuid.UUID, copy_id: uuid.UUID) -> BookReservation | None:
        stmt = select(BookReservation).where(
            BookReservation.tenant_id == tenant_id,
            BookReservation.copy_id == copy_id,
            BookReservation.status == "ready",
        )
        return self.db.execute(stmt).scalars().first()

    def stale_ready(self, tenant_id: uuid.UUID, today: date) -> list[BookReservation]:
        stmt = select(BookReservation).where(
            BookReservation.tenant_id == tenant_id,
            BookReservation.status == "ready",
            BookReservation.expires_on < today,
        )
        return list(self.db.execute(stmt).scalars().all())
