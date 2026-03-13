# BACKEND.md — API and Database Specification

## Overview

Python + FastAPI server. Handles:
- Auth (via Supabase JWT verification)
- Storing and retrieving job applications
- Resume file upload and storage
- LLM parsing requests from the extension

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Language | Python 3.11+ |
| Framework | FastAPI |
| Database | PostgreSQL (via Supabase) |
| File Storage | Supabase Storage |
| Auth | Supabase Auth (JWT) |
| LLM | Anthropic Python SDK |
| Server | Uvicorn |

## File Structure

```
backend/
├── main.py                    ← FastAPI app entry point
├── dependencies.py            ← shared dependencies (auth, db)
├── routers/
│   ├── applications.py        ← CRUD for applications
│   ├── resumes.py             ← resume upload/list/delete
│   └── parse_llm.py           ← LLM fallback parser endpoint
├── models/
│   └── schemas.py             ← Pydantic request/response models
├── db/
│   ├── client.py              ← Supabase client setup
│   └── schema.sql             ← database schema
├── requirements.txt
└── .env
```

## Requirements

```
fastapi
uvicorn
supabase
anthropic
python-dotenv
python-multipart
pydantic
```

## Environment Variables

```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ANTHROPIC_API_KEY=
PORT=8000
```

---

## main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import applications, resumes, parse_llm

app = FastAPI(title="AppCommit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(applications.router, prefix="/api/applications", tags=["applications"])
app.include_router(resumes.router, prefix="/api/resumes", tags=["resumes"])
app.include_router(parse_llm.router, prefix="/api", tags=["llm"])

@app.get("/health")
def health():
    return {"status": "ok"}
```

---

## Database Schema (db/schema.sql)

```sql
-- Users are managed by Supabase Auth (no users table needed)

CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  job_title TEXT NOT NULL,
  job_description TEXT,
  portal TEXT,                      -- greenhouse | workday | lever | unknown
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  resume_filename TEXT,
  url TEXT,
  status TEXT DEFAULT 'applied',   -- applied | interview | offer | rejected
  notes TEXT,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,         -- status_change | note_added | auto_saved
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_applied_at ON applications(applied_at DESC);
CREATE INDEX idx_resumes_user_id ON resumes(user_id);
```

---

## Pydantic Models (models/schemas.py)

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

class ApplicationCreate(BaseModel):
    company: str
    job_title: str
    job_description: Optional[str] = None
    portal: Optional[str] = None
    resume_id: Optional[uuid.UUID] = None
    resume_filename: Optional[str] = None
    url: Optional[str] = None

class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

class ApplicationResponse(BaseModel):
    id: uuid.UUID
    company: str
    job_title: str
    job_description: Optional[str]
    portal: Optional[str]
    resume_id: Optional[uuid.UUID]
    resume_filename: Optional[str]
    resume_url: Optional[str]
    url: Optional[str]
    status: str
    notes: Optional[str]
    applied_at: datetime

class ResumeUpload(BaseModel):
    filename: str
    mimetype: str
    size: int
    base64: str

class ResumeResponse(BaseModel):
    id: uuid.UUID
    filename: str
    size: Optional[int]
    uploaded_at: datetime
    used_in: Optional[int] = 0

class ParseRequest(BaseModel):
    dom_text: str

class ParseResponse(BaseModel):
    company: Optional[str]
    job_title: Optional[str]
    job_description: Optional[str]
    confidence: str
```

---

## Auth Dependency (dependencies.py)

```python
from fastapi import Depends, HTTPException, Header
from db.client import supabase

async def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    try:
        result = supabase.auth.get_user(token)
        return result.user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
```

---

## API Routes

### Applications

#### GET /api/applications
List all applications for the logged-in user, newest first.

#### GET /api/applications/{id}
Get one application with full details. Attaches:
- Signed resume URL (valid 1 hour) if resume exists
- Timeline events array

#### POST /api/applications
Create a new application. Called by extension on submit and by dashboard manual add.

```
Request body:
{
  "company": "Stripe",
  "job_title": "Backend Engineer",
  "job_description": "...",
  "portal": "greenhouse",
  "resume_id": "uuid",
  "resume_filename": "backend_v3.pdf",
  "url": "https://..."
}
Response 201: { "id": "uuid", ...application }
```

#### PATCH /api/applications/{id}
Update status or notes. Writes a timeline_event on status change.

#### DELETE /api/applications/{id}
Response 204.

---

### Resumes

#### GET /api/resumes
List all resumes with `used_in` count.

#### POST /api/resumes/upload
Called by extension. Accepts base64-encoded file. Deduplicates by filename per user.

```python
# Deduplication logic
existing = supabase.table("resumes") \
    .select("*") \
    .eq("user_id", str(user.id)) \
    .eq("filename", payload.filename) \
    .execute()

if existing.data:
    return existing.data[0]   # return existing, skip upload

# Otherwise decode and upload
import base64
file_bytes = base64.b64decode(payload.base64)
storage_path = f"{user.id}/{payload.filename}"
supabase.storage.from_("resumes").upload(storage_path, file_bytes, {"content-type": payload.mimetype})
```

```
Response 200: existing record (deduplicated)
Response 201: newly uploaded record
```

#### POST /api/resumes
Manual upload from dashboard. Accepts multipart/form-data PDF. Same deduplication.

#### GET /api/resumes/{id}/download
Returns signed Supabase Storage URL valid for 1 hour.

#### DELETE /api/resumes/{id}
Returns 409 with warning if resume is linked to applications.
Accepts `?force=true` to delete anyway (sets resume_id to null on affected applications).

---

### LLM Parser

#### POST /api/parse-llm

```python
@router.post("/parse-llm", response_model=ParseResponse)
async def parse_with_llm(payload: ParseRequest, user=Depends(get_current_user)):
    client = anthropic.Anthropic()

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{"role": "user", "content": f"""
            Analyze this job application page text.
            Return ONLY valid JSON with no preamble:
            {{
              "company": "string or null",
              "job_title": "string or null",
              "job_description": "string or null",
              "confidence": "high | medium | low"
            }}

            Page text:
            {payload.dom_text[:8000]}
        """}]
    )

    return json.loads(message.content[0].text)
```

Rate limit: 20 requests per user per day.

---

## Error Format

```json
{ "detail": "Human readable error message" }
```

Status codes: 400 bad request, 401 unauthenticated, 404 not found, 409 conflict, 422 validation, 500 server error.

---

## Running Locally

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Interactive API docs at:
http://localhost:8000/docs
```

---

## Security Rules

- Always filter DB queries by `user_id` from JWT — never trust client-supplied IDs
- Storage paths scoped to `{user_id}/` — users cannot access each other's files
- `SUPABASE_SERVICE_KEY` backend only — never expose to frontend or extension
- Signed URLs expire after 1 hour
