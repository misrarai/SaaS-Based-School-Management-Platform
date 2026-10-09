import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.exceptions import DomainError
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.exam import (
    DatesheetEntryOut,
    DatesheetSave,
    ExamCreate,
    ExamOut,
    ExamUpdate,
    GradingSchemeCreate,
    GradingSchemeOut,
    GradingSchemeUpdate,
    MarksSave,
    MarksSheetOut,
    MyExamOut,
    PublishResultsRequest,
    StudentExamResultOut,
    StudentRemarkSave,
    TabulationOut,
    TeacherSubjectOut,
)
from app.services.exam_service import ExamService

router = APIRouter(prefix="/exams", tags=["exams"])

ADMIN = require_role(RoleEnum.ADMIN)
STAFF = require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)
ANY = require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)


def _pdf(content: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        iter([content]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"},
    )


# ---------------------------------------------------------------- grading schemes
@router.get("/grading-schemes", response_model=list[GradingSchemeOut])
def list_grading_schemes(current_user: User = Depends(STAFF), db: Session = Depends(get_db)):
    return ExamService(db).list_schemes(current_user.tenant_id)


@router.post("/grading-schemes", response_model=GradingSchemeOut, status_code=status.HTTP_201_CREATED)
def create_grading_scheme(payload: GradingSchemeCreate, current_user: User = Depends(ADMIN),
                          db: Session = Depends(get_db)):
    return ExamService(db).create_scheme(current_user.tenant_id, payload)


@router.post("/grading-schemes/default", response_model=GradingSchemeOut)
def seed_default_grading_scheme(current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return ExamService(db).seed_default_scheme(current_user.tenant_id)


@router.put("/grading-schemes/{scheme_id}", response_model=GradingSchemeOut)
def update_grading_scheme(scheme_id: uuid.UUID, payload: GradingSchemeUpdate, current_user: User = Depends(ADMIN),
                          db: Session = Depends(get_db)):
    return ExamService(db).update_scheme(current_user.tenant_id, scheme_id, payload)


@router.delete("/grading-schemes/{scheme_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_grading_scheme(scheme_id: uuid.UUID, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    ExamService(db).delete_scheme(current_user.tenant_id, scheme_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------- portal / teacher helpers
@router.get("/teacher/my-subjects", response_model=list[TeacherSubjectOut])
def my_teaching_subjects(current_user: User = Depends(require_role(RoleEnum.TEACHER)), db: Session = Depends(get_db)):
    return ExamService(db).list_teacher_subjects(current_user)


@router.get("/my", response_model=list[MyExamOut])
def my_exams(
    student_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
):
    """Student: own published exams. Parent: pass student_id of a linked child."""
    return ExamService(db).my_exams(current_user, student_id)


# ---------------------------------------------------------------- exams
@router.get("", response_model=list[ExamOut])
def list_exams(current_user: User = Depends(STAFF), db: Session = Depends(get_db)):
    return ExamService(db).list_exams(current_user.tenant_id)


@router.post("", response_model=ExamOut, status_code=status.HTTP_201_CREATED)
def create_exam(payload: ExamCreate, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return ExamService(db).create_exam(current_user.tenant_id, payload)


@router.get("/{exam_id}", response_model=ExamOut)
def get_exam(exam_id: uuid.UUID, current_user: User = Depends(STAFF), db: Session = Depends(get_db)):
    return ExamService(db).exam_out(current_user.tenant_id, exam_id)


@router.patch("/{exam_id}", response_model=ExamOut)
def update_exam(exam_id: uuid.UUID, payload: ExamUpdate, current_user: User = Depends(ADMIN),
                db: Session = Depends(get_db)):
    return ExamService(db).update_exam(current_user.tenant_id, exam_id, payload)


@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exam(exam_id: uuid.UUID, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    ExamService(db).delete_exam(current_user.tenant_id, exam_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{exam_id}/publish-results", response_model=ExamOut)
def publish_results(exam_id: uuid.UUID, payload: PublishResultsRequest, current_user: User = Depends(ADMIN),
                    db: Session = Depends(get_db)):
    return ExamService(db).set_results_published(current_user.tenant_id, exam_id, payload.published)


# ---------------------------------------------------------------- datesheet
@router.get("/{exam_id}/datesheet", response_model=list[DatesheetEntryOut])
def get_datesheet(
    exam_id: uuid.UUID,
    class_grade_id: uuid.UUID | None = Query(default=None),
    student_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(ANY),
    db: Session = Depends(get_db),
):
    service = ExamService(db)
    class_id = service.assert_can_view_datesheet(current_user, exam_id, class_grade_id, student_id)
    return service.get_datesheet(current_user.tenant_id, exam_id, class_id)


@router.put("/{exam_id}/datesheet", response_model=list[DatesheetEntryOut])
def save_datesheet(exam_id: uuid.UUID, payload: DatesheetSave, current_user: User = Depends(ADMIN),
                   db: Session = Depends(get_db)):
    return ExamService(db).save_datesheet(current_user.tenant_id, exam_id, payload)


@router.get("/{exam_id}/datesheet/pdf")
def datesheet_pdf(
    exam_id: uuid.UUID,
    class_grade_id: uuid.UUID | None = Query(default=None),
    student_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(ANY),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    service = ExamService(db)
    class_id = service.assert_can_view_datesheet(current_user, exam_id, class_grade_id, student_id)
    if class_id is None:
        raise DomainError("class_grade_id is required")
    return _pdf(service.datesheet_pdf(current_user.tenant_id, exam_id, class_id), "datesheet.pdf")


# ---------------------------------------------------------------- marks
@router.get("/{exam_id}/marks", response_model=MarksSheetOut)
def get_marks(
    exam_id: uuid.UUID,
    class_grade_id: uuid.UUID,
    subject_id: uuid.UUID,
    section_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(STAFF),
    db: Session = Depends(get_db),
):
    return ExamService(db).get_marks_sheet(current_user, exam_id, class_grade_id, section_id, subject_id)


@router.put("/{exam_id}/marks", response_model=MarksSheetOut)
def save_marks(exam_id: uuid.UUID, payload: MarksSave, current_user: User = Depends(STAFF),
               db: Session = Depends(get_db)):
    return ExamService(db).save_marks(current_user, exam_id, payload)


# ---------------------------------------------------------------- results
@router.get("/{exam_id}/results", response_model=TabulationOut)
def tabulation(
    exam_id: uuid.UUID,
    class_grade_id: uuid.UUID,
    section_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(STAFF),
    db: Session = Depends(get_db),
):
    return ExamService(db).tabulation(current_user.tenant_id, exam_id, class_grade_id, section_id)


@router.get("/{exam_id}/results/pdf")
def tabulation_pdf(
    exam_id: uuid.UUID,
    class_grade_id: uuid.UUID,
    section_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(STAFF),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    content = ExamService(db).tabulation_pdf(current_user.tenant_id, exam_id, class_grade_id, section_id)
    return _pdf(content, "tabulation-sheet.pdf")


@router.get("/{exam_id}/students/{student_id}/result", response_model=StudentExamResultOut)
def student_result(exam_id: uuid.UUID, student_id: uuid.UUID, current_user: User = Depends(ANY),
                   db: Session = Depends(get_db)):
    return ExamService(db).student_result(current_user, exam_id, student_id)


@router.get("/{exam_id}/students/{student_id}/result-card")
def result_card(exam_id: uuid.UUID, student_id: uuid.UUID, current_user: User = Depends(ANY),
                db: Session = Depends(get_db)) -> StreamingResponse:
    return _pdf(ExamService(db).result_card_pdf(current_user, exam_id, student_id), "result-card.pdf")


@router.put("/{exam_id}/students/{student_id}/remarks", status_code=status.HTTP_204_NO_CONTENT)
def save_student_remarks(exam_id: uuid.UUID, student_id: uuid.UUID, payload: StudentRemarkSave,
                         current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    ExamService(db).save_student_remarks(current_user.tenant_id, exam_id, student_id, payload.remarks)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
