import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.library import (
    BookCreate,
    BookDetailOut,
    BookOut,
    BookUpdate,
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    ChildLibraryOut,
    CopyCreate,
    CopyOut,
    CopyUpdate,
    FineAction,
    FineReportOut,
    IssueCreate,
    IssueOut,
    LibrarySettingsOut,
    LibrarySettingsUpdate,
    LibrarySummaryOut,
    MemberCreate,
    MemberOut,
    MemberStatusUpdate,
    MostIssuedOut,
    MyLibraryOut,
    MyReservationCreate,
    RenewRequest,
    ReservationCreate,
    ReservationOut,
    ReturnByCopyRequest,
    ReturnRequest,
)
from app.services.library_service import LibraryService

router = APIRouter(prefix="/library", tags=["library"])

ADMIN = require_role(RoleEnum.ADMIN)
CATALOGUE_READERS = require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)
BORROWERS = require_role(RoleEnum.STUDENT, RoleEnum.TEACHER)


# ------------------------------------------------------------------ settings
@router.get("/settings", response_model=LibrarySettingsOut)
def get_settings(current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return LibraryService(db).get_settings(current_user.tenant_id)


@router.put("/settings", response_model=LibrarySettingsOut)
def update_settings(
    payload: LibrarySettingsUpdate, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)
):
    return LibraryService(db).update_settings(current_user.tenant_id, payload)


# ---------------------------------------------------------------- categories
@router.get("/categories", response_model=list[CategoryOut])
def list_categories(current_user: User = Depends(CATALOGUE_READERS), db: Session = Depends(get_db)):
    return LibraryService(db).list_categories(current_user.tenant_id)


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return LibraryService(db).create_category(current_user.tenant_id, payload)


@router.patch("/categories/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: uuid.UUID, payload: CategoryUpdate, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)
):
    return LibraryService(db).update_category(current_user.tenant_id, category_id, payload)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: uuid.UUID, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    LibraryService(db).delete_category(current_user.tenant_id, category_id)


# --------------------------------------------------------------------- books
@router.get("/books", response_model=list[BookOut])
def search_books(
    q: str | None = Query(default=None),
    category_id: uuid.UUID | None = Query(default=None),
    available_only: bool = Query(default=False),
    current_user: User = Depends(CATALOGUE_READERS),
    db: Session = Depends(get_db),
):
    return LibraryService(db).search_books(current_user.tenant_id, q, category_id, available_only)


@router.post("/books", response_model=BookDetailOut, status_code=status.HTTP_201_CREATED)
def create_book(payload: BookCreate, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return LibraryService(db).create_book(current_user.tenant_id, payload)


@router.get("/books/{book_id}", response_model=BookDetailOut)
def get_book(book_id: uuid.UUID, current_user: User = Depends(CATALOGUE_READERS), db: Session = Depends(get_db)):
    return LibraryService(db).get_book_detail(current_user.tenant_id, book_id)


@router.patch("/books/{book_id}", response_model=BookDetailOut)
def update_book(
    book_id: uuid.UUID, payload: BookUpdate, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)
):
    return LibraryService(db).update_book(current_user.tenant_id, book_id, payload)


@router.delete("/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(book_id: uuid.UUID, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    LibraryService(db).delete_book(current_user.tenant_id, book_id)


@router.post("/books/{book_id}/copies", response_model=list[CopyOut], status_code=status.HTTP_201_CREATED)
def add_copies(
    book_id: uuid.UUID, payload: CopyCreate, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)
):
    return LibraryService(db).add_copies(current_user.tenant_id, book_id, payload)


@router.patch("/copies/{copy_id}", response_model=CopyOut)
def update_copy(
    copy_id: uuid.UUID, payload: CopyUpdate, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)
):
    return LibraryService(db).update_copy(current_user.tenant_id, copy_id, payload)


