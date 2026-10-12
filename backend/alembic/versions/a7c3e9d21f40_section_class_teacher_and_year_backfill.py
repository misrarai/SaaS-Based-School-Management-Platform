"""section class teacher + link classes to academic years by name

Revision ID: a7c3e9d21f40
Revises: 9fc87082b09d
Create Date: 2026-10-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import app.models.mixins  # GUID custom type


revision: str = 'a7c3e9d21f40'
down_revision: Union[str, Sequence[str], None] = '9fc87082b09d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('sections', schema=None) as batch_op:
        batch_op.add_column(sa.Column('class_teacher_id', app.models.mixins.GUID(), nullable=True))
        batch_op.create_index(batch_op.f('ix_sections_class_teacher_id'), ['class_teacher_id'], unique=False)
        batch_op.create_foreign_key(
            'fk_sections_class_teacher_id_teacher_profiles', 'teacher_profiles', ['class_teacher_id'], ['id']
        )

    # Classes created from the admin UI only carried the free-text year label, so promotion
    # (which filters on academic_year_id) skipped them. Link them to the matching year.
    op.execute(
        """
        UPDATE class_grades
        SET academic_year_id = (
            SELECT ay.id FROM academic_years ay
            WHERE ay.tenant_id = class_grades.tenant_id AND ay.name = class_grades.academic_year
        )
        WHERE academic_year_id IS NULL
        """
    )


def downgrade() -> None:
    with op.batch_alter_table('sections', schema=None) as batch_op:
        batch_op.drop_constraint('fk_sections_class_teacher_id_teacher_profiles', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_sections_class_teacher_id'))
        batch_op.drop_column('class_teacher_id')
