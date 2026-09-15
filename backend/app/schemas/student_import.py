from pydantic import BaseModel


class StudentImportRowError(BaseModel):
    row: int
    error: str


class StudentImportResult(BaseModel):
    created: int
    failed: list[StudentImportRowError]