@router.delete("/copies/{copy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_copy(copy_id: uuid.UUID, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    LibraryService(db).delete_copy(current_user.tenant_id, copy_id)


# ------------------------------------------------------------------- members
@router.get("/members", response_model=list[MemberOut])
def list_members(
    member_type: str | None = Query(default=None),
    q: str | None = Query(default=None),
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    return LibraryService(db).list_members(current_user.tenant_id, member_type, q)


@router.post("/members", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def create_member(payload: MemberCreate, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return LibraryService(db).create_member(current_user.tenant_id, payload)


@router.get("/members/{member_id}", response_model=MemberOut)
def get_member(member_id: uuid.UUID, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return LibraryService(db).get_member(current_user.tenant_id, member_id)


@router.post("/members/{member_id}/status", response_model=MemberOut)
def set_member_status(
    member_id: uuid.UUID, payload: MemberStatusUpdate, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)
):
    return LibraryService(db).set_member_status(current_user.tenant_id, member_id, payload.status)


@router.get("/members/{member_id}/card")
def member_card(member_id: uuid.UUID, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    pdf_bytes = LibraryService(db).member_card_pdf(current_user.tenant_id, member_id)
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=library-card.pdf"},
    )


# --------------------------------------------------------------- circulation
@router.get("/issues", response_model=list[IssueOut])
def list_issues(
    status_filter: str | None = Query(default=None, alias="status"),
    member_id: uuid.UUID | None = Query(default=None),
    q: str | None = Query(default=None),
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    return LibraryService(db).list_issues(current_user.tenant_id, status_filter, member_id, q)


@router.post("/issues", response_model=IssueOut, status_code=status.HTTP_201_CREATED)
def issue_book(payload: IssueCreate, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return LibraryService(db).issue_book(current_user.tenant_id, payload, issued_by=current_user.id)


@router.post("/issues/{issue_id}/return", response_model=IssueOut)
def return_book(
    issue_id: uuid.UUID, payload: ReturnRequest, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)
):
    return LibraryService(db).return_book(current_user.tenant_id, issue_id, payload)


@router.post("/returns", response_model=IssueOut)
def return_by_copy(payload: ReturnByCopyRequest, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return LibraryService(db).return_by_copy(current_user.tenant_id, payload.copy_identifier, payload)


@router.post("/issues/{issue_id}/renew", response_model=IssueOut)
def renew_issue(
    issue_id: uuid.UUID, payload: RenewRequest, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)
):
    return LibraryService(db).renew_issue(current_user.tenant_id, issue_id, payload)


@router.post("/issues/{issue_id}/fine", response_model=IssueOut)
def settle_fine(
    issue_id: uuid.UUID, payload: FineAction, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)
):
    return LibraryService(db).settle_fine(current_user.tenant_id, issue_id, payload)


# -------------------------------------------------------------- reservations
@router.get("/reservations", response_model=list[ReservationOut])
def list_reservations(
    status_filter: str | None = Query(default="active", alias="status"),
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    return LibraryService(db).list_reservations(current_user.tenant_id, status_filter)


@router.post("/reservations", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
def create_reservation(payload: ReservationCreate, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return LibraryService(db).create_reservation(current_user.tenant_id, payload.book_id, payload.member_id)


@router.post("/reservations/{reservation_id}/cancel", response_model=ReservationOut)
def cancel_reservation(
    reservation_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.STUDENT, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
):
    return LibraryService(db).cancel_reservation(current_user.tenant_id, reservation_id, current_user)


# -------------------------------------------------------------------- portal
@router.get("/me", response_model=MyLibraryOut)
def my_library(current_user: User = Depends(BORROWERS), db: Session = Depends(get_db)):
    return LibraryService(db).my_library(current_user)


@router.post("/me/reservations", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
def reserve_for_me(payload: MyReservationCreate, current_user: User = Depends(BORROWERS), db: Session = Depends(get_db)):
    return LibraryService(db).reserve_for_me(current_user, payload.book_id)


@router.post("/me/issues/{issue_id}/renew", response_model=IssueOut)
def renew_my_issue(issue_id: uuid.UUID, current_user: User = Depends(BORROWERS), db: Session = Depends(get_db)):
    service = LibraryService(db)
    view = service.my_library(current_user)
    if not any(i["id"] == issue_id for i in view["issues"]):
        raise NotFoundError("Issue record not found")
    return service.renew_issue(current_user.tenant_id, issue_id, RenewRequest())


@router.get("/children", response_model=list[ChildLibraryOut])
def children_library(
    current_user: User = Depends(require_role(RoleEnum.PARENT)), db: Session = Depends(get_db)
):
    return LibraryService(db).children_library(current_user)


# ------------------------------------------------------------------- reports
@router.get("/reports/summary", response_model=LibrarySummaryOut)
def report_summary(current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return LibraryService(db).summary(current_user.tenant_id)


@router.get("/reports/issued", response_model=list[IssueOut])
def report_issued(current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return LibraryService(db).list_issues(current_user.tenant_id, "issued")


@router.get("/reports/overdue", response_model=list[IssueOut])
def report_overdue(current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return LibraryService(db).overdue(current_user.tenant_id)


@router.get("/reports/fines", response_model=FineReportOut)
def report_fines(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    return LibraryService(db).fines_report(current_user.tenant_id, date_from, date_to, status_filter)


@router.get("/reports/most-issued", response_model=list[MostIssuedOut])
def report_most_issued(
    limit: int = Query(default=10, ge=1, le=100),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    return LibraryService(db).most_issued(current_user.tenant_id, limit, date_from, date_to)
