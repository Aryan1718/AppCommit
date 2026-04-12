from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class TimelineEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    application_id: UUID
    event_type: str
    event_data: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class ApplicationCreate(BaseModel):
    company: str = Field(min_length=1, max_length=255)
    job_title: str = Field(min_length=1, max_length=255)
    job_description: str | None = None
    portal: str | None = Field(default=None, max_length=100)
    resume_id: UUID | None = None
    resume_filename: str | None = Field(default=None, max_length=255)
    url: HttpUrl | None = None
    status: Literal["applied", "interview", "offer", "rejected", "withdrawn", "saved"] = "applied"
    notes: str | None = None
    applied_at: datetime | None = None


class ApplicationUpdate(BaseModel):
    status: Literal["applied", "interview", "offer", "rejected", "withdrawn", "saved"] | None = None
    notes: str | None = None


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company: str
    job_title: str
    job_description: str | None = None
    portal: str | None = None
    resume_id: UUID | None = None
    resume_filename: str | None = None
    resume_url: str | None = None
    url: str | None = None
    status: str
    notes: str | None = None
    applied_at: datetime
    created_at: datetime
    updated_at: datetime


class ApplicationDetailResponse(ApplicationResponse):
    timeline: list[TimelineEventResponse] = Field(default_factory=list)


class ResumeUpload(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    mimetype: str = Field(min_length=1, max_length=255)
    size: int = Field(ge=1)
    base64: str = Field(min_length=1)


class ResumeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filename: str
    storage_path: str
    mime_type: str
    size: int | None = None
    uploaded_at: datetime
    used_in: int = 0


class ResumeDownloadResponse(BaseModel):
    resume_id: UUID
    filename: str
    signed_url: str
    expires_in: int = 3600


class DeleteConflictResponse(BaseModel):
    detail: str
    linked_application_ids: list[UUID] = Field(default_factory=list)


class ParseRequest(BaseModel):
    page_title: Optional[str] = None
    role_candidates: Optional[list[str]] = None
    company_candidates: Optional[list[str]] = None
    description_candidates: Optional[list[str]] = None
    jsonld: Optional[dict[str, Any]] = None


class ParseResponse(BaseModel):
    company: Optional[str] = None
    job_title: Optional[str] = None
    job_description: Optional[str] = None
    resume_input_selector: Optional[str] = None
