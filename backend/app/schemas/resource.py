import uuid

from pydantic import BaseModel, Field, model_validator

from app.models.resource import ResourceType


URL_TYPES = {ResourceType.LINK, ResourceType.VIDEO}
FILE_TYPES = {ResourceType.DOCUMENT, ResourceType.NOTES, ResourceType.WORKSHEET}


class ResourceCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    resource_type: ResourceType
    external_url: str | None = None
    file_url: str | None = None
    class_grade_id: uuid.UUID | None = None
    subject_id: uuid.UUID | None = None
    category: str | None = None
    chapter_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def check_url_present(self) -> "ResourceCreate":
        if self.resource_type in URL_TYPES and not self.external_url:
            raise ValueError(f"external_url is required for {self.resource_type.value} resources")
        if self.resource_type in FILE_TYPES and not self.file_url:
            raise ValueError(f"file_url is required for {self.resource_type.value} resources")
        return self


class ResourceOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    resource_type: ResourceType
    external_url: str | None
    file_url: str | None
    class_grade_id: uuid.UUID | None
    subject_id: uuid.UUID | None
    category: str | None
    uploaded_by_user_id: uuid.UUID
    chapter_id: uuid.UUID | None

    model_config = {"from_attributes": True}
