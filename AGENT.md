# JobTracker — Agent Guide

## What This Project Is

JobTracker is a job application version control system. When a user applies for a job, the browser extension automatically captures the job title, company, job description, and resume used — and saves it to a personal dashboard. When the user gets an interview, they can instantly look up exactly what they submitted.

## Project Structure

```
jobtracker/
├── frontend/          # React dashboard (what users see)
├── extension/         # Chrome/Firefox browser extension
├── backend/           # Node.js API server
└── docs/              # This documentation
    ├── AGENT.md           ← You are here
    ├── FRONTEND.md        ← Dashboard UI spec
    ├── EXTENSION.md       ← Extension architecture
    ├── BACKEND.md         ← API and database spec
    └── PARSERS.md         ← Portal-specific + LLM parsing logic
```

## Core User Flow

```
1. User has resumes stored in JobTracker dashboard
2. User opens a job portal (Greenhouse / Workday / Lever / any site)
3. Extension detects a job application form
4. Extension shows a small popup: "Save this application?"
5. User clicks Save (or submits the form — auto-triggers save)
6. Extension captures: job title, company, job description, resume filename
7. Data appears in the dashboard instantly
8. When user gets interview → opens dashboard → sees exactly what they sent
```

## Two Capture Modes

### Mode 1 — Manual Save (popup)
- User sees the extension popup while filling out the form
- Clicks "Save Application"
- Extension captures the current state of the form

### Mode 2 — Auto Save (on submit)
- User clicks the Submit button on the job application
- Extension intercepts the submit event
- Automatically captures and saves before the page navigates away

Both modes send the same data to the backend.

## Three Parser Types

### 1. Hardcoded Parsers (Greenhouse, Workday, Lever)
- Use known CSS selectors specific to each ATS
- Fast, reliable, 95%+ accuracy
- Built first

### 2. LLM Fallback Parser (any other site)
- Extension sends the page DOM to the backend
- Backend sends to Claude API
- Claude identifies which fields contain what data
- Returns structured JSON
- Works on company-specific career sites

### 3. Manual Fallback (when LLM fails)
- Extension popup shows empty fields
- User fills in job title and company manually
- Still saves resume association

## What Gets Saved Per Application

```json
{
  "id": "uuid",
  "company": "Stripe",
  "job_title": "Backend Engineer",
  "job_description": "Full text of job posting...",
  "portal": "greenhouse",
  "resume_id": "uuid-of-resume-used",
  "applied_at": "2024-03-07T14:32:00Z",
  "status": "applied",
  "notes": ""
}
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Tailwind CSS |
| Backend | Python + FastAPI |
| Database | PostgreSQL |
| File Storage | Supabase Storage |
| Extension | Vanilla JavaScript (Manifest V3) |
| LLM Parser | Claude API (claude-sonnet) |
| Auth | Supabase Auth |

## Build Order

Build in this exact sequence to avoid blocking yourself:

1. **Backend first** — Auth, resume upload, application save API
2. **Dashboard** — Display applications, upload resumes
3. **Extension (Greenhouse)** — First hardcoded parser, popup, save flow
4. **Extension (Workday + Lever)** — Repeat parser pattern
5. **LLM Fallback** — Add after hardcoded parsers work
6. **Auto-save on submit** — Add after manual save works

## Key Constraints

- Extension uses Manifest V3 (Chrome requirement)
- Extension cannot read file contents due to browser security — resumes are matched by filename against user's stored resumes
- LLM parser receives sanitized DOM (scripts removed) to reduce token usage
- All API calls require user auth token in header
