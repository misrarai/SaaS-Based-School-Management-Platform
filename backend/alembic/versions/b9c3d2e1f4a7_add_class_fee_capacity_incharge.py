"""add class_fee, capacity, incharge to class_grades

Revision ID: b9c3d2e1f4a7
Revises: f3035e0e3364
Create Date: 2026-10-14 18:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
import app.models.mixins  # GUID custom type

revision = 'b9c3d2e1f4a7'
down_revision = 'f3035e0e3364'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('class_grades', schema=None) as batch_op:
        batch_op.add_column(sa.Column('class_fee', sa.Numeric(12, 2), nullable=True))
        batch_op.add_column(sa.Column('capacity', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('incharge_id', app.models.mixins.GUID(), nullable=True))
        batch_op.add_column(sa.Column('assistant_incharge_id', app.models.mixins.GUID(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('class_grades', schema=None) as batch_op:
        batch_op.drop_column('assistant_incharge_id')
        batch_op.drop_column('incharge_id')
        batch_op.drop_column('capacity')
        batch_op.drop_column('class_fee')
