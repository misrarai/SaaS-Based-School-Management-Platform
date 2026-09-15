"""add short-answer questions and manual grading fields to quiz answers

Revision ID: e4f6b8c9d741
Revises: d9e1a2b4c630
Create Date: 2026-08-26 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4f6b8c9d741'
down_revision: Union[str, Sequence[str], None] = 'd9e1a2b4c630'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('quiz_answers', schema=None) as batch_op:
        batch_op.add_column(sa.Column('answer_text', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('marks_awarded', sa.Numeric(10, 2), nullable=True))

    with op.batch_alter_table('quiz_questions', schema=None) as batch_op:
        batch_op.alter_column(
            'question_type',
            existing_type=sa.Enum('MCQ_SINGLE', 'TRUE_FALSE', name='questiontype'),
            type_=sa.Enum('MCQ_SINGLE', 'TRUE_FALSE', 'SHORT_ANSWER', name='questiontype'),
            existing_nullable=False,
        )

    with op.batch_alter_table('quiz_attempts', schema=None) as batch_op:
        batch_op.alter_column(
            'status',
            existing_type=sa.Enum('IN_PROGRESS', 'SUBMITTED', name='attemptstatus'),
            type_=sa.Enum('IN_PROGRESS', 'SUBMITTED', 'GRADED', name='attemptstatus'),
            existing_nullable=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('quiz_attempts', schema=None) as batch_op:
        batch_op.alter_column(
            'status',
            existing_type=sa.Enum('IN_PROGRESS', 'SUBMITTED', 'GRADED', name='attemptstatus'),
            type_=sa.Enum('IN_PROGRESS', 'SUBMITTED', name='attemptstatus'),
            existing_nullable=False,
        )

    with op.batch_alter_table('quiz_questions', schema=None) as batch_op:
        batch_op.alter_column(
            'question_type',
            existing_type=sa.Enum('MCQ_SINGLE', 'TRUE_FALSE', 'SHORT_ANSWER', name='questiontype'),
            type_=sa.Enum('MCQ_SINGLE', 'TRUE_FALSE', name='questiontype'),
            existing_nullable=False,
        )

    with op.batch_alter_table('quiz_answers', schema=None) as batch_op:
        batch_op.drop_column('marks_awarded')
        batch_op.drop_column('answer_text')
