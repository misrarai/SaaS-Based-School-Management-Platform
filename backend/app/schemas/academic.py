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
    class_fee: float | None = None
    capacity: int | None = None
    incharge_id: uuid.UUID | None = None
    assistant_incharge_id: uuid.UUID | None = None


class ClassGradeOut(BaseModel):
    id: uuid.UUID
    name: str
    level_order: int
    academic_year: str
    academic_year_id: uuid.UUID | None
    class_fee: float | None = None
    capacity: int | None = None
    incharge_id: uuid.UUID | None = None
    assistant_incharge_id: uuid.UUID | None = None

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def grade_band(self) -> GradeBand:
        return grade_band(self.level_order)


class ClassGradeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    level_order: int | None = None
    academic_year_id: uuid.UUID | None = None
    class_fee: float | None = None
    capacity: int | None = None
    incharge_id: uuid.UUID | None = None
    assistant_incharge_id: uuid.UUID | None = None
    clear_incharge: bool = False
    clear_assistant: bool = False


class SectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    class_teacher_id: uuid.UUID | None = None


class SectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    class_teacher_id: uuid.UUID | None = None
    # class_teacher_id=None is ambiguous between "leave alone" and "unassign"; this flag
    # makes unassigning explicit.
    clear_class_teacher: bool = False


class SectionOut(BaseModel):
    id: uuid.UUID
    class_grade_id: uuid.UUID
    name: str
    class_teacher_id: uuid.UUID | None = None

    model_config = {"from_attributes": True}


class SubjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=30)


class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=30)


class SubjectOut(BaseModel):
    id: uuid.UUID
    class_grade_id: uuid.UUID
    name: str
    code: str

    model_config = {"from_attributes": True}


class SectionOverview(SectionOut):
    class_teacher_name: str | None = None
    student_count: int = 0


class SectionWithClass(SectionOverview):
    """Flat section row enriched with its class details — used by GET /sections."""
    class_name: str
    academic_year: str
    level_order: int


class SubjectWithClass(SubjectOut):
    """Flat subject row enriched with its class details — used by GET /subjects."""
    class_name: str
    academic_year: str


class ClassOverview(ClassGradeOut):
    student_count: int = 0
    sections: list[SectionOverview] = []
    subjects: list[SubjectOut] = []
    incharge_name: str | None = None
    assistant_incharge_name: str | None = None


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
