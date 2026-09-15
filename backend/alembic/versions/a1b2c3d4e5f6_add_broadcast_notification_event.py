"""add broadcast notification event

Revision ID: a1b2c3d4e5f6
Revises: e4f6b8c9d741
Create Date: 2026-09-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'e4f6b8c9d741'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('notification_logs', schema=None) as batch_op:
        batch_op.alter_column(
            'event',
            existing_type=sa.Enum('ATTENDANCE_ABSENT', 'PAYMENT_VERIFIED', 'FEE_DUE_REMINDER', name='notificationevent'),
            type_=sa.Enum('ATTENDANCE_ABSENT', 'PAYMENT_VERIFIED', 'FEE_DUE_REMINDER', 'BROADCAST', name='notificationevent'),
            existing_nullable=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('notification_logs', schema=None) as batch_op:
        batch_op.alter_column(
            'event',
            existing_type=sa.Enum('ATTENDANCE_ABSENT', 'PAYMENT_VERIFIED', 'FEE_DUE_REMINDER', 'BROADCAST', name='notificationevent'),
            type_=sa.Enum('ATTENDANCE_ABSENT', 'PAYMENT_VERIFIED', 'FEE_DUE_REMINDER', name='notificationevent'),
            existing_nullable=False,
        )
