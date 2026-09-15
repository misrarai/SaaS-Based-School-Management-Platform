"""add auth verification and password reset fields to users

Revision ID: f2a7c9d13e05
Revises: 4b28b8f0c459
Create Date: 2026-08-26 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2a7c9d13e05'
down_revision: Union[str, Sequence[str], None] = '4b28b8f0c459'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.true()))
        batch_op.add_column(sa.Column('email_verification_token_hash', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('email_verification_expires_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('password_reset_token_hash', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('password_reset_expires_at', sa.DateTime(timezone=True), nullable=True))

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column('is_verified', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('password_reset_expires_at')
        batch_op.drop_column('password_reset_token_hash')
        batch_op.drop_column('email_verification_expires_at')
        batch_op.drop_column('email_verification_token_hash')
        batch_op.drop_column('is_verified')
