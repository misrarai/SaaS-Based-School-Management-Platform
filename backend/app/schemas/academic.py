import uuid
from datetime import date

from pydantic import BaseModel, Field, computed_field

from app.core.grade_bands import GradeBand, grade_band


class AcademicYearCreate(BaseModel):
    name: str = Field(min_length=1, max_length=20)
    start_date: date
    end_date: date
    is_active: bool = False


class AcademicYearUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=20)
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None


class AcademicYearOut(BaseModel):
    id: uuid.UUID
    name: str
    start_date: date
    end_date: date
    is_active: bool

    model_config = {"from_attributes": True}


class ClassGradeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    level_order: int
    # Free-text academic_year stays for backward compatibility with existing callers; pass
    # academic_year_id as well (or instead — the year's name then fills the string) to link
    # the new AcademicYear model.
    academic_year: str | None = Field(default=None, min_length=4, max_length=20)
    academic_year_id: uuid.UUID | None = None


class ClassGradeOut(BaseModel):
    id: uuid.UUID
    name: str
    level_order: int
    academic_year: str
    academic_year_id: uuid.UUID | None

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def grade_band(self) -> GradeBand:
        return grade_band(self.level_order)


class SectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)


class SectionOut(BaseModel):
    id: uuid.UUID
    class_grade_id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}


class SubjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=30)


class SubjectOut(BaseModel):
    id: uuid.UUID
    class_grade_id: uuid.UUID
    name: str
    code: str

    model_config = {"from_attributes": True}


class PromoteStudentsRequest(BaseModel):
    from_academic_year_id: uuid.UUID
    to_academic_year_id: uuid.UUID


class PromotionClassResult(BaseModel):
    class_name: str
    students_moved: int


class PromoteStudentsResult(BaseModel):
    students_promoted: int
    students_graduated: int
    promoted_by_class: list[PromotionClassResult]
    graduated_classes: list[str]
