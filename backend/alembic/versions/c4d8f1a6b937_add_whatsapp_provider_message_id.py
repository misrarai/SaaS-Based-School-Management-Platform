"""add whatsapp provider message id and admin notification event

Revision ID: c4d8f1a6b937
Revises: b7c1e9f3a204
Create Date: 2026-09-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4d8f1a6b937'
down_revision: Union[str, Sequence[str], None] = 'b7c1e9f3a204'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('notification_logs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('provider_message_id', sa.String(length=100), nullable=True))
        batch_op.alter_column(
            'event',
            existing_type=sa.Enum(
                'ATTENDANCE_ABSENT', 'PAYMENT_VERIFIED', 'FEE_DUE_REMINDER', 'BROADCAST',
                'REPORT_CARD', 'CUSTOM_EMAIL', name='notificationevent',
            ),
            type_=sa.Enum(
                'ATTENDANCE_ABSENT', 'PAYMENT_VERIFIED', 'FEE_DUE_REMINDER', 'BROADCAST',
                'REPORT_CARD', 'CUSTOM_EMAIL', 'ADMIN_NOTIFICATION', name='notificationevent',
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
                'REPORT_CARD', 'CUSTOM_EMAIL', 'ADMIN_NOTIFICATION', name='notificationevent',
            ),
            type_=sa.Enum(
                'ATTENDANCE_ABSENT', 'PAYMENT_VERIFIED', 'FEE_DUE_REMINDER', 'BROADCAST',
                'REPORT_CARD', 'CUSTOM_EMAIL', name='notificationevent',
            ),
            existing_nullable=False,
        )
        batch_op.drop_column('provider_message_id')
