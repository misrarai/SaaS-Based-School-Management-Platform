"""add email notification channel and events

Revision ID: b7c1e9f3a204
Revises: a1b2c3d4e5f6
Create Date: 2026-09-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c1e9f3a204'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('notification_logs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('recipient_email', sa.String(length=255), nullable=True))
        batch_op.alter_column(
            'channel',
            existing_type=sa.Enum('WHATSAPP', name='notificationchannel'),
            type_=sa.Enum('WHATSAPP', 'EMAIL', name='notificationchannel'),
            existing_nullable=False,
        )
        batch_op.alter_column(
            'event',
            existing_type=sa.Enum('ATTENDANCE_ABSENT', 'PAYMENT_VERIFIED', 'FEE_DUE_REMINDER', 'BROADCAST', name='notificationevent'),
            type_=sa.Enum(
                'ATTENDANCE_ABSENT', 'PAYMENT_VERIFIED', 'FEE_DUE_REMINDER', 'BROADCAST',
                'REPORT_CARD', 'CUSTOM_EMAIL', name='notificationevent',
            ),
            existing_nullable=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('notification_logs', schema=None) as batch_op:
        batch_op.alter_column(
            'event',
            existing_type=sa.Enum(
                'ATTENDANCE_ABSENT', 'PAYMENT_VERIFIED', 'FEE_DUE_REMINDER', 'BROADCAST',
                'REPORT_CARD', 'CUSTOM_EMAIL', name='notificationevent',
            ),
            type_=sa.Enum('ATTENDANCE_ABSENT', 'PAYMENT_VERIFIED', 'FEE_DUE_REMINDER', 'BROADCAST', name='notificationevent'),
            existing_nullable=False,
        )
        batch_op.alter_column(
            'channel',
            existing_type=sa.Enum('WHATSAPP', 'EMAIL', name='notificationchannel'),
            type_=sa.Enum('WHATSAPP', name='notificationchannel'),
            existing_nullable=False,
        )
        batch_op.drop_column('recipient_email')
