import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.core.grading_scale import letter_grade
from app.core.pdf_render import render_certificate, render_id_card, render_report_card
from app.models.quiz import AttemptStatus
from app.repositories.academic_repo import ClassGradeRepository
from app.repositories.assignment_repo import AssignmentRepository, AssignmentSubmissionRepository
from app.repositories.quiz_repo import QuizAttemptRepository, QuizRepository
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.tenant_repo import TenantRepository
from app.services.attendance_service import AttendanceService


class DocumentService:
    """Composes DB data for a student into printable PDFs — report card, ID card, certificate.
    Rendering itself lives in app.core.pdf_render (pure functions, no DB access) so the layout
    can be tweaked without touching data-gathering logic."""

    def __init__(self, db: Session):
        self.db = db
        self.tenants = TenantRepository(db)
        self.student_profiles = StudentProfileRepository(db)
        self.class_grades = ClassGradeRepository(db)
        self.assignments = AssignmentRepository(db)
        self.submissions = AssignmentSubmissionRepository(db)
        self.quizzes = QuizRepository(db)
        self.quiz_attempts = QuizAttemptRepository(db)
        self.attendance_service = AttendanceService(db)

    def _student_and_class(self, tenant_id: uuid.UUID, student_id: uuid.UUID):
        found = self.student_profiles.get_with_user(tenant_id, student_id)
        if found is None:
            raise NotFoundError("Student not found")
        profile, user = found
        class_name = "—"
        if profile.class_grade_id is not None:
            class_grade = self.class_grades.get_by_id(tenant_id, profile.class_grade_id)
            if class_grade is not None:
                class_name = class_grade.name
        return profile, user, class_name

    def _tenant_name(self, tenant_id: uuid.UUID) -> str:
        tenant = self.tenants.get_by_id(tenant_id)
        return tenant.name if tenant is not None else "Academy"

    def generate_report_card(
        self, tenant_id: uuid.UUID, student_id: uuid.UUID, period_month: int, period_year: int
    ) -> bytes:
        profile, user, class_name = self._student_and_class(tenant_id, student_id)
        tenant_name = self._tenant_name(tenant_id)

        attendance_summary = self.attendance_service.get_student_monthly_summary(
            tenant_id, student_id, period_month, period_year
        )

        assignments_out: list[dict] = []
        if profile.section_id is not None:
            for a in self.assignments.list_assignments(tenant_id, section_id=profile.section_id):
                if a.due_date.month != period_month or a.due_date.year != period_year:
                    continue
                submission = self.submissions.get_for_assignment_student(tenant_id, a.id, student_id)
                assignments_out.append(
                    {
                        "title": a.title,
                        "marks_obtained": float(submission.marks_obtained) if submission and submission.marks_obtained is not None else None,
                        "max_marks": float(a.max_marks) if a.max_marks is not None else 0.0,
                    }
                )

        quizzes_out: list[dict] = []
        graded_percentages: list[float] = []
        for attempt in self.quiz_attempts.list_for_student(tenant_id, student_id):
            if attempt.submitted_at is None or attempt.submitted_at.month != period_month or attempt.submitted_at.year != period_year:
                continue
            quiz = self.quizzes.get_by_id(tenant_id, attempt.quiz_id)
            quizzes_out.append(
                {
                    "title": quiz.title if quiz is not None else "Quiz",
                    "score": float(attempt.score) if attempt.score is not None else None,
                    "max_score": float(attempt.max_score),
                }
            )
            if attempt.status == AttemptStatus.GRADED and attempt.score is not None and attempt.max_score:
                graded_percentages.append(float(attempt.score) / float(attempt.max_score) * 100)

        assignment_percentages = [
            (a["marks_obtained"] / a["max_marks"]) * 100
            for a in assignments_out
            if a["marks_obtained"] is not None and a["max_marks"]
        ]
        all_percentages = assignment_percentages + graded_percentages
        overall_percent = round(sum(all_percentages) / len(all_percentages), 1) if all_percentages else None

        return render_report_card(
            tenant_name=tenant_name,
            student_name=user.full_name,
            class_name=class_name,
            roll_number=profile.roll_number,
            admission_number=profile.admission_number,
            period_label=f"{date(period_year, period_month, 1).strftime('%B %Y')}",
            attendance_percent=attendance_summary["percentage"],
            assignments=assignments_out,
            quizzes=quizzes_out,
            overall_percent=overall_percent,
            grade=letter_grade(overall_percent) if overall_percent is not None else None,
        )

    def generate_id_card(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> bytes:
        profile, user, class_name = self._student_and_class(tenant_id, student_id)
        return render_id_card(
            tenant_name=self._tenant_name(tenant_id),
            student_name=user.full_name,
            class_name=class_name,
            roll_number=profile.roll_number,
            admission_number=profile.admission_number,
        )

    def generate_certificate(self, tenant_id: uuid.UUID, student_id: uuid.UUID, achievement_text: str) -> bytes:
        _profile, user, class_name = self._student_and_class(tenant_id, student_id)
        return render_certificate(
            tenant_name=self._tenant_name(tenant_id),
            student_name=user.full_name,
            class_name=class_name,
            achievement_text=achievement_text,
            issue_date=date.today(),
        )
