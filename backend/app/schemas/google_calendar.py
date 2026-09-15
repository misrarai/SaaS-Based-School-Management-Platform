from pydantic import BaseModel


class GoogleAuthorizationUrlOut(BaseModel):
    authorization_url: str


class GoogleCalendarStatusOut(BaseModel):
    connected: bool
    google_account_email: str | None
    calendar_id: str | None
