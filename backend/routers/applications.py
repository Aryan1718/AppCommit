import asyncio
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status

from db.client import get_resume_bucket, require_env, supabase
from models.schemas import (
    ApplicationCreate,
    ApplicationDetailResponse,
    ApplicationResponse,
    ApplicationUpdate,
    TimelineEventResponse,
)


router = APIRouter()
SIGNED_URL_EXPIRES_IN = 3600


async def _execute_query(builder: Any) -> Any:
    return await asyncio.to_thread(builder.execute)


async def _create_timeline_event(
    *,
    application_id: UUID,
    event_type: str,
    event_data: dict[str, Any],
) -> None:
    payload = {
        "application_id": str(application_id),
        "event_type": event_type,
        "event_data": event_data,
    }
    await _execute_query(supabase.table("timeline_events").insert(payload))


async def _get_resume_signed_url(storage_path: str | None) -> str | None:
    if not storage_path:
        return None

    result = await asyncio.to_thread(
        supabase.storage.from_(get_resume_bucket()).create_signed_url,
        storage_path,
        SIGNED_URL_EXPIRES_IN,
    )
    signed_url = result.get("signedURL") or result.get("signedUrl")
    if not signed_url:
        return None
    if signed_url.startswith("http://") or signed_url.startswith("https://"):
        return signed_url
    return f"{require_env('SUPABASE_URL').rstrip('/')}{signed_url}"


def _application_response_from_row(row: dict[str, Any], resume_url: str | None = None) -> ApplicationResponse:
    return ApplicationResponse(
        id=row["id"],
        company=row["company"],
        job_title=row["job_title"],
        job_description=row.get("job_description"),
        portal=row.get("portal"),
        resume_id=row.get("resume_id"),
        resume_filename=row.get("resume_filename"),
        resume_url=resume_url,
        url=row.get("url"),
        status=row["status"],
        notes=row.get("notes"),
        applied_at=row["applied_at"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


async def _get_application(application_id: UUID) -> dict[str, Any]:
    query = (
        supabase.table("applications")
        .select("*")
        .eq("id", str(application_id))
        .limit(1)
    )
    result = await _execute_query(query)
    if not result.data:
        raise HTTPException(status_code=404, detail="Application not found")
    return result.data[0]


@router.get("", response_model=list[ApplicationResponse])
async def list_applications() -> list[ApplicationResponse]:
    result = await _execute_query(
        supabase.table("applications")
        .select("*")
        .order("applied_at", desc=True)
    )
    return [_application_response_from_row(row) for row in result.data or []]


@router.get("/{application_id}", response_model=ApplicationDetailResponse)
async def get_application(
    application_id: UUID,
) -> ApplicationDetailResponse:
    application = await _get_application(application_id)

    timeline_result = await _execute_query(
        supabase.table("timeline_events")
        .select("*")
        .eq("application_id", str(application_id))
        .order("created_at", desc=False)
    )

    resume_url = None
    if application.get("resume_id"):
        resume_result = await _execute_query(
            supabase.table("resumes")
            .select("storage_path")
            .eq("id", str(application["resume_id"]))
            .limit(1)
        )
        if resume_result.data:
            resume_url = await _get_resume_signed_url(resume_result.data[0]["storage_path"])

    base = _application_response_from_row(application, resume_url=resume_url)
    return ApplicationDetailResponse(
        **base.model_dump(),
        timeline=[TimelineEventResponse(**event) for event in timeline_result.data or []],
    )


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    payload: ApplicationCreate,
) -> ApplicationResponse:
    if payload.resume_id:
        resume_result = await _execute_query(
            supabase.table("resumes")
            .select("id, filename")
            .eq("id", str(payload.resume_id))
            .limit(1)
        )
        if not resume_result.data:
            raise HTTPException(status_code=404, detail="Resume not found")

    insert_payload = {
        "company": payload.company,
        "job_title": payload.job_title,
        "job_description": payload.job_description,
        "portal": payload.portal,
        "resume_id": str(payload.resume_id) if payload.resume_id else None,
        "resume_filename": payload.resume_filename,
        "url": str(payload.url) if payload.url else None,
        "status": payload.status,
        "notes": payload.notes,
        "applied_at": (payload.applied_at or datetime.now(timezone.utc)).isoformat(),
    }

    result = await _execute_query(supabase.table("applications").insert(insert_payload))
    row = result.data[0]

    await _create_timeline_event(
        application_id=row["id"],
        event_type="application_created",
        event_data={"status": row["status"], "portal": row.get("portal")},
    )
    await _create_timeline_event(
        application_id=row["id"],
        event_type="auto_saved",
        event_data={"source": "api"},
    )

    return _application_response_from_row(row)


@router.patch("/{application_id}", response_model=ApplicationResponse)
async def update_application(
    application_id: UUID,
    payload: ApplicationUpdate,
) -> ApplicationResponse:
    existing = await _get_application(application_id)

    update_payload: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}

    if payload.status is not None:
        update_payload["status"] = payload.status
    if payload.notes is not None:
        update_payload["notes"] = payload.notes

    if len(update_payload) == 1:
        raise HTTPException(status_code=400, detail="No application fields were provided to update")

    result = await _execute_query(
        supabase.table("applications")
        .update(update_payload)
        .eq("id", str(application_id))
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Application not found")

    updated_row = result.data[0]

    if payload.status is not None and payload.status != existing["status"]:
        await _create_timeline_event(
            application_id=application_id,
            event_type="status_change",
            event_data={"from": existing["status"], "to": payload.status},
        )
    if payload.notes is not None and payload.notes != existing.get("notes"):
        await _create_timeline_event(
            application_id=application_id,
            event_type="note_added",
            event_data={"notes": payload.notes},
        )

    return _application_response_from_row(updated_row)


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    application_id: UUID,
) -> Response:
    await _get_application(application_id)
    await _execute_query(
        supabase.table("applications")
        .delete()
        .eq("id", str(application_id))
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
