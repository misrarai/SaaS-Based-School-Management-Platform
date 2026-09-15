from pydantic import BaseModel


class BadgeOut(BaseModel):
    code: str
    label: str
    achieved: bool


class ProgressOut(BaseModel):
    attendance_percent: float
    assignment_completion_percent: float
    quiz_average_percent: float
    badges: list[BadgeOut]
