import uuid

from pydantic import BaseModel, Field

ON_FAIL_PATTERN = r"^(repeat|graduate)$"


class PromotionRuleCreate(BaseModel):
    source_class_id: uuid.UUID
    target_class_id: uuid.UUID | None = None
    pass_mark: int | None = Field(default=None, ge=0, le=100)
    on_fail: str = Field(default="repeat", pattern=ON_FAIL_PATTERN)


class PromotionRuleUpdate(BaseModel):
    target_class_id: uuid.UUID | None = None
    pass_mark: int | None = Field(default=None, ge=0, le=100)
    on_fail: str | None = Field(default=None, pattern=ON_FAIL_PATTERN)
    is_active: bool | None = None


class PromotionRuleOut(BaseModel):
    id: uuid.UUID
    source_class_id: uuid.UUID
    source_class_name: str | None
    target_class_id: uuid.UUID | None
    target_class_name: str | None
    pass_mark: int | None
    on_fail: str
    is_active: bool

    model_config = {"from_attributes": True}


class PromotionCandidate(BaseModel):
    student_id: uuid.UUID
    full_name: str
    admission_number: str | None
    roll_number: str | None
    section_name: str | None


class PromotionExecute(BaseModel):
    source_class_id: uuid.UUID
    target_class_id: uuid.UUID | None = None
    student_ids: list[uuid.UUID] = Field(min_length=1)


class PromotionResult(BaseModel):
    promoted: int
    graduated: int
