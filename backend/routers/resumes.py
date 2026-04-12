import asyncio
import base64
from pathlib import PurePosixPath
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status
from fastapi.responses import JSONResponse

from db.client import get_resume_bucket, require_env, supabase
from models.schemas import (
    DeleteConflictResponse,
    ResumeDownloadResponse,
    ResumeResponse,
    ResumeUpload,
)


router = APIRouter()
SIGNED_URL_EXPIRES_IN = 3600
WORKSPACE_STORAGE_PREFIX = "workspace"


async def _execute_query(builder: Any) -> Any:
    return await asyncio.to_thread(builder.execute)


def _sanitize_filename(filename: str) -> str:
    cleaned = PurePosixPath(filename).name.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Filename must not be empty")
    return cleaned


async def _get_resume(resume_id: UUID) -> dict[str, Any]:
    result = await _execute_query(
        supabase.table("resumes")
        .select("*")
        .eq("id", str(resume_id))
        .limit(1)
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Resume not found")
    return result.data[0]


async def _get_usage_count(resume_id: UUID) -> int:
    result = await _execute_query(
        supabase.table("applications")
        .select("id", count="exact")
        .eq("resume_id", str(resume_id))
    )
    return result.count or 0


def _resume_response_from_row(row: dict[str, Any], used_in: int = 0) -> ResumeResponse:
    return ResumeResponse(
        id=row["id"],
        filename=row["filename"],
        storage_path=row["storage_path"],
        mime_type=row["mime_type"],
        size=row.get("size"),
        uploaded_at=row["uploaded_at"],
        used_in=used_in,
    )


@router.get("", response_model=list[ResumeResponse])
async def list_resumes() -> list[ResumeResponse]:
    resumes_result = await _execute_query(
        supabase.table("resumes")
        .select("*")
        .order("uploaded_at", desc=True)
    )

    usage_result = await _execute_query(
        supabase.table("applications").select("resume_id")
    )

    usage_map: dict[str, int] = {}
    for row in usage_result.data or []:
        resume_id = row.get("resume_id")
        if resume_id:
            usage_map[resume_id] = usage_map.get(resume_id, 0) + 1

    return [
        _resume_response_from_row(row, used_in=usage_map.get(row["id"], 0))
        for row in resumes_result.data or []
    ]


@router.post(
    "/upload",
    response_model=ResumeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_resume(
    payload: ResumeUpload,
    response: Response,
) -> ResumeResponse:
    filename = _sanitize_filename(payload.filename)

    existing = await _execute_query(
        supabase.table("resumes")
        .select("*")
        .eq("filename", filename)
        .limit(1)
    )
    if existing.data:
        response.status_code = status.HTTP_200_OK
        return _resume_response_from_row(existing.data[0], used_in=await _get_usage_count(existing.data[0]["id"]))

    try:
        file_bytes = base64.b64decode(payload.base64, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 file payload") from exc

    if payload.size != len(file_bytes):
        raise HTTPException(status_code=400, detail="Provided file size does not match decoded content")

    storage_path = f"{WORKSPACE_STORAGE_PREFIX}/{filename}"
    try:
        await asyncio.to_thread(
            supabase.storage.from_(get_resume_bucket()).upload,
            storage_path,
            file_bytes,
            {"content-type": payload.mimetype, "upsert": "false"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to upload resume to storage") from exc

    insert_result = await _execute_query(
        supabase.table("resumes").insert(
            {
                "filename": filename,
                "storage_path": storage_path,
                "mime_type": payload.mimetype,
                "size": payload.size,
            }
        )
    )
    return _resume_response_from_row(insert_result.data[0], used_in=0)


@router.get("/{resume_id}/download", response_model=ResumeDownloadResponse)
async def download_resume(
    resume_id: UUID,
) -> ResumeDownloadResponse:
    resume = await _get_resume(resume_id)
    signed = await asyncio.to_thread(
        supabase.storage.from_(get_resume_bucket()).create_signed_url,
        resume["storage_path"],
        SIGNED_URL_EXPIRES_IN,
    )
    signed_url = signed.get("signedURL") or signed.get("signedUrl")
    if not signed_url:
        raise HTTPException(status_code=500, detail="Failed to create signed download URL")
    if not signed_url.startswith("http://") and not signed_url.startswith("https://"):
        signed_url = f"{require_env('SUPABASE_URL').rstrip('/')}{signed_url}"

    return ResumeDownloadResponse(
        resume_id=resume["id"],
        filename=resume["filename"],
        signed_url=signed_url,
        expires_in=SIGNED_URL_EXPIRES_IN,
    )


@router.delete(
    "/{resume_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={409: {"model": DeleteConflictResponse}},
)
async def delete_resume(
    resume_id: UUID,
    force: bool = Query(default=False),
) -> Response:
    resume = await _get_resume(resume_id)

    linked_applications = await _execute_query(
        supabase.table("applications")
        .select("id")
        .eq("resume_id", str(resume_id))
    )
    linked_ids = [row["id"] for row in linked_applications.data or []]

    if linked_ids and not force:
        return JSONResponse(
            status_code=409,
            content={
                "detail": f"Resume is linked to {len(linked_ids)} application(s). Retry with force=true to detach and delete it.",
                "linked_application_ids": linked_ids,
            },
        )

    if linked_ids:
        await _execute_query(
            supabase.table("applications")
            .update({"resume_id": None, "resume_filename": None})
            .eq("resume_id", str(resume_id))
        )

    try:
        await asyncio.to_thread(
            supabase.storage.from_(get_resume_bucket()).remove,
            [resume["storage_path"]],
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to delete resume from storage") from exc
    await _execute_query(
        supabase.table("resumes")
        .delete()
        .eq("id", str(resume_id))
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
