import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.assignment import Assignment, AssignmentSubmission
from app.repositories.academic_repo import SectionRepository, SubjectRepository
from app.repositories.assignment_repo import AssignmentRepository, AssignmentSubmissionRepository
from app.repositories.schedule_repo import ClassScheduleRepository
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.teacher_repo import TeacherProfileRepository
from app.schemas.assignment import AssignmentCreate, GradeSubmissionRequest


def _as_aware_utc(dt: datetime) -> datetime:
    """SQLite round-trips DateTime(timezone=True) columns as naive, even though the value
    was written as UTC-aware — normalize before comparing against an aware datetime.now()."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


class AssignmentService:
    def __init__(self, db: Session):
        self.db = db
        self.assignments = AssignmentRepository(db)
        self.submissions = AssignmentSubmissionRepository(db)
        self.sections = SectionRepository(db)
        self.subjects = SubjectRepository(db)
        self.schedules = ClassScheduleRepository(db)
        self.teachers = TeacherProfileRepository(db)
        self.student_profiles = StudentProfileRepository(db)

    def _teacher_profile_or_403(self, tenant_id: uuid.UUID, user_id: uuid.UUID):
        profile = self.teachers.get_by_user_id(tenant_id, user_id)
        if profile is None:
            raise ForbiddenError("Not a teacher")
        return profile

    def _assert_teacher_teaches(
        self, tenant_id: uuid.UUID, teacher_id: uuid.UUID, section_id: uuid.UUID, subject_id: uuid.UUID
    ) -> None:
        """A teacher may set homework for a section+subject only if the admin has scheduled
        them for it — class_schedules is the source of truth here, not TeacherAssignment/Course,
        since scheduling predates the Course model and assignments are keyed by section+subject
        directly rather than by course_id."""
        schedules = self.schedules.list(tenant_id)
        matches = any(
            s.teacher_id == teacher_id and s.section_id == section_id and s.subject_id == subject_id
            for s in schedules
        )
        if not matches:
            raise ForbiddenError("You are not scheduled to teach this class/subject")

    def create_assignment(
        self, tenant_id: uuid.UUID, teacher_user_id: uuid.UUID, payload: AssignmentCreate
    ) -> Assignment:
        teacher_profile = self._teacher_profile_or_403(tenant_id, teacher_user_id)
        if self.sections.get_by_id(tenant_id, payload.section_id) is None:
            raise NotFoundError("Section not found")
        if self.subjects.get_by_id(tenant_id, payload.subject_id) is None:
            raise NotFoundError("Subject not found")
        self._assert_teacher_teaches(tenant_id, teacher_profile.id, payload.section_id, payload.subject_id)

        assignment = self.assignments.create(
            Assignment(
                tenant_id=tenant_id,
                section_id=payload.section_id,
                subject_id=payload.subject_id,
                teacher_id=teacher_profile.id,
                title=payload.title,
                description=payload.description,
                instructions_file_url=payload.instructions_file_url,
                due_date=payload.due_date,
                max_marks=payload.max_marks,
            )
        )
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def get_assignment_or_404(self, tenant_id: uuid.UUID, assignment_id: uuid.UUID) -> Assignment:
        assignment = self.assignments.get_by_id(tenant_id, assignment_id)
        if assignment is None:
            raise NotFoundError("Assignment not found")
        return assignment

    def list_assignments(
        self,
        tenant_id: uuid.UUID,
        section_id: uuid.UUID | None = None,
        subject_id: uuid.UUID | None = None,
        teacher_id: uuid.UUID | None = None,
    ) -> list[Assignment]:
        return self.assignments.list_assignments(
            tenant_id, section_id=section_id, subject_id=subject_id, teacher_id=teacher_id
        )

    def submit_assignment(
        self, tenant_id: uuid.UUID, assignment_id: uuid.UUID, student_user_id: uuid.UUID, file_url: str
    ) -> AssignmentSubmission:
        assignment = self.get_assignment_or_404(tenant_id, assignment_id)
        student = self.student_profiles.get_by_user_id(tenant_id, student_user_id)
        if student is None:
            raise ForbiddenError("Not a student")
        if student.section_id != assignment.section_id:
            raise ForbiddenError("This assignment is not for your section")

        now = datetime.now(timezone.utc)
        is_late = now > _as_aware_utc(assignment.due_date)

        existing = self.submissions.get_for_assignment_student(tenant_id, assignment_id, student.id)
        if existing is not None:
            existing.submitted_file_url = file_url
            existing.submitted_at = now
            existing.is_late = is_late
            submission = existing
        else:
            submission = self.submissions.create(
                AssignmentSubmission(
                    tenant_id=tenant_id,
                    assignment_id=assignment_id,
                    student_id=student.id,
                    submitted_file_url=file_url,
                    submitted_at=now,
                    is_late=is_late,
                )
            )
        self.db.commit()
        self.db.refresh(submission)
        return submission

    def list_submissions(
        self, tenant_id: uuid.UUID, assignment_id: uuid.UUID, teacher_user_id: uuid.UUID
    ) -> list[AssignmentSubmission]:
        assignment = self.get_assignment_or_404(tenant_id, assignment_id)
        teacher_profile = self._teacher_profile_or_403(tenant_id, teacher_user_id)
        if assignment.teacher_id != teacher_profile.id:
            raise ForbiddenError("Not your assignment")
        return self.submissions.list_for_assignment(tenant_id, assignment_id)

    def list_submissions_any(self, tenant_id: uuid.UUID, assignment_id: uuid.UUID) -> list[AssignmentSubmission]:
        self.get_assignment_or_404(tenant_id, assignment_id)
        return self.submissions.list_for_assignment(tenant_id, assignment_id)

    def grade_submission(
        self,
        tenant_id: uuid.UUID,
        submission_id: uuid.UUID,
        teacher_user_id: uuid.UUID,
        payload: GradeSubmissionRequest,
    ) -> AssignmentSubmission:
        submission = self.submissions.get_by_id(tenant_id, submission_id)
        if submission is None:
            raise NotFoundError("Submission not found")
        assignment = self.get_assignment_or_404(tenant_id, submission.assignment_id)
        teacher_profile = self._teacher_profile_or_403(tenant_id, teacher_user_id)
        if assignment.teacher_id != teacher_profile.id:
            raise ForbiddenError("Not your assignment")
        if assignment.max_marks is not None and payload.marks_obtained > float(assignment.max_marks):
            raise ConflictError("Marks obtained cannot exceed max marks")

        submission.marks_obtained = payload.marks_obtained
        submission.teacher_feedback = payload.teacher_feedback
        submission.graded_by_user_id = teacher_user_id
        submission.graded_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(submission)
        return submission

    def get_gradebook(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> list[dict]:
        submissions = self.submissions.list_for_student(tenant_id, student_id)
        entries = []
        for sub in submissions:
            if sub.marks_obtained is None:
                continue
            assignment = self.assignments.get_by_id(tenant_id, sub.assignment_id)
            if assignment is None:
                continue
            entries.append(
                {
                    "assignment_id": assignment.id,
                    "assignment_title": assignment.title,
                    "subject_id": assignment.subject_id,
                    "max_marks": assignment.max_marks,
                    "marks_obtained": sub.marks_obtained,
                    "due_date": assignment.due_date,
                    "graded_at": sub.graded_at,
                    "teacher_feedback": sub.teacher_feedback,
                }
            )
        entries.sort(key=lambda e: e["due_date"], reverse=True)
        return entries

    def get_subject_performance(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> list[dict]:
        """One row per subject with graded work — a simplified 'how are they doing in each
        subject' view for parents, distinct from the per-assignment gradebook."""
        by_subject: dict[uuid.UUID, list[dict]] = {}
        for entry in self.get_gradebook(tenant_id, student_id):
            if entry["max_marks"] is None:
                continue
            by_subject.setdefault(entry["subject_id"], []).append(entry)

        results = []
        for subject_id, entries in by_subject.items():
            subject = self.subjects.get_by_id(tenant_id, subject_id)
            total_obtained = sum(e["marks_obtained"] for e in entries)
            total_max = sum(e["max_marks"] for e in entries)
            average_percent = round((total_obtained / total_max) * 100, 1) if total_max else None
            results.append(
                {
                    "subject_id": subject_id,
                    "subject_name": subject.name if subject else "Unknown subject",
                    "average_percent": average_percent,
                }
            )
        results.sort(key=lambda r: r["subject_name"])
        return results
