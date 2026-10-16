"""tenant bank and branding fields

Revision ID: c4f2a8b1d9e3
Revises: a3c1e7f9b042
Create Date: 2026-10-16 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "c4f2a8b1d9e3"
down_revision = "a3c1e7f9b042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("tenants") as batch_op:
        batch_op.add_column(sa.Column("address", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("phone", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("website", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("bank_name", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("bank_account_title", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("bank_account_number", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("bank_iban", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("bank_branch", sa.String(255), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("tenants") as batch_op:
        batch_op.drop_column("bank_branch")
        batch_op.drop_column("bank_iban")
        batch_op.drop_column("bank_account_number")
        batch_op.drop_column("bank_account_title")
        batch_op.drop_column("bank_name")
        batch_op.drop_column("website")
        batch_op.drop_column("phone")
        batch_op.drop_column("address")
