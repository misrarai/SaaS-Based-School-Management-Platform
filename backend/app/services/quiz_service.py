import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.quiz import AttemptStatus, QuestionType, Quiz, QuizAnswer, QuizAttempt, QuizOption, QuizQuestion
from app.repositories.academic_repo import SectionRepository, SubjectRepository
from app.repositories.quiz_repo import (
    QuizAnswerRepository,
    QuizAttemptRepository,
    QuizOptionRepository,
    QuizQuestionRepository,
    QuizRepository,
)
from app.repositories.schedule_repo import ClassScheduleRepository
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.teacher_repo import TeacherProfileRepository
from app.schemas.quiz import GradeAttemptRequest, QuizCreate, QuizUpdate, SubmitAttemptRequest


class QuizService:
    def __init__(self, db: Session):
        self.db = db
        self.quizzes = QuizRepository(db)
        self.questions = QuizQuestionRepository(db)
        self.options = QuizOptionRepository(db)
        self.attempts = QuizAttemptRepository(db)
        self.answers = QuizAnswerRepository(db)
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
        """Same class_schedules-as-source-of-truth check used for assignments — see
        AssignmentService._assert_teacher_teaches for why this doesn't go through Course/
        TeacherAssignment instead."""
        schedules = self.schedules.list(tenant_id)
        matches = any(
            s.teacher_id == teacher_id and s.section_id == section_id and s.subject_id == subject_id
            for s in schedules
        )
        if not matches:
            raise ForbiddenError("You are not scheduled to teach this class/subject")

    def create_quiz(self, tenant_id: uuid.UUID, teacher_user_id: uuid.UUID, payload: QuizCreate) -> Quiz:
        teacher_profile = self._teacher_profile_or_403(tenant_id, teacher_user_id)
        if self.sections.get_by_id(tenant_id, payload.section_id) is None:
            raise NotFoundError("Section not found")
        if self.subjects.get_by_id(tenant_id, payload.subject_id) is None:
            raise NotFoundError("Subject not found")
        self._assert_teacher_teaches(tenant_id, teacher_profile.id, payload.section_id, payload.subject_id)

        quiz = self.quizzes.create(
            Quiz(
                tenant_id=tenant_id,
                section_id=payload.section_id,
                subject_id=payload.subject_id,
                teacher_id=teacher_profile.id,
                chapter_id=payload.chapter_id,
                title=payload.title,
                description=payload.description,
                time_limit_minutes=payload.time_limit_minutes,
                due_date=payload.due_date,
            )
        )
        self.db.flush()

        for q_index, q in enumerate(payload.questions):
            question = self.questions.create(
                QuizQuestion(
                    tenant_id=tenant_id,
                    quiz_id=quiz.id,
                    question_text=q.question_text,
                    question_type=q.question_type,
                    order_index=q_index,
                    marks=q.marks,
                )
            )
            self.db.flush()
            for o_index, o in enumerate(q.options):
                self.options.create(
                    QuizOption(
                        tenant_id=tenant_id,
                        question_id=question.id,
                        option_text=o.option_text,
                        is_correct=o.is_correct,
                        order_index=o_index,
                    )
                )

        self.db.commit()
        self.db.refresh(quiz)
        return quiz

    def get_quiz_or_404(self, tenant_id: uuid.UUID, quiz_id: uuid.UUID) -> Quiz:
        quiz = self.quizzes.get_by_id(tenant_id, quiz_id)
        if quiz is None:
            raise NotFoundError("Quiz not found")
        return quiz

    def list_quizzes(
        self,
        tenant_id: uuid.UUID,
        section_id: uuid.UUID | None = None,
        subject_id: uuid.UUID | None = None,
        teacher_id: uuid.UUID | None = None,
        published_only: bool = False,
        chapter_id: uuid.UUID | None = None,
    ) -> list[Quiz]:
        return self.quizzes.list_quizzes(
            tenant_id,
            section_id=section_id,
            subject_id=subject_id,
            teacher_id=teacher_id,
            published_only=published_only,
            chapter_id=chapter_id,
        )

    def update_quiz(self, tenant_id: uuid.UUID, quiz_id: uuid.UUID, teacher_user_id: uuid.UUID, payload: QuizUpdate) -> Quiz:
        quiz = self.get_quiz_or_404(tenant_id, quiz_id)
        teacher_profile = self._teacher_profile_or_403(tenant_id, teacher_user_id)
        if quiz.teacher_id != teacher_profile.id:
            raise ForbiddenError("Not your quiz")
        if payload.is_published is not None:
            quiz.is_published = payload.is_published
        self.db.commit()
        self.db.refresh(quiz)
        return quiz

    def _questions_with_options(
        self, tenant_id: uuid.UUID, quiz_id: uuid.UUID
    ) -> tuple[list[QuizQuestion], dict[uuid.UUID, list[QuizOption]]]:
        questions = self.questions.list_for_quiz(tenant_id, quiz_id)
        options = self.options.list_for_questions(tenant_id, [q.id for q in questions])
        options_by_question: dict[uuid.UUID, list[QuizOption]] = {}
        for o in options:
            options_by_question.setdefault(o.question_id, []).append(o)
        return questions, options_by_question

    def _assert_student_in_section(self, tenant_id: uuid.UUID, student_user_id: uuid.UUID, section_id: uuid.UUID):
        student = self.student_profiles.get_by_user_id(tenant_id, student_user_id)
        if student is None or student.section_id != section_id:
            raise ForbiddenError("This quiz is not for your section")
        return student

    def get_quiz_for_taking(self, tenant_id: uuid.UUID, quiz_id: uuid.UUID, student_user_id: uuid.UUID) -> dict:
        quiz = self.get_quiz_or_404(tenant_id, quiz_id)
        if not quiz.is_published:
            raise NotFoundError("Quiz not found")
        self._assert_student_in_section(tenant_id, student_user_id, quiz.section_id)

        questions, options_by_question = self._questions_with_options(tenant_id, quiz_id)
        return {
            "id": quiz.id,
            "title": quiz.title,
            "description": quiz.description,
            "time_limit_minutes": quiz.time_limit_minutes,
            "due_date": quiz.due_date,
            "questions": [
                {
                    "id": q.id,
                    "question_text": q.question_text,
                    "question_type": q.question_type,
                    "order_index": q.order_index,
                    "marks": q.marks,
                    "options": [
                        {"id": o.id, "option_text": o.option_text, "order_index": o.order_index}
                        for o in sorted(options_by_question.get(q.id, []), key=lambda x: x.order_index)
                    ],
                }
                for q in questions
            ],
        }

    def start_attempt(self, tenant_id: uuid.UUID, quiz_id: uuid.UUID, student_user_id: uuid.UUID) -> QuizAttempt:
        quiz = self.get_quiz_or_404(tenant_id, quiz_id)
        if not quiz.is_published:
            raise NotFoundError("Quiz not found")
        student = self._assert_student_in_section(tenant_id, student_user_id, quiz.section_id)

        existing = self.attempts.get_for_quiz_student(tenant_id, quiz_id, student.id)
        if existing is not None:
            return existing

        questions = self.questions.list_for_quiz(tenant_id, quiz_id)
        max_score = sum(float(q.marks) for q in questions)
        attempt = self.attempts.create(
            QuizAttempt(
                tenant_id=tenant_id,
                quiz_id=quiz_id,
                student_id=student.id,
                started_at=datetime.now(timezone.utc),
                max_score=max_score,
            )
        )
        self.db.commit()
        self.db.refresh(attempt)
        return attempt

    def submit_attempt(
        self, tenant_id: uuid.UUID, attempt_id: uuid.UUID, student_user_id: uuid.UUID, payload: SubmitAttemptRequest
    ) -> QuizAttempt:
        attempt = self.attempts.get_by_id(tenant_id, attempt_id)
        if attempt is None:
            raise NotFoundError("Attempt not found")
        student = self.student_profiles.get_by_user_id(tenant_id, student_user_id)
        if student is None or attempt.student_id != student.id:
            raise ForbiddenError("Not your attempt")
        if attempt.status in (AttemptStatus.SUBMITTED, AttemptStatus.GRADED):
            raise ConflictError("This attempt has already been submitted")

        questions, options_by_question = self._questions_with_options(tenant_id, attempt.quiz_id)
        answer_by_question = {a.question_id: a for a in payload.answers}

        running_score = 0.0
        has_ungraded = False
        for question in questions:
            given = answer_by_question.get(question.id)

            if question.question_type == QuestionType.SHORT_ANSWER:
                # Can't be auto-graded — stays pending until a teacher grades it explicitly.
                self.answers.create(
                    QuizAnswer(
                        tenant_id=tenant_id,
                        attempt_id=attempt.id,
                        question_id=question.id,
                        answer_text=given.answer_text if given else None,
                        is_correct=None,
                        marks_awarded=None,
                    )
                )
                has_ungraded = True
                continue

            selected_option_id = given.selected_option_id if given else None
            correct_option = next((o for o in options_by_question.get(question.id, []) if o.is_correct), None)
            is_correct = (
                selected_option_id is not None
                and correct_option is not None
                and selected_option_id == correct_option.id
            )
            marks_awarded = float(question.marks) if is_correct else 0.0
            running_score += marks_awarded
            self.answers.create(
                QuizAnswer(
                    tenant_id=tenant_id,
                    attempt_id=attempt.id,
                    question_id=question.id,
                    selected_option_id=selected_option_id,
                    is_correct=is_correct,
                    marks_awarded=marks_awarded,
                )
            )

        attempt.submitted_at = datetime.now(timezone.utc)
        if has_ungraded:
            # Score stays unknown (not a misleading partial number) until every short-answer
            # question has been graded — see grade_attempt.
            attempt.status = AttemptStatus.SUBMITTED
            attempt.score = None
        else:
            attempt.status = AttemptStatus.GRADED
            attempt.score = running_score
        self.db.commit()
        self.db.refresh(attempt)
        return attempt

    def grade_attempt(
        self, tenant_id: uuid.UUID, attempt_id: uuid.UUID, teacher_user_id: uuid.UUID, payload: GradeAttemptRequest
    ) -> QuizAttempt:
        attempt = self.attempts.get_by_id(tenant_id, attempt_id)
        if attempt is None:
            raise NotFoundError("Attempt not found")
        quiz = self.get_quiz_or_404(tenant_id, attempt.quiz_id)
        teacher_profile = self._teacher_profile_or_403(tenant_id, teacher_user_id)
        if quiz.teacher_id != teacher_profile.id:
            raise ForbiddenError("Not your quiz")
        if attempt.status == AttemptStatus.IN_PROGRESS:
            raise ConflictError("This attempt has not been submitted yet")

        questions_by_id = {q.id: q for q in self.questions.list_for_quiz(tenant_id, attempt.quiz_id)}
        answers_by_question = {a.question_id: a for a in self.answers.list_for_attempt(tenant_id, attempt.id)}

        for grade_in in payload.answers:
            question = questions_by_id.get(grade_in.question_id)
            answer = answers_by_question.get(grade_in.question_id)
            if question is None or answer is None:
                raise NotFoundError("Question not found on this attempt")
            if question.question_type != QuestionType.SHORT_ANSWER:
                raise ConflictError("Only short-answer questions are graded manually")
            if grade_in.marks_awarded > float(question.marks):
                raise ConflictError(f"marks_awarded cannot exceed {question.marks} for this question")
            answer.marks_awarded = grade_in.marks_awarded
            answer.is_correct = grade_in.marks_awarded >= float(question.marks)

        # Recompute from every answer's marks_awarded now on file — finalize only once nothing
        # is left ungraded.
        all_answers = self.answers.list_for_attempt(tenant_id, attempt.id)
        if any(a.marks_awarded is None for a in all_answers):
            attempt.status = AttemptStatus.SUBMITTED
            attempt.score = None
        else:
            attempt.status = AttemptStatus.GRADED
            attempt.score = sum(float(a.marks_awarded) for a in all_answers)

        self.db.commit()
        self.db.refresh(attempt)
        return attempt

    def _build_review(self, tenant_id: uuid.UUID, attempt: QuizAttempt) -> dict:
        questions, options_by_question = self._questions_with_options(tenant_id, attempt.quiz_id)
        answer_by_question = {a.question_id: a for a in self.answers.list_for_attempt(tenant_id, attempt.id)}

        question_reviews = []
        for q in questions:
            answer = answer_by_question.get(q.id)
            question_reviews.append(
                {
                    "id": q.id,
                    "question_text": q.question_text,
                    "question_type": q.question_type,
                    "order_index": q.order_index,
                    "marks": q.marks,
                    "options": [
                        {
                            "id": o.id,
                            "option_text": o.option_text,
                            "order_index": o.order_index,
                            "is_correct": o.is_correct,
                        }
                        for o in sorted(options_by_question.get(q.id, []), key=lambda x: x.order_index)
                    ],
                    "selected_option_id": answer.selected_option_id if answer else None,
                    "answer_text": answer.answer_text if answer else None,
                    "marks_awarded": answer.marks_awarded if answer else None,
                    "is_correct": answer.is_correct if answer else None,
                }
            )

        return {
            "id": attempt.id,
            "quiz_id": attempt.quiz_id,
            "score": attempt.score,
            "max_score": attempt.max_score,
            "status": attempt.status,
            "questions": question_reviews,
        }

    def get_attempt_review_for_teacher(self, tenant_id: uuid.UUID, attempt_id: uuid.UUID, teacher_user_id: uuid.UUID) -> dict:
        attempt = self.attempts.get_by_id(tenant_id, attempt_id)
        if attempt is None:
            raise NotFoundError("Attempt not found")
        quiz = self.get_quiz_or_404(tenant_id, attempt.quiz_id)
        teacher_profile = self._teacher_profile_or_403(tenant_id, teacher_user_id)
        if quiz.teacher_id != teacher_profile.id:
            raise ForbiddenError("Not your quiz")
        return self._build_review(tenant_id, attempt)

    def get_my_attempt_review(self, tenant_id: uuid.UUID, quiz_id: uuid.UUID, student_user_id: uuid.UUID) -> dict:
        student = self.student_profiles.get_by_user_id(tenant_id, student_user_id)
        if student is None:
            raise ForbiddenError("Not a student")
        attempt = self.attempts.get_for_quiz_student(tenant_id, quiz_id, student.id)
        if attempt is None:
            raise NotFoundError("No attempt found")
        return self._build_review(tenant_id, attempt)

    def _build_results(self, tenant_id: uuid.UUID, attempts: list[QuizAttempt]) -> list[dict]:
        results = []
        for attempt in attempts:
            found = self.student_profiles.get_with_user(tenant_id, attempt.student_id)
            student_name = found[1].full_name if found else "Unknown"
            results.append(
                {
                    "attempt_id": attempt.id,
                    "student_id": attempt.student_id,
                    "student_name": student_name,
                    "score": attempt.score,
                    "max_score": attempt.max_score,
                    "status": attempt.status,
                    "submitted_at": attempt.submitted_at,
                    "needs_grading": attempt.status == AttemptStatus.SUBMITTED,
                }
            )
        return results

    def get_results(self, tenant_id: uuid.UUID, quiz_id: uuid.UUID, teacher_user_id: uuid.UUID) -> list[dict]:
        quiz = self.get_quiz_or_404(tenant_id, quiz_id)
        teacher_profile = self._teacher_profile_or_403(tenant_id, teacher_user_id)
        if quiz.teacher_id != teacher_profile.id:
            raise ForbiddenError("Not your quiz")
        return self._build_results(tenant_id, self.attempts.list_for_quiz(tenant_id, quiz_id))

    def get_results_any(self, tenant_id: uuid.UUID, quiz_id: uuid.UUID) -> list[dict]:
        self.get_quiz_or_404(tenant_id, quiz_id)
        return self._build_results(tenant_id, self.attempts.list_for_quiz(tenant_id, quiz_id))

    def list_my_attempts(self, tenant_id: uuid.UUID, student_user_id: uuid.UUID) -> list[dict]:
        """Every attempt the student has started, most recent first — the quiz-history view.
        In-progress attempts are included too (with score=None) so a student can see they still
        have an unfinished quiz, distinct from ones they never started at all."""
        student = self.student_profiles.get_by_user_id(tenant_id, student_user_id)
        if student is None:
            raise ForbiddenError("Not a student")
        attempts = sorted(
            self.attempts.list_for_student(tenant_id, student.id),
            key=lambda a: a.started_at,
            reverse=True,
        )
        results = []
        for attempt in attempts:
            quiz = self.quizzes.get_by_id(tenant_id, attempt.quiz_id)
            results.append(
                {
                    "id": attempt.id,
                    "quiz_id": attempt.quiz_id,
                    "quiz_title": quiz.title if quiz is not None else "Deleted quiz",
                    "student_id": attempt.student_id,
                    "started_at": attempt.started_at,
                    "submitted_at": attempt.submitted_at,
                    "score": attempt.score,
                    "max_score": attempt.max_score,
                    "status": attempt.status,
                }
            )
        return results
