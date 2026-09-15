import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.quiz import AttemptStatus
from app.repositories.assignment_repo import AssignmentRepository, AssignmentSubmissionRepository
from app.repositories.quiz_repo import QuizAttemptRepository
from app.repositories.student_repo import StudentProfileRepository
from app.services.attendance_service import AttendanceService


class ProgressService:
    """Composes attendance/assignments/quizzes into a derived view — no badge table, no
    progress table. Badges are simple threshold rules evaluated fresh on every call."""

    def __init__(self, db: Session):
        self.db = db
        self.student_profiles = StudentProfileRepository(db)
        self.assignments = AssignmentRepository(db)
        self.submissions = AssignmentSubmissionRepository(db)
        self.quiz_attempts = QuizAttemptRepository(db)
        self.attendance_service = AttendanceService(db)

    def get_progress(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> dict:
        student = self.student_profiles.get_by_id(tenant_id, student_id)
        if student is None:
            raise NotFoundError("Student not found")

        today = date.today()
        attendance_summary = self.attendance_service.get_student_monthly_summary(
            tenant_id, student_id, today.month, today.year
        )
        attendance_percent = attendance_summary["percentage"]

        assignment_completion_percent = 0.0
        if student.section_id is not None:
            assignments = self.assignments.list_assignments(tenant_id, section_id=student.section_id)
            if assignments:
                submissions = self.submissions.list_for_student(tenant_id, student_id)
                submitted_ids = {s.assignment_id for s in submissions}
                assignment_ids = {a.id for a in assignments}
                assignment_completion_percent = round(100 * len(submitted_ids & assignment_ids) / len(assignments), 1)

        # GRADED, not just SUBMITTED — a quiz with short-answer questions stays SUBMITTED (and
        # score is None) until a teacher finishes grading it, so it shouldn't count yet.
        graded_attempts = [
            a for a in self.quiz_attempts.list_for_student(tenant_id, student_id) if a.status == AttemptStatus.GRADED
        ]
        quiz_average_percent = 0.0
        if graded_attempts:
            percentages = [
                float(a.score) / float(a.max_score) * 100 for a in graded_attempts if a.score is not None and a.max_score
            ]
            if percentages:
                quiz_average_percent = round(sum(percentages) / len(percentages), 1)

        badges = [
            {"code": "attendance_star", "label": "Attendance Star", "achieved": attendance_percent >= 90},
            {
                "code": "perfect_attendance",
                "label": "Perfect Attendance",
                "achieved": attendance_summary["total"] > 0 and attendance_percent == 100,
            },
            {"code": "homework_hero", "label": "Homework Hero", "achieved": assignment_completion_percent >= 90},
            {"code": "quiz_ace", "label": "Quiz Ace", "achieved": quiz_average_percent >= 90},
        ]

        return {
            "attendance_percent": attendance_percent,
            "assignment_completion_percent": assignment_completion_percent,
            "quiz_average_percent": quiz_average_percent,
            "badges": badges,
        }
