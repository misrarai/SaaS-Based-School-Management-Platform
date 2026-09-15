from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Online Teaching Academy Management & Learning Platform"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str = "sqlite:///./app.db"

    JWT_SECRET: str = "change-me-in-.env-this-is-not-a-secure-default"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_EXPIRE_DAYS: int = 14

    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # Public app URL used to build links inside verification/reset emails.
    FRONTEND_URL: str = "http://localhost:5173"

    # Off by default so admin-provisioned teacher/student/parent accounts (the vast majority —
    # nobody but the admin clicks a link on their behalf) are never locked out. Only the
    # self-service tenant-onboarding admin goes through real email verification; turn this on
    # once the academy has real SMTP credentials and wants to enforce it at login.
    REQUIRE_EMAIL_VERIFICATION: bool = False

    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_USE_TLS: bool = True

    # Meta WhatsApp Business Platform Cloud API — see app/services/whatsapp_service.py.
    WHATSAPP_ACCESS_TOKEN: str | None = None
    WHATSAPP_PHONE_NUMBER_ID: str | None = None
    WHATSAPP_BUSINESS_ACCOUNT_ID: str | None = None
    WHATSAPP_API_VERSION: str = "v21.0"
    WHATSAPP_API_BASE_URL: str = "https://graph.facebook.com"
    # Business-initiated messages outside a 24h customer-service window must use a pre-approved
    # Meta template — see WhatsAppService.send_template. Register this template name/language in
    # the Meta Business Manager before going live; both are configurable, not hard-coded, since
    # the approved name/language is decided per-academy in Meta's own dashboard.
    WHATSAPP_TEMPLATE_NAME: str = "school_notification"
    WHATSAPP_TEMPLATE_LANGUAGE: str = "en_US"

    # JazzCash Payment Gateway (HTTP-POST hosted-checkout integration) — see
    # app/services/jazzcash_service.py. Merchant ID/Password/Integrity Salt and the exact
    # checkout/inquiry URLs come from JazzCash's merchant onboarding (sandbox vs. live differ);
    # the sandbox host below is JazzCash's publicly documented sandbox domain — confirm the exact
    # path against your merchant integration guide before relying on it.
    JAZZCASH_MERCHANT_ID: str | None = None
    JAZZCASH_PASSWORD: str | None = None
    JAZZCASH_INTEGRITY_SALT: str | None = None
    JAZZCASH_CHECKOUT_URL: str = "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/"
    JAZZCASH_INQUIRY_URL: str = "https://sandbox.jazzcash.com.pk/ApplicationAPI/API/2.0/Inquiry/OnlineInquiry"
    JAZZCASH_RETURN_URL: str | None = None  # our backend callback — see payment_gateway.py
    JAZZCASH_VERSION: str = "1.1"
    JAZZCASH_TXN_TYPE: str = "MWALLET"
    JAZZCASH_BANK_ID: str = "TBANK"
    JAZZCASH_PRODUCT_ID: str = "RETL"
    JAZZCASH_TXN_EXPIRY_MINUTES: int = 60

    TWILIO_ACCOUNT_SID: str | None = None
    TWILIO_AUTH_TOKEN: str | None = None
    TWILIO_SMS_FROM: str | None = None

    JITSI_APP_ID: str | None = None
    JITSI_JWT_SECRET: str | None = None
    # Hostname only — no scheme, no trailing slash.
    # Public Jitsi: meet.jit.si  |  Self-hosted: jitsi.yourdomain.com
    JITSI_DOMAIN: str = "meet.jit.si"

    # Google Calendar API (Google Meet link generation) — see app/services/google_calendar_service.py.
    # GOOGLE_CLIENT_ID/SECRET are one OAuth app shared by the whole deployment (created once in
    # Google Cloud Console); each tenant separately authorizes it against their own Google account
    # and that per-tenant refresh token is stored in the google_calendar_connections table, never
    # here — a single school's Google account must never be shared across tenants.
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    GOOGLE_REDIRECT_URI: str | None = None
    # Default calendar for a tenant that hasn't set anything more specific during authorization.
    GOOGLE_CALENDAR_ID: str = "primary"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
