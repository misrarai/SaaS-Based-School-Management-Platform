"""student enrollment history

Revision ID: a3c1e7f9b042
Revises: b9c3d2e1f4a7
Create Date: 2026-10-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import app.models.mixins  # GUID custom type


revision: str = "a3c1e7f9b042"
down_revision: Union[str, Sequence[str], None] = "b9c3d2e1f4a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "student_enrollments",
        sa.Column("tenant_id", app.models.mixins.GUID(), nullable=False),
        sa.Column("student_id", app.models.mixins.GUID(), nullable=False),
        sa.Column("class_grade_id", app.models.mixins.GUID(), nullable=False),
        sa.Column("section_id", app.models.mixins.GUID(), nullable=True),
        sa.Column("academic_year_id", app.models.mixins.GUID(), nullable=True),
        sa.Column("enrolled_at", sa.Date(), nullable=False),
        sa.Column("left_at", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("id", app.models.mixins.GUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["academic_year_id"], ["academic_years.id"]),
        sa.ForeignKeyConstraint(["class_grade_id"], ["class_grades.id"]),
        sa.ForeignKeyConstraint(["section_id"], ["sections.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["student_profiles.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("student_enrollments", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_student_enrollments_student_id"), ["student_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_student_enrollments_tenant_id"), ["tenant_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("student_enrollments", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_student_enrollments_tenant_id"))
        batch_op.drop_index(batch_op.f("ix_student_enrollments_student_id"))

    op.drop_table("student_enrollments")
