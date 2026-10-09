"""Library business logic: catalogue, members, circulation (issue/return/renew), fines,
reservations (holds queue) and reports. All operations are tenant-scoped."""

import io
import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, DomainError, ForbiddenError, NotFoundError
from app.models.library import (
    Book,
    BookCategory,
    BookCopy,
    BookIssue,
    BookReservation,
    LibraryMember,
    LibrarySettings,
)
from app.models.staff import Staff
from app.models.tenant import Tenant
from app.models.user import ParentProfile, ParentStudentLink, StudentProfile, TeacherProfile, User
from app.repositories.library_repo import (
    BookCategoryRepository,
    BookCopyRepository,
    BookIssueRepository,
    BookRepository,
    BookReservationRepository,
    LibraryMemberRepository,
    LibrarySettingsRepository,
)
from app.schemas.library import (
    BookCreate,
    BookUpdate,
    CategoryCreate,
    CategoryUpdate,
    CopyCreate,
    CopyUpdate,
    FineAction,
    IssueCreate,
    LibrarySettingsUpdate,
    MemberCreate,
    RenewRequest,
    ReturnRequest,
)


def _money(value) -> float:
    return round(float(value or 0), 2)


class LibraryService:
    def __init__(self, db: Session):
        self.db = db
        self.settings_repo = LibrarySettingsRepository(db)
        self.categories = BookCategoryRepository(db)
        self.books = BookRepository(db)
        self.copies = BookCopyRepository(db)
        self.members = LibraryMemberRepository(db)
        self.issues = BookIssueRepository(db)
        self.reservations = BookReservationRepository(db)

    # ------------------------------------------------------------------ settings
    def get_settings(self, tenant_id: uuid.UUID) -> LibrarySettings:
        settings = self.settings_repo.get_for_tenant(tenant_id)
        if settings is None:
            settings = self.settings_repo.create(LibrarySettings(tenant_id=tenant_id))
            self.db.commit()
            self.db.refresh(settings)
        return settings

    def update_settings(self, tenant_id: uuid.UUID, payload: LibrarySettingsUpdate) -> LibrarySettings:
        settings = self.get_settings(tenant_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            if value is not None:
                setattr(settings, field, value)
        self.db.commit()
        self.db.refresh(settings)
        return settings

    @staticmethod
    def _loan_days(settings: LibrarySettings, member_type: str) -> int:
        return {
            "student": settings.student_loan_days,
            "teacher": settings.teacher_loan_days,
            "staff": settings.staff_loan_days,
        }.get(member_type, settings.student_loan_days)

    @staticmethod
    def _max_books(settings: LibrarySettings, member_type: str) -> int:
        return {
            "student": settings.student_max_books,
            "teacher": settings.teacher_max_books,
            "staff": settings.staff_max_books,
        }.get(member_type, settings.student_max_books)

    # ---------------------------------------------------------------- categories
    def list_categories(self, tenant_id: uuid.UUID) -> list[dict]:
        cats = self.categories.list_ordered(tenant_id)
        counts: dict[uuid.UUID, int] = {}
        for book in self.books.list(tenant_id):
            if book.category_id:
                counts[book.category_id] = counts.get(book.category_id, 0) + 1
        return [
            {"id": c.id, "name": c.name, "description": c.description, "book_count": counts.get(c.id, 0)} for c in cats
        ]

    def _get_category(self, tenant_id: uuid.UUID, category_id: uuid.UUID) -> BookCategory:
        cat = self.categories.get_by_id(tenant_id, category_id)
        if cat is None:
            raise NotFoundError("Category not found")
        return cat

    def create_category(self, tenant_id: uuid.UUID, payload: CategoryCreate) -> dict:
        if self.categories.get_by_name(tenant_id, payload.name.strip()):
            raise ConflictError("A category with this name already exists")
        cat = self.categories.create(
            BookCategory(tenant_id=tenant_id, name=payload.name.strip(), description=payload.description)
        )
        self.db.commit()
        return {"id": cat.id, "name": cat.name, "description": cat.description, "book_count": 0}

    def update_category(self, tenant_id: uuid.UUID, category_id: uuid.UUID, payload: CategoryUpdate) -> dict:
        cat = self._get_category(tenant_id, category_id)
        data = payload.model_dump(exclude_unset=True)
        if data.get("name"):
            existing = self.categories.get_by_name(tenant_id, data["name"].strip())
            if existing and existing.id != cat.id:
                raise ConflictError("A category with this name already exists")
            cat.name = data["name"].strip()
        if "description" in data:
            cat.description = data["description"]
        self.db.commit()
        return next(c for c in self.list_categories(tenant_id) if c["id"] == cat.id)

    def delete_category(self, tenant_id: uuid.UUID, category_id: uuid.UUID) -> None:
        cat = self._get_category(tenant_id, category_id)
        if any(b.category_id == cat.id for b in self.books.list(tenant_id)):
            raise ConflictError("Category has books; reassign them before deleting")
        self.db.delete(cat)
        self.db.commit()

    # --------------------------------------------------------------------- books
    def _book_out(self, book: Book, counts: dict[str, int], cat_names: dict[uuid.UUID, str]) -> dict:
        return {
            "id": book.id,
            "title": book.title,
            "isbn": book.isbn,
            "author": book.author,
            "publisher": book.publisher,
            "edition": book.edition,
            "category_id": book.category_id,
            "category_name": cat_names.get(book.category_id) if book.category_id else None,
            "subject": book.subject,
            "rack_location": book.rack_location,
            "price": float(book.price) if book.price is not None else None,
            "purchase_date": book.purchase_date,
            "language": book.language,
            "description": book.description,
            "total_copies": sum(counts.values()),
            "available_copies": counts.get("available", 0),
            "issued_copies": counts.get("issued", 0),
            "reserved_copies": counts.get("reserved", 0),
            "lost_copies": counts.get("lost", 0),
            "damaged_copies": counts.get("damaged", 0),
        }

    def _cat_names(self, tenant_id: uuid.UUID) -> dict[uuid.UUID, str]:
        return {c.id: c.name for c in self.categories.list(tenant_id)}

    def search_books(
        self,
        tenant_id: uuid.UUID,
        query: str | None = None,
        category_id: uuid.UUID | None = None,
        available_only: bool = False,
    ) -> list[dict]:
        books = self.books.search(tenant_id, query, category_id)
        counts = self.copies.status_counts(tenant_id, [b.id for b in books])
        names = self._cat_names(tenant_id)
        result = [self._book_out(b, counts.get(b.id, {}), names) for b in books]
        if available_only:
            result = [b for b in result if b["available_copies"] > 0]
        return result

    def _get_book(self, tenant_id: uuid.UUID, book_id: uuid.UUID) -> Book:
        book = self.books.get_by_id(tenant_id, book_id)
        if book is None:
            raise NotFoundError("Book not found")
        return book

    def get_book_detail(self, tenant_id: uuid.UUID, book_id: uuid.UUID) -> dict:
        book = self._get_book(tenant_id, book_id)
        copies = self.copies.list_for_book(tenant_id, book_id)
        counts: dict[str, int] = {}
        for c in copies:
            counts[c.status] = counts.get(c.status, 0) + 1
        out = self._book_out(book, counts, self._cat_names(tenant_id))
        out["copies"] = copies
        return out

    def create_book(self, tenant_id: uuid.UUID, payload: BookCreate) -> dict:
        data = payload.model_dump(exclude={"copies"})
        if data.get("category_id"):
            self._get_category(tenant_id, data["category_id"])
        book = self.books.create(Book(tenant_id=tenant_id, **data))
        if payload.copies:
            self._create_copies(tenant_id, book, CopyCreate(quantity=payload.copies))
        self.db.commit()
        return self.get_book_detail(tenant_id, book.id)

    def update_book(self, tenant_id: uuid.UUID, book_id: uuid.UUID, payload: BookUpdate) -> dict:
        book = self._get_book(tenant_id, book_id)
        data = payload.model_dump(exclude_unset=True)
        if data.get("category_id"):
            self._get_category(tenant_id, data["category_id"])
        if "title" in data and not data["title"]:
            raise DomainError("Title cannot be empty")
        for field, value in data.items():
            setattr(book, field, value)
        self.db.commit()
        return self.get_book_detail(tenant_id, book_id)

    def delete_book(self, tenant_id: uuid.UUID, book_id: uuid.UUID) -> None:
        book = self._get_book(tenant_id, book_id)
        if self.issues.count_for_book(tenant_id, book_id):
            raise ConflictError("This book has circulation history and cannot be deleted; mark copies lost instead")
        for res in self.reservations.query(tenant_id, book_id=book_id):
            self.db.delete(res)
        for copy in self.copies.list_for_book(tenant_id, book_id):
            self.db.delete(copy)
        self.db.flush()
        self.db.delete(book)
        self.db.commit()

    # -------------------------------------------------------------------- copies
    def _create_copies(self, tenant_id: uuid.UUID, book: Book, payload: CopyCreate) -> list[BookCopy]:
        created: list[BookCopy] = []
        if payload.accession_number:
            if payload.quantity != 1:
                raise DomainError("Provide an accession number only when adding a single copy")
            if self.copies.get_by_accession(tenant_id, payload.accession_number.strip()):
                raise ConflictError("Accession number already in use")
            numbers = [payload.accession_number.strip()]
        else:
            start = self.copies.max_numeric_accession(tenant_id)
            numbers = [str(start + i + 1) for i in range(payload.quantity)]
        for number in numbers:
            copy = self.copies.create(
                BookCopy(
                    tenant_id=tenant_id,
                    book_id=book.id,
                    accession_number=number,
                    barcode=payload.barcode if payload.quantity == 1 else None,
                    status="available",
                    notes=payload.notes,
                )
            )
            self._release_copy(tenant_id, copy)
            created.append(copy)
        return created

    def add_copies(self, tenant_id: uuid.UUID, book_id: uuid.UUID, payload: CopyCreate) -> list[BookCopy]:
        book = self._get_book(tenant_id, book_id)
        created = self._create_copies(tenant_id, book, payload)
        self.db.commit()
        for c in created:
            self.db.refresh(c)
        return created

    def _get_copy(self, tenant_id: uuid.UUID, copy_id: uuid.UUID) -> BookCopy:
        copy = self.copies.get_by_id(tenant_id, copy_id)
        if copy is None:
            raise NotFoundError("Copy not found")
        return copy

    def update_copy(self, tenant_id: uuid.UUID, copy_id: uuid.UUID, payload: CopyUpdate) -> BookCopy:
        copy = self._get_copy(tenant_id, copy_id)
        data = payload.model_dump(exclude_unset=True)
        if data.get("accession_number") and data["accession_number"] != copy.accession_number:
            if self.copies.get_by_accession(tenant_id, data["accession_number"]):
                raise ConflictError("Accession number already in use")
            copy.accession_number = data["accession_number"]
        if "barcode" in data:
            copy.barcode = data["barcode"]
        if "notes" in data:
            copy.notes = data["notes"]
        new_status = data.get("status")
        if new_status and new_status != copy.status:
            if copy.status == "issued":
                raise ConflictError("Copy is currently issued; return it first")
            if copy.status == "reserved":
                held = self.reservations.ready_for_copy(tenant_id, copy.id)
                if held:
                    # Put the reservation back in the queue; it will pick up the next free copy.
                    held.status, held.copy_id, held.ready_on, held.expires_on = "pending", None, None, None
            if new_status == "available":
                copy.status = "available"
                self.db.flush()
                self._release_copy(tenant_id, copy)
            else:
                copy.status = new_status
        self.db.commit()
        self.db.refresh(copy)
        return copy

    def delete_copy(self, tenant_id: uuid.UUID, copy_id: uuid.UUID) -> None:
        copy = self._get_copy(tenant_id, copy_id)
        if copy.status in ("issued", "reserved"):
            raise ConflictError("Copy is issued or held for a reservation")
        if self.issues.count_for_copy(tenant_id, copy_id):
            raise ConflictError("Copy has circulation history; mark it lost or damaged instead")
        self.db.delete(copy)
        self.db.commit()

    # ------------------------------------------------------------------- members
    def _people_info(self, tenant_id: uuid.UUID, members: list[LibraryMember]) -> dict[uuid.UUID, tuple[str, str | None]]:
        """member.id -> (full_name, reference) resolved in bulk."""
        student_ids = {m.student_id for m in members if m.student_id}
        teacher_ids = {m.teacher_id for m in members if m.teacher_id}
        staff_ids = {m.staff_id for m in members if m.staff_id}
        students: dict[uuid.UUID, tuple[str, str | None]] = {}
        if student_ids:
            rows = self.db.execute(
                select(StudentProfile, User.full_name)
                .join(User, User.id == StudentProfile.user_id)
                .where(StudentProfile.tenant_id == tenant_id, StudentProfile.id.in_(student_ids))
            ).all()
            students = {p.id: (name, p.admission_number or p.roll_number) for p, name in rows}
        teachers: dict[uuid.UUID, tuple[str, str | None]] = {}
        if teacher_ids:
            rows = self.db.execute(
                select(TeacherProfile, User.full_name)
                .join(User, User.id == TeacherProfile.user_id)
                .where(TeacherProfile.tenant_id == tenant_id, TeacherProfile.id.in_(teacher_ids))
            ).all()
            teachers = {p.id: (name, p.employee_code) for p, name in rows}
        staff: dict[uuid.UUID, tuple[str, str | None]] = {}
        if staff_ids:
            rows = self.db.execute(select(Staff).where(Staff.tenant_id == tenant_id, Staff.id.in_(staff_ids))).scalars()
            staff = {s.id: (s.full_name, s.employee_code) for s in rows}
        result = {}
        for m in members:
            if m.student_id:
                result[m.id] = students.get(m.student_id, ("Unknown student", None))
            elif m.teacher_id:
                result[m.id] = teachers.get(m.teacher_id, ("Unknown teacher", None))
            else:
                result[m.id] = staff.get(m.staff_id, ("Unknown staff", None))
        return result

    def _member_out(self, tenant_id: uuid.UUID, members: list[LibraryMember], with_stats: bool = True) -> list[dict]:
        info = self._people_info(tenant_id, members)
        stats: dict[uuid.UUID, tuple[int, float]] = {}
        if with_stats and members:
            settings = self.get_settings(tenant_id)
            today = date.today()
            for issue in self.issues.query(tenant_id, member_ids=[m.id for m in members]):
                active, fine = stats.get(issue.member_id, (0, 0.0))
                if issue.status == "issued":
                    active += 1
                    fine += self._accrued_fine(issue, settings, today)
                elif issue.fine_status == "unpaid":
                    fine += _money(issue.fine_amount)
                stats[issue.member_id] = (active, fine)
        out = []
        for m in members:
            name, ref = info[m.id]
            active, fine = stats.get(m.id, (0, 0.0))
            out.append(
                {
                    "id": m.id,
                    "member_type": m.member_type,
                    "student_id": m.student_id,
                    "teacher_id": m.teacher_id,
                    "staff_id": m.staff_id,
                    "card_number": m.card_number,
                    "status": m.status,
                    "joined_on": m.joined_on,
                    "full_name": name,
                    "reference": ref,
                    "active_issues": active,
                    "outstanding_fine": round(fine, 2),
                }
            )
        return out

    def list_members(self, tenant_id: uuid.UUID, member_type: str | None = None, query: str | None = None) -> list[dict]:
        out = self._member_out(tenant_id, self.members.list_filtered(tenant_id, member_type))
        if query:
            q = query.lower()
            out = [
                m for m in out if q in m["full_name"].lower() or q in m["card_number"].lower() or q in (m["reference"] or "").lower()
            ]
        return sorted(out, key=lambda m: m["full_name"].lower())

    def _get_member(self, tenant_id: uuid.UUID, member_id: uuid.UUID) -> LibraryMember:
        member = self.members.get_by_id(tenant_id, member_id)
        if member is None:
            raise NotFoundError("Library member not found")
        return member

    def get_member(self, tenant_id: uuid.UUID, member_id: uuid.UUID) -> dict:
        return self._member_out(tenant_id, [self._get_member(tenant_id, member_id)])[0]

    def _new_member(self, tenant_id: uuid.UUID, member_type: str, **refs) -> LibraryMember:
        return self.members.create(
            LibraryMember(
                tenant_id=tenant_id,
                member_type=member_type,
                card_number=self.members.next_card_number(tenant_id),
                status="active",
                joined_on=date.today(),
                **refs,
            )
        )

    def create_member(self, tenant_id: uuid.UUID, payload: MemberCreate) -> dict:
        if payload.member_type == "student":
            ref = {"student_id": payload.student_id}
            exists = self.db.execute(
                select(StudentProfile.id).where(StudentProfile.tenant_id == tenant_id, StudentProfile.id == payload.student_id)
            ).first()
        elif payload.member_type == "teacher":
            ref = {"teacher_id": payload.teacher_id}
            exists = self.db.execute(
                select(TeacherProfile.id).where(TeacherProfile.tenant_id == tenant_id, TeacherProfile.id == payload.teacher_id)
            ).first()
        else:
            ref = {"staff_id": payload.staff_id}
            exists = self.db.execute(select(Staff.id).where(Staff.tenant_id == tenant_id, Staff.id == payload.staff_id)).first()
        if not exists:
            raise NotFoundError(f"{payload.member_type.title()} not found")
        if self.members.find(tenant_id, **ref):
            raise ConflictError("This person is already a library member")
        member = self._new_member(tenant_id, payload.member_type, **ref)
        self.db.commit()
        return self.get_member(tenant_id, member.id)

    def set_member_status(self, tenant_id: uuid.UUID, member_id: uuid.UUID, status: str) -> dict:
        member = self._get_member(tenant_id, member_id)
        member.status = status
        self.db.commit()
        return self.get_member(tenant_id, member_id)

    def member_card_pdf(self, tenant_id: uuid.UUID, member_id: uuid.UUID) -> bytes:
        member = self.get_member(tenant_id, member_id)
        tenant = self.db.get(Tenant, tenant_id)
        return _render_member_card(tenant.name if tenant else "School", member)

    # Self-service lookups ---------------------------------------------------
    def _student_profile_for_user(self, user: User) -> StudentProfile | None:
        return self.db.execute(
            select(StudentProfile).where(StudentProfile.tenant_id == user.tenant_id, StudentProfile.user_id == user.id)
        ).scalar_one_or_none()

    def _teacher_profile_for_user(self, user: User) -> TeacherProfile | None:
        return self.db.execute(
            select(TeacherProfile).where(TeacherProfile.tenant_id == user.tenant_id, TeacherProfile.user_id == user.id)
        ).scalar_one_or_none()

    def _member_for_user(self, user: User, create: bool = False) -> LibraryMember | None:
        if user.role.value == "student":
            profile = self._student_profile_for_user(user)
            if profile is None:
                return None
            member = self.members.find(user.tenant_id, student_id=profile.id)
            if member is None and create:
                member = self._new_member(user.tenant_id, "student", student_id=profile.id)
            return member
        if user.role.value == "teacher":
            profile = self._teacher_profile_for_user(user)
            if profile is None:
                return None
            member = self.members.find(user.tenant_id, teacher_id=profile.id)
            if member is None and create:
                member = self._new_member(user.tenant_id, "teacher", teacher_id=profile.id)
            return member
        return None

    # --------------------------------------------------------------- circulation
    @staticmethod
    def _accrued_fine(issue: BookIssue, settings: LibrarySettings, today: date) -> float:
        if issue.status != "issued" or today <= issue.due_date:
            return 0.0
        return round((today - issue.due_date).days * float(settings.fine_per_day), 2)

    def _issues_out(self, tenant_id: uuid.UUID, issues: list[BookIssue]) -> list[dict]:
        if not issues:
            return []
        settings = self.get_settings(tenant_id)
        today = date.today()
        books = self.books.get_many(tenant_id, {i.book_id for i in issues})
        copies = self.copies.get_many(tenant_id, {i.copy_id for i in issues})
        members = self.members.get_many(tenant_id, {i.member_id for i in issues})
        info = self._people_info(tenant_id, list(members.values()))
        out = []
        for i in issues:
            book = books.get(i.book_id)
            member = members.get(i.member_id)
            active = i.status == "issued"
            days_overdue = max(0, (today - i.due_date).days) if active else 0
            if active:
                fine_amount = self._accrued_fine(i, settings, today)
                fine_status = "accruing" if fine_amount > 0 else "none"
            else:
                fine_amount = _money(i.fine_amount)
                fine_status = i.fine_status
            out.append(
                {
                    "id": i.id,
                    "copy_id": i.copy_id,
                    "accession_number": copies[i.copy_id].accession_number if i.copy_id in copies else None,
                    "book_id": i.book_id,
                    "book_title": book.title if book else None,
                    "book_author": book.author if book else None,
                    "member_id": i.member_id,
                    "member_name": info[member.id][0] if member else None,
                    "member_type": member.member_type if member else None,
                    "card_number": member.card_number if member else None,
                    "issued_on": i.issued_on,
                    "due_date": i.due_date,
                    "returned_on": i.returned_on,
                    "return_condition": i.return_condition,
                    "renewals_count": i.renewals_count,
                    "status": i.status,
                    "is_overdue": days_overdue > 0,
                    "days_overdue": days_overdue,
                    "fine_amount": fine_amount,
                    "fine_status": fine_status,
                    "fine_paid_on": i.fine_paid_on,
                    "remarks": i.remarks,
                }
            )
        return out

    def list_issues(
        self,
        tenant_id: uuid.UUID,
        status: str | None = None,
        member_id: uuid.UUID | None = None,
        query: str | None = None,
    ) -> list[dict]:
        if status == "overdue":
            issues = self.issues.query(tenant_id, overdue_as_of=date.today())
        else:
            issues = self.issues.query(tenant_id, status=status, member_ids=[member_id] if member_id else None)
        if member_id and status == "overdue":
            issues = [i for i in issues if i.member_id == member_id]
        out = self._issues_out(tenant_id, issues)
        if query:
            q = query.lower()
            out = [
                i
                for i in out
                if q in (i["book_title"] or "").lower()
                or q in (i["member_name"] or "").lower()
                or q in (i["accession_number"] or "").lower()
                or q in (i["card_number"] or "").lower()
            ]
        return out

    def _get_issue(self, tenant_id: uuid.UUID, issue_id: uuid.UUID) -> BookIssue:
        issue = self.issues.get_by_id(tenant_id, issue_id)
        if issue is None:
            raise NotFoundError("Issue record not found")
        return issue

    def _issue_out(self, tenant_id: uuid.UUID, issue: BookIssue) -> dict:
        return self._issues_out(tenant_id, [issue])[0]

    def issue_book(self, tenant_id: uuid.UUID, payload: IssueCreate, issued_by: uuid.UUID | None = None) -> dict:
        self._expire_stale(tenant_id)
        settings = self.get_settings(tenant_id)
        member = self._get_member(tenant_id, payload.member_id)
        if member.status != "active":
            raise ConflictError("Library membership is inactive")
        if payload.copy_id:
            copy = self._get_copy(tenant_id, payload.copy_id)
        else:
            copy = self.copies.find_by_identifier(tenant_id, payload.copy_identifier.strip())
            if copy is None:
                raise NotFoundError("No copy found with that accession number or barcode")

        own_reservation = self.reservations.active_for_member_book(tenant_id, member.id, copy.book_id)
        if copy.status == "reserved":
            held = self.reservations.ready_for_copy(tenant_id, copy.id)
            if held is None or held.member_id != member.id:
                raise ConflictError("This copy is held for another member's reservation")
        elif copy.status != "available":
            raise ConflictError(f"Copy is not available (status: {copy.status})")

        if self.issues.member_has_book(tenant_id, member.id, copy.book_id):
            raise ConflictError("Member already has a copy of this book")
        limit = self._max_books(settings, member.member_type)
        if self.issues.active_count_for_member(tenant_id, member.id) >= limit:
            raise ConflictError(f"Borrowing limit reached ({limit} books)")

        issued_on = payload.issued_on or date.today()
        due_date = payload.due_date or issued_on + timedelta(days=self._loan_days(settings, member.member_type))
        if due_date < issued_on:
            raise DomainError("Due date cannot be before the issue date")

        if own_reservation is not None:
            other_copy_id = own_reservation.copy_id if own_reservation.copy_id != copy.id else None
            own_reservation.status = "fulfilled"
            if other_copy_id:
                # Member took a different copy than the one held; free the held one for the next in line.
                other = self.copies.get_by_id(tenant_id, other_copy_id)
                if other is not None and other.status == "reserved":
                    self.db.flush()
                    self._release_copy(tenant_id, other)

        issue = self.issues.create(
            BookIssue(
                tenant_id=tenant_id,
                copy_id=copy.id,
                book_id=copy.book_id,
                member_id=member.id,
                issued_on=issued_on,
                due_date=due_date,
                status="issued",
                fine_amount=0,
                fine_status="none",
                issued_by_user_id=issued_by,
                remarks=payload.remarks,
            )
        )
        copy.status = "issued"
        self.db.commit()
        self.db.refresh(issue)
        return self._issue_out(tenant_id, issue)

    def return_book(self, tenant_id: uuid.UUID, issue_id: uuid.UUID, payload: ReturnRequest) -> dict:
        issue = self._get_issue(tenant_id, issue_id)
        if issue.status != "issued":
            raise ConflictError("This book has already been returned")
        settings = self.get_settings(tenant_id)
        returned_on = payload.returned_on or date.today()
        if returned_on < issue.issued_on:
            raise DomainError("Return date cannot be before the issue date")
        days_late = max(0, (returned_on - issue.due_date).days)
        fine = days_late * float(settings.fine_per_day) + float(payload.extra_fine or 0)
        copy = self._get_copy(tenant_id, issue.copy_id)
        if payload.condition == "lost" and not payload.extra_fine:
            book = self.books.get_by_id(tenant_id, issue.book_id)
            fine += float(book.price or 0) if book else 0

        issue.returned_on = returned_on
        issue.return_condition = payload.condition
        issue.status = "lost" if payload.condition == "lost" else "returned"
        issue.fine_amount = round(fine, 2)
        issue.fine_status = "unpaid" if fine > 0 else "none"
        if payload.remarks:
            issue.remarks = payload.remarks

        if payload.condition == "good":
            copy.status = "available"
            self.db.flush()
            self._release_copy(tenant_id, copy)
        else:
            copy.status = payload.condition  # damaged | lost
        self.db.commit()
        self.db.refresh(issue)
        return self._issue_out(tenant_id, issue)

    def return_by_copy(self, tenant_id: uuid.UUID, identifier: str, payload: ReturnRequest) -> dict:
        copy = self.copies.find_by_identifier(tenant_id, identifier.strip())
        if copy is None:
            raise NotFoundError("No copy found with that accession number or barcode")
        issue = self.issues.active_for_copy(tenant_id, copy.id)
        if issue is None:
            raise ConflictError("This copy is not currently issued")
        return self.return_book(tenant_id, issue.id, payload)

    def renew_issue(self, tenant_id: uuid.UUID, issue_id: uuid.UUID, payload: RenewRequest) -> dict:
        issue = self._get_issue(tenant_id, issue_id)
        if issue.status != "issued":
            raise ConflictError("Only books currently issued can be renewed")
        settings = self.get_settings(tenant_id)
        today = date.today()
        if issue.due_date < today:
            raise ConflictError("Overdue books cannot be renewed; return the book and settle the fine")
        if issue.renewals_count >= settings.max_renewals:
            raise ConflictError(f"Maximum renewals reached ({settings.max_renewals})")
        if self.reservations.oldest_pending(tenant_id, issue.book_id) is not None:
            raise ConflictError("Another member is waiting for this book; it cannot be renewed")
        member = self._get_member(tenant_id, issue.member_id)
        new_due = payload.due_date or max(issue.due_date, today) + timedelta(
            days=self._loan_days(settings, member.member_type)
        )
        if new_due <= issue.due_date:
            raise DomainError("New due date must be after the current due date")
        issue.due_date = new_due
        issue.renewals_count += 1
        self.db.commit()
        self.db.refresh(issue)
        return self._issue_out(tenant_id, issue)

    def settle_fine(self, tenant_id: uuid.UUID, issue_id: uuid.UUID, payload: FineAction) -> dict:
        issue = self._get_issue(tenant_id, issue_id)
        if issue.status == "issued":
            raise ConflictError("Return the book before settling its fine")
        if issue.fine_status != "unpaid":
            raise ConflictError("There is no unpaid fine on this record")
        issue.fine_status = payload.action
        issue.fine_paid_on = payload.paid_on or date.today()
        self.db.commit()
        self.db.refresh(issue)
        return self._issue_out(tenant_id, issue)

    # -------------------------------------------------------------- reservations
    def _release_copy(self, tenant_id: uuid.UUID, copy: BookCopy) -> None:
        """A copy became free: hand it to the oldest pending reservation, else mark it available."""
        pending = self.reservations.oldest_pending(tenant_id, copy.book_id)
        if pending is None:
            copy.status = "available"
            return
        settings = self.get_settings(tenant_id)
        today = date.today()
        pending.status = "ready"
        pending.copy_id = copy.id
        pending.ready_on = today
        pending.expires_on = today + timedelta(days=settings.reservation_hold_days)
        copy.status = "reserved"
        self.db.flush()

    def _expire_stale(self, tenant_id: uuid.UUID) -> None:
        stale = self.reservations.stale_ready(tenant_id, date.today())
        if not stale:
            return
        for res in stale:
            res.status = "expired"
            copy = self.copies.get_by_id(tenant_id, res.copy_id) if res.copy_id else None
            self.db.flush()
            if copy is not None and copy.status == "reserved":
                self._release_copy(tenant_id, copy)
        self.db.commit()

    def _reservations_out(self, tenant_id: uuid.UUID, reservations: list[BookReservation]) -> list[dict]:
        if not reservations:
            return []
        books = self.books.get_many(tenant_id, {r.book_id for r in reservations})
        members = self.members.get_many(tenant_id, {r.member_id for r in reservations})
        copies = self.copies.get_many(tenant_id, {r.copy_id for r in reservations if r.copy_id})
        info = self._people_info(tenant_id, list(members.values()))
        queues: dict[uuid.UUID, list[uuid.UUID]] = {}
        for book_id in {r.book_id for r in reservations if r.status == "pending"}:
            queues[book_id] = [r.id for r in self.reservations.query(tenant_id, status="pending", book_id=book_id)]
        out = []
        for r in reservations:
            member = members.get(r.member_id)
            position = None
            if r.status == "pending" and r.id in queues.get(r.book_id, []):
                position = queues[r.book_id].index(r.id) + 1
            out.append(
                {
                    "id": r.id,
                    "book_id": r.book_id,
                    "book_title": books[r.book_id].title if r.book_id in books else None,
                    "member_id": r.member_id,
                    "member_name": info[member.id][0] if member else None,
                    "card_number": member.card_number if member else None,
                    "reserved_at": r.reserved_at,
                    "status": r.status,
                    "copy_id": r.copy_id,
                    "accession_number": copies[r.copy_id].accession_number if r.copy_id in copies else None,
                    "ready_on": r.ready_on,
                    "expires_on": r.expires_on,
                    "queue_position": position,
                }
            )
        return out

    def list_reservations(self, tenant_id: uuid.UUID, status: str | None = "active") -> list[dict]:
        self._expire_stale(tenant_id)
        return self._reservations_out(tenant_id, self.reservations.query(tenant_id, status=status))

    def _reserve(self, tenant_id: uuid.UUID, member: LibraryMember, book_id: uuid.UUID) -> BookReservation:
        self._expire_stale(tenant_id)
        if member.status != "active":
            raise ConflictError("Library membership is inactive")
        self._get_book(tenant_id, book_id)
        counts = self.copies.status_counts(tenant_id, [book_id]).get(book_id, {})
        if counts.get("available", 0) > 0:
            raise ConflictError("A copy is available right now; ask the librarian to issue it")
        if not sum(counts.get(s, 0) for s in ("issued", "reserved")):
            raise ConflictError("No copies of this book are in circulation")
        if self.reservations.active_for_member_book(tenant_id, member.id, book_id):
            raise ConflictError("You already have an active reservation for this book")
        if self.issues.member_has_book(tenant_id, member.id, book_id):
            raise ConflictError("This book is already issued to the member")
        return self.reservations.create(
            BookReservation(tenant_id=tenant_id, book_id=book_id, member_id=member.id, status="pending")
        )

    def create_reservation(self, tenant_id: uuid.UUID, book_id: uuid.UUID, member_id: uuid.UUID) -> dict:
        member = self._get_member(tenant_id, member_id)
        res = self._reserve(tenant_id, member, book_id)
        self.db.commit()
        return self._reservations_out(tenant_id, [res])[0]

    def cancel_reservation(self, tenant_id: uuid.UUID, reservation_id: uuid.UUID, user: User | None = None) -> dict:
        res = self.reservations.get_by_id(tenant_id, reservation_id)
        if res is None:
            raise NotFoundError("Reservation not found")
        if user is not None and user.role.value != "admin":
            member = self._member_for_user(user)
            if member is None or member.id != res.member_id:
                raise NotFoundError("Reservation not found")
        if res.status not in ("pending", "ready"):
            raise ConflictError("Reservation is no longer active")
        held_copy_id = res.copy_id if res.status == "ready" else None
        res.status = "cancelled"
        self.db.flush()
        if held_copy_id:
            copy = self.copies.get_by_id(tenant_id, held_copy_id)
            if copy is not None and copy.status == "reserved":
                self._release_copy(tenant_id, copy)
        self.db.commit()
        return self._reservations_out(tenant_id, [res])[0]

    # -------------------------------------------------------------------- portal
    def _library_view(self, tenant_id: uuid.UUID, member: LibraryMember | None, member_type: str) -> dict:
        settings = self.get_settings(tenant_id)
        if member is None:
            return {
                "member": None,
                "issues": [],
                "reservations": [],
                "outstanding_fine": 0.0,
                "max_books": self._max_books(settings, member_type),
                "loan_days": self._loan_days(settings, member_type),
            }
        member_out = self._member_out(tenant_id, [member])[0]
        issues = self._issues_out(tenant_id, self.issues.query(tenant_id, member_ids=[member.id]))
        reservations = self._reservations_out(
            tenant_id, self.reservations.query(tenant_id, status="all", member_ids=[member.id])
        )
        return {
            "member": member_out,
            "issues": issues,
            "reservations": sorted(reservations, key=lambda r: r["reserved_at"], reverse=True),
            "outstanding_fine": member_out["outstanding_fine"],
            "max_books": self._max_books(settings, member.member_type),
            "loan_days": self._loan_days(settings, member.member_type),
        }

    def my_library(self, user: User) -> dict:
        self._expire_stale(user.tenant_id)
        return self._library_view(user.tenant_id, self._member_for_user(user), user.role.value)

    def reserve_for_me(self, user: User, book_id: uuid.UUID) -> dict:
        member = self._member_for_user(user, create=True)
        if member is None:
            raise ForbiddenError("Only students and teachers with a profile can reserve books")
        res = self._reserve(user.tenant_id, member, book_id)
        self.db.commit()
        return self._reservations_out(user.tenant_id, [res])[0]

    def children_library(self, user: User) -> list[dict]:
        tenant_id = user.tenant_id
        self._expire_stale(tenant_id)
        parent = self.db.execute(
            select(ParentProfile).where(ParentProfile.tenant_id == tenant_id, ParentProfile.user_id == user.id)
        ).scalar_one_or_none()
        if parent is None:
            return []
        rows = self.db.execute(
            select(StudentProfile, User.full_name)
            .join(ParentStudentLink, ParentStudentLink.student_id == StudentProfile.id)
            .join(User, User.id == StudentProfile.user_id)
            .where(ParentStudentLink.tenant_id == tenant_id, ParentStudentLink.parent_id == parent.id)
            .order_by(User.full_name)
        ).all()
        result = []
        for profile, name in rows:
            member = self.members.find(tenant_id, student_id=profile.id)
            view = self._library_view(tenant_id, member, "student")
            view.update({"student_id": profile.id, "student_name": name})
            result.append(view)
        return result

    # ------------------------------------------------------------------- reports
    def overdue(self, tenant_id: uuid.UUID) -> list[dict]:
        out = self._issues_out(tenant_id, self.issues.query(tenant_id, overdue_as_of=date.today()))
        return sorted(out, key=lambda i: i["days_overdue"], reverse=True)

    def fines_report(
        self, tenant_id: uuid.UUID, date_from: date | None = None, date_to: date | None = None, status: str | None = None
    ) -> dict:
        paid = self.issues.query(tenant_id, fine_status="paid", paid_from=date_from, paid_to=date_to)
        waived = self.issues.query(tenant_id, fine_status="waived", paid_from=date_from, paid_to=date_to)
        unpaid = self.issues.query(tenant_id, fine_status="unpaid")
        if status == "paid":
            items = paid
        elif status == "waived":
            items = waived
        elif status == "unpaid":
            items = unpaid
        else:
            items = unpaid + paid + waived
        return {
            "total_collected": round(sum(_money(i.fine_amount) for i in paid), 2),
            "total_waived": round(sum(_money(i.fine_amount) for i in waived), 2),
            "total_outstanding": round(sum(_money(i.fine_amount) for i in unpaid), 2),
            "items": self._issues_out(tenant_id, items),
        }

    def most_issued(
        self, tenant_id: uuid.UUID, limit: int = 10, date_from: date | None = None, date_to: date | None = None
    ) -> list[dict]:
        rows = self.issues.most_issued(tenant_id, limit, date_from, date_to)
        books = self.books.get_many(tenant_id, {book_id for book_id, _ in rows})
        return [
            {"book_id": book_id, "title": books[book_id].title, "author": books[book_id].author, "issue_count": n}
            for book_id, n in rows
            if book_id in books
        ]

    def summary(self, tenant_id: uuid.UUID) -> dict:
        self._expire_stale(tenant_id)
        settings = self.get_settings(tenant_id)
        today = date.today()
        counts = self.copies.count_by_status(tenant_id)
        overdue = self.issues.query(tenant_id, overdue_as_of=today)
        unpaid = self.issues.query(tenant_id, fine_status="unpaid")
        outstanding = sum(_money(i.fine_amount) for i in unpaid) + sum(
            self._accrued_fine(i, settings, today) for i in overdue
        )
        return {
            "total_titles": len(self.books.list(tenant_id)),
            "total_copies": sum(counts.values()),
            "available_copies": counts.get("available", 0),
            "issued_copies": counts.get("issued", 0),
            "reserved_copies": counts.get("reserved", 0),
            "lost_copies": counts.get("lost", 0),
            "damaged_copies": counts.get("damaged", 0),
            "total_members": len(self.members.list(tenant_id)),
            "overdue_count": len(overdue),
            "pending_reservations": len(self.reservations.query(tenant_id, status="pending")),
            "outstanding_fines": round(outstanding, 2),
        }


def _render_member_card(school_name: str, member: dict) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    width, height = 86 * mm, 54 * mm
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(width, height))
    primary = colors.HexColor("#0e3550")
    c.setFillColor(primary)
    c.rect(0, height - 14 * mm, width, 14 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(width / 2, height - 7 * mm, school_name[:40])
    c.setFont("Helvetica", 7)
    c.drawCentredString(width / 2, height - 11.5 * mm, "LIBRARY MEMBERSHIP CARD")
    c.setFillColor(colors.black)
    rows = [
        ("Name", member["full_name"]),
        ("Member type", member["member_type"].title()),
        ("Card No.", member["card_number"]),
        ("Reference", member["reference"] or "-"),
        ("Member since", member["joined_on"].strftime("%d %b %Y")),
    ]
    y = height - 20 * mm
    for label, value in rows:
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(5 * mm, y, f"{label}:")
        c.setFont("Helvetica", 7.5)
        c.drawString(28 * mm, y, str(value)[:38])
        y -= 5.5 * mm
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(primary)
    c.drawRightString(width - 4 * mm, 4 * mm, member["card_number"])
    c.showPage()
    c.save()
    return buffer.getvalue()
