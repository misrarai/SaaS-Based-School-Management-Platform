import uuid
from datetime import date

from pydantic import BaseModel, Field, model_validator

TYPE_PATTERN = r"^(public|school|exam|event)$"


class HolidayCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    from_date: date
    to_date: date | None = None
    holiday_type: str = Field(default="public", pattern=TYPE_PATTERN)
    description: str | None = Field(default=None, max_length=255)
    is_recurring: bool = False

    @model_validator(mode="after")
    def default_to_date(self) -> "HolidayCreate":
        if self.to_date is None:
            self.to_date = self.from_date
        if self.to_date < self.from_date:
            raise ValueError("to_date cannot be before from_date")
        return self


class HolidayUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=150)
    from_date: date | None = None
    to_date: date | None = None
    holiday_type: str | None = Field(default=None, pattern=TYPE_PATTERN)
    description: str | None = None
    is_recurring: bool | None = None


class HolidayOut(BaseModel):
    id: uuid.UUID
    name: str
    from_date: date
    to_date: date
    holiday_type: str
    description: str | None
    is_recurring: bool
    days: int = 1

    model_config = {"from_attributes": True}
