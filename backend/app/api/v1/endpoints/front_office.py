import uuid
from datetime import date, datetime

from fastapi import APIRouter, Body, Depends, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.front_office import (
    CallCreate,
    CallOut,
    CallUpdate,
    ComplaintCreate,
    ComplaintOut,
    ComplaintUpdate,
    EnquiryConversionPrefill,
    EnquiryCreate,
    EnquiryOut,
    EnquirySummary,
    EnquiryUpdate,
    FollowUpCreate,
    FollowUpOut,
    GatePassCreate,
    GatePassOut,
    PostalCreate,
    PostalOut,
    PostalUpdate,
    StudentLookupOut,
    VisitorCreate,
    VisitorOut,
    VisitorUpdate,
)
from app.services.front_office_service import FrontOfficeService

router = APIRouter(prefix="/front-office", tags=["front-office"])

admin_only = require_role(RoleEnum.ADMIN)


# ---------- Admission enquiries ----------


@router.get("/enquiries/summary", response_model=EnquirySummary)
def enquiry_summary(current_user: User = Depends(admin_only), db: Session = Depends(get_db)) -> EnquirySummary:
    return FrontOfficeService(db).enquiry_summary(current_user.tenant_id)


@router.get("/enquiries", response_model=list[EnquiryOut])
def list_enquiries(
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = None,
    source: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return FrontOfficeService(db).list_enquiries(
        current_user.tenant_id, status=status_filter, query=q, source=source, date_from=date_from, date_to=date_to
    )


@router.post("/enquiries", response_model=EnquiryOut, status_code=status.HTTP_201_CREATED)
def create_enquiry(payload: EnquiryCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return FrontOfficeService(db).create_enquiry(current_user.tenant_id, payload)


@router.get("/enquiries/{enquiry_id}", response_model=EnquiryOut)
def get_enquiry(enquiry_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return FrontOfficeService(db).get_enquiry(current_user.tenant_id, enquiry_id)


@router.patch("/enquiries/{enquiry_id}", response_model=EnquiryOut)
def update_enquiry(
    enquiry_id: uuid.UUID, payload: EnquiryUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return FrontOfficeService(db).update_enquiry(current_user.tenant_id, enquiry_id, payload)


@router.delete("/enquiries/{enquiry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_enquiry(enquiry_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    FrontOfficeService(db).delete_enquiry(current_user.tenant_id, enquiry_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/enquiries/{enquiry_id}/follow-ups", response_model=list[FollowUpOut])
def list_follow_ups(enquiry_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return FrontOfficeService(db).list_follow_ups(current_user.tenant_id, enquiry_id)


@router.post("/enquiries/{enquiry_id}/follow-ups", response_model=FollowUpOut, status_code=status.HTTP_201_CREATED)
def add_follow_up(
    enquiry_id: uuid.UUID, payload: FollowUpCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return FrontOfficeService(db).add_follow_up(current_user.tenant_id, enquiry_id, payload, current_user.id)


@router.post("/enquiries/{enquiry_id}/convert", response_model=EnquiryConversionPrefill)
def convert_enquiry(enquiry_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return FrontOfficeService(db).convert_enquiry(current_user.tenant_id, enquiry_id)


# ---------- Visitors ----------


@router.get("/visitors", response_model=list[VisitorOut])
def list_visitors(
    day: date | None = Query(default=None, alias="date"),
    q: str | None = None,
    inside_only: bool = False,
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return FrontOfficeService(db).list_visitors(current_user.tenant_id, day=day, query=q, inside_only=inside_only)


@router.post("/visitors", response_model=VisitorOut, status_code=status.HTTP_201_CREATED)
def create_visitor(payload: VisitorCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return FrontOfficeService(db).create_visitor(current_user.tenant_id, payload)


@router.patch("/visitors/{visitor_id}", response_model=VisitorOut)
def update_visitor(
    visitor_id: uuid.UUID, payload: VisitorUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return FrontOfficeService(db).update_visitor(current_user.tenant_id, visitor_id, payload)


@router.post("/visitors/{visitor_id}/check-out", response_model=VisitorOut)
def check_out_visitor(
    visitor_id: uuid.UUID,
    out_time: datetime | None = Body(default=None, embed=True),
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return FrontOfficeService(db).check_out_visitor(current_user.tenant_id, visitor_id, out_time)


@router.delete("/visitors/{visitor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_visitor(visitor_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    FrontOfficeService(db).delete_visitor(current_user.tenant_id, visitor_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Complaints ----------


@router.get("/complaints", response_model=list[ComplaintOut])
def list_complaints(
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = None,
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return FrontOfficeService(db).list_complaints(current_user.tenant_id, status=status_filter, query=q)


@router.post("/complaints", response_model=ComplaintOut, status_code=status.HTTP_201_CREATED)
def create_complaint(payload: ComplaintCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return FrontOfficeService(db).create_complaint(current_user.tenant_id, payload)


@router.patch("/complaints/{complaint_id}", response_model=ComplaintOut)
def update_complaint(
    complaint_id: uuid.UUID, payload: ComplaintUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return FrontOfficeService(db).update_complaint(current_user.tenant_id, complaint_id, payload)


@router.delete("/complaints/{complaint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_complaint(complaint_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    FrontOfficeService(db).delete_complaint(current_user.tenant_id, complaint_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Postal ----------


@router.get("/postal", response_model=list[PostalOut])
def list_postal(
    record_type: str | None = Query(default=None, alias="type"),
    q: str | None = None,
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return FrontOfficeService(db).list_postal(current_user.tenant_id, record_type=record_type, query=q)


@router.post("/postal", response_model=PostalOut, status_code=status.HTTP_201_CREATED)
def create_postal(payload: PostalCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return FrontOfficeService(db).create_postal(current_user.tenant_id, payload)


@router.patch("/postal/{record_id}", response_model=PostalOut)
def update_postal(
    record_id: uuid.UUID, payload: PostalUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return FrontOfficeService(db).update_postal(current_user.tenant_id, record_id, payload)


@router.delete("/postal/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_postal(record_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    FrontOfficeService(db).delete_postal(current_user.tenant_id, record_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Gate passes ----------


@router.get("/gate-passes/student-lookup", response_model=StudentLookupOut)
def lookup_student(
    admission_number: str = Query(min_length=1),
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return FrontOfficeService(db).lookup_student(current_user.tenant_id, admission_number)


@router.get("/gate-passes", response_model=list[GatePassOut])
def list_gate_passes(
    day: date | None = Query(default=None, alias="date"),
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return FrontOfficeService(db).list_gate_passes(current_user.tenant_id, day)


@router.post("/gate-passes", response_model=GatePassOut, status_code=status.HTTP_201_CREATED)
def create_gate_pass(payload: GatePassCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return FrontOfficeService(db).create_gate_pass(current_user.tenant_id, payload, current_user.full_name)


@router.get("/gate-passes/{pass_id}/pdf")
def gate_pass_pdf(pass_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    pdf_bytes = FrontOfficeService(db).gate_pass_pdf(current_user.tenant_id, pass_id)
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=gate-pass.pdf"},
    )


@router.delete("/gate-passes/{pass_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_gate_pass(pass_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    FrontOfficeService(db).delete_gate_pass(current_user.tenant_id, pass_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Phone call log ----------


@router.get("/calls", response_model=list[CallOut])
def list_calls(
    call_type: str | None = Query(default=None, alias="type"),
    q: str | None = None,
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return FrontOfficeService(db).list_calls(current_user.tenant_id, call_type=call_type, query=q)


@router.post("/calls", response_model=CallOut, status_code=status.HTTP_201_CREATED)
def create_call(payload: CallCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return FrontOfficeService(db).create_call(current_user.tenant_id, payload)


@router.patch("/calls/{call_id}", response_model=CallOut)
def update_call(
    call_id: uuid.UUID, payload: CallUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return FrontOfficeService(db).update_call(current_user.tenant_id, call_id, payload)


@router.delete("/calls/{call_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_call(call_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    FrontOfficeService(db).delete_call(current_user.tenant_id, call_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
