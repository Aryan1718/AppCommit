import asyncio
import json
import os
import time
from collections import defaultdict
from datetime import datetime, timezone

import anthropic
from fastapi import APIRouter, Depends, HTTPException, status

from dependencies import get_current_user
from models.schemas import (
    ParseRequest,
    ParseResponse,
    UserIdentity,
)


router = APIRouter()
DAILY_LIMIT = 20
_rate_limit_store: dict[str, list[str]] = defaultdict(list)


def _get_anthropic_client() -> anthropic.Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    return anthropic.Anthropic(api_key=api_key)


def _check_rate_limit(user_id: str) -> None:
    today = datetime.now(timezone.utc).date().isoformat()
    requests_today = [entry for entry in _rate_limit_store[user_id] if entry == today]
    if len(requests_today) >= DAILY_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Daily LLM parsing limit reached for this user",
        )
    requests_today.append(today)
    _rate_limit_store[user_id] = requests_today


@router.post("/parse-llm", response_model=ParseResponse)
async def parse_with_llm(
    payload: ParseRequest,
    user: UserIdentity = Depends(get_current_user),
) -> ParseResponse:
    _check_rate_limit(str(user.id))
    client = _get_anthropic_client()
    start = time.time()
    sections: list[str] = []

    if payload.page_title:
        sections.append(f"Page title: {payload.page_title}")

    if payload.jsonld:
        sections.append(f"Structured data (JSON-LD): {json.dumps(payload.jsonld, ensure_ascii=True)}")

    if payload.role_candidates:
        roles = "\n".join(f"- {role}" for role in payload.role_candidates[:4])
        sections.append(f"Job role candidates:\n{roles}")

    if payload.company_candidates:
        companies = "\n".join(f"- {company}" for company in payload.company_candidates[:4])
        sections.append(f"Company name candidates:\n{companies}")

    if payload.description_candidates:
        primary = payload.description_candidates[0]
        backup = payload.description_candidates[1] if len(payload.description_candidates) > 1 else None
        desc_context = f"Primary job description (highest confidence):\n{primary}"
        if backup:
            desc_context += f"\n\nBackup description candidate:\n{backup}"
        sections.append(desc_context)

    context = "\n\n".join(sections)
    print(
        "[AppCommit LLM] Starting parse:",
        {
            "page_title": bool(payload.page_title),
            "roles": len(payload.role_candidates or []),
            "companies": len(payload.company_candidates or []),
            "descriptions": len(payload.description_candidates or []),
            "has_jsonld": bool(payload.jsonld),
        },
    )

    prompt = f"""
You are analyzing extracted data from a job application page.
Choose the most accurate value for each field from the candidates.

{context}

Rules:
- Return ONLY valid JSON, no explanation, no markdown
- Choose the most likely correct value from candidates
- Clean and normalize the text (fix capitalization etc)
- job_description: Use the PRIMARY description candidate as the main source. Use backup only to fill gaps.
- The primary description candidate is already label-matched, so trust it.
- IMPORTANT: job description is about the ROLE and RESPONSIBILITIES, not company history, mission, or values.
- If a candidate contains both company information and role details, extract only the role/responsibilities part.
- If a field cannot be determined, use null
- company should be just the company name, not "Stripe Careers"
- job_title should be just the role, not "Backend Engineer at Stripe"

Return exactly:
{{
  "company": "clean company name or null",
  "job_title": "clean job title or null",
  "job_description": "primary description candidate cleaned up or null"
}}
""".strip()

    try:
        message = await asyncio.to_thread(
            client.messages.create,
            model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        elapsed = time.time() - start
        print(f"[AppCommit LLM] Completed in {elapsed:.2f}s")
        result = json.loads(message.content[0].text)
        print(
            f"[AppCommit LLM] Result: company={result.get('company')}, "
            f"title={result.get('job_title')}, "
            f"desc_len={len(result.get('job_description') or '')}"
        )
        return ParseResponse(
            company=result.get("company"),
            job_title=result.get("job_title"),
            job_description=result.get("job_description"),
            resume_input_selector=None,
        )
    except Exception as exc:
        elapsed = time.time() - start
        print(f"[AppCommit LLM] Error after {elapsed:.2f}s: {exc}")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
