"""CLI bootstrap commands for platform administration."""
import sys
import uuid

import click
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.tenant import Tenant
from app.models.user import RoleEnum, User
from app.core.security import hash_password
from app.repositories.tenant_repo import TenantRepository
from app.repositories.user_repo import UserRepository

PLATFORM_TENANT_SLUG = "platform"
PLATFORM_TENANT_NAME = "Platform Administration"


def _get_or_create_platform_tenant(db: Session) -> Tenant:
    repo = TenantRepository(db)
    tenant = repo.get_by_slug(PLATFORM_TENANT_SLUG)
    if tenant is None:
        tenant = Tenant(
            name=PLATFORM_TENANT_NAME,
            slug=PLATFORM_TENANT_SLUG,
            contact_email="platform@localhost",
            plan="platform",
            is_active=True,
        )
        repo.create(tenant)
        db.commit()
        db.refresh(tenant)
        click.echo(f"Created platform tenant (id={tenant.id})")
    return tenant


@click.group()
def cli() -> None:
    """School Management SaaS — platform CLI."""


@cli.command("create-super-admin")
@click.option("--email", prompt="Super admin email", help="Email address for the super admin account")
@click.option("--password", prompt="Password", hide_input=True, confirmation_prompt=True, help="Password (min 8 chars)")
@click.option("--name", prompt="Full name", default="Platform Admin", help="Display name")
def create_super_admin(email: str, password: str, name: str) -> None:
    """Seed the first super admin account."""
    if len(password) < 8:
        click.echo("Error: password must be at least 8 characters", err=True)
        sys.exit(1)

    db: Session = next(get_db())
    try:
        tenant = _get_or_create_platform_tenant(db)
        user_repo = UserRepository(db)

        existing = user_repo.get_by_email(tenant.id, email.lower())
        if existing is not None:
            if existing.role == RoleEnum.SUPER_ADMIN:
                click.echo(f"Super admin '{email}' already exists.")
            else:
                click.echo(f"Error: email '{email}' already used by a non-super-admin account.", err=True)
                sys.exit(1)
            return

        user = User(
            tenant_id=tenant.id,
            email=email.lower(),
            hashed_password=hash_password(password),
            full_name=name,
            role=RoleEnum.SUPER_ADMIN,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        click.echo(f"Super admin created: {user.email} (id={user.id})")
        click.echo(f"Login with tenant slug: '{PLATFORM_TENANT_SLUG}'")
    finally:
        db.close()


if __name__ == "__main__":
    cli()
