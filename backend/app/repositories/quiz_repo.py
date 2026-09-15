import uuid

from sqlalchemy import select

from app.models.quiz import Quiz, QuizAnswer, QuizAttempt, QuizOption, QuizQuestion
from app.repositories.base import BaseRepository


class QuizRepository(BaseRepository[Quiz]):
    model = Quiz

    def list_quizzes(
        self,
        tenant_id: uuid.UUID,
        section_id: uuid.UUID | None = None,
        subject_id: uuid.UUID | None = None,
        teacher_id: uuid.UUID | None = None,
        published_only: bool = False,
        chapter_id: uuid.UUID | None = None,
    ) -> list[Quiz]:
        stmt = select(Quiz).where(Quiz.tenant_id == tenant_id)
        if section_id is not None:
            stmt = stmt.where(Quiz.section_id == section_id)
        if subject_id is not None:
            stmt = stmt.where(Quiz.subject_id == subject_id)
        if teacher_id is not None:
            stmt = stmt.where(Quiz.teacher_id == teacher_id)
        if published_only:
            stmt = stmt.where(Quiz.is_published.is_(True))
        if chapter_id is not None:
            stmt = stmt.where(Quiz.chapter_id == chapter_id)
        stmt = stmt.order_by(Quiz.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def list_by_chapter(self, tenant_id: uuid.UUID, chapter_id: uuid.UUID) -> list[Quiz]:
        stmt = (
            select(Quiz)
            .where(Quiz.tenant_id == tenant_id, Quiz.chapter_id == chapter_id)
            .order_by(Quiz.created_at)
        )
        return list(self.db.execute(stmt).scalars().all())


class QuizQuestionRepository(BaseRepository[QuizQuestion]):
    model = QuizQuestion

    def list_for_quiz(self, tenant_id: uuid.UUID, quiz_id: uuid.UUID) -> list[QuizQuestion]:
        stmt = (
            select(QuizQuestion)
            .where(QuizQuestion.tenant_id == tenant_id, QuizQuestion.quiz_id == quiz_id)
            .order_by(QuizQuestion.order_index)
        )
        return list(self.db.execute(stmt).scalars().all())


class QuizOptionRepository(BaseRepository[QuizOption]):
    model = QuizOption

    def list_for_questions(self, tenant_id: uuid.UUID, question_ids: list[uuid.UUID]) -> list[QuizOption]:
        if not question_ids:
            return []
        stmt = (
            select(QuizOption)
            .where(QuizOption.tenant_id == tenant_id, QuizOption.question_id.in_(question_ids))
            .order_by(QuizOption.order_index)
        )
        return list(self.db.execute(stmt).scalars().all())


class QuizAttemptRepository(BaseRepository[QuizAttempt]):
    model = QuizAttempt

    def get_for_quiz_student(
        self, tenant_id: uuid.UUID, quiz_id: uuid.UUID, student_id: uuid.UUID
    ) -> QuizAttempt | None:
        stmt = select(QuizAttempt).where(
            QuizAttempt.tenant_id == tenant_id, QuizAttempt.quiz_id == quiz_id, QuizAttempt.student_id == student_id
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_for_quiz(self, tenant_id: uuid.UUID, quiz_id: uuid.UUID) -> list[QuizAttempt]:
        stmt = select(QuizAttempt).where(QuizAttempt.tenant_id == tenant_id, QuizAttempt.quiz_id == quiz_id)
        return list(self.db.execute(stmt).scalars().all())

    def list_for_student(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> list[QuizAttempt]:
        stmt = select(QuizAttempt).where(QuizAttempt.tenant_id == tenant_id, QuizAttempt.student_id == student_id)
        return list(self.db.execute(stmt).scalars().all())


class QuizAnswerRepository(BaseRepository[QuizAnswer]):
    model = QuizAnswer

    def list_for_attempt(self, tenant_id: uuid.UUID, attempt_id: uuid.UUID) -> list[QuizAnswer]:
        stmt = select(QuizAnswer).where(QuizAnswer.tenant_id == tenant_id, QuizAnswer.attempt_id == attempt_id)
        return list(self.db.execute(stmt).scalars().all())
