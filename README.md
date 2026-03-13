# AppCommit

AppCommit is a job application tracking platform that captures application snapshots, stores resume versions, and helps users review exactly what was submitted for each role.

The system includes:
- A React dashboard for authentication, resume management, and application history
- A FastAPI backend for application, resume, and parsing APIs
- Supabase for authentication, database access, and file storage

## Core Capabilities

- Secure sign-in and account management with Supabase Auth
- Dashboard for browsing and reviewing application snapshots
- Resume upload and version tracking
- Application detail views with timeline history
- LLM-assisted parsing support for job metadata extraction

## Architecture

- `frontend/`: Vite + React application
- `backend/`: FastAPI service
- `supabase/`: database and platform-related assets
- `extension/`: browser extension source

## Local Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Required frontend environment variables:
- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Required backend environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_RESUME_BUCKET`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`

## Deployment

- Frontend: Vercel
- Backend: Render or Railway
- Auth, database, and storage: Supabase
- Browser extension: Chrome Web Store

## Usage

1. Sign in to the web application.
2. Upload and manage resume versions.
3. Review captured application snapshots in the dashboard.
4. Open an application record to inspect its metadata, attached resume, and timeline.

## Notes

This repository is structured for separate frontend and backend deployments. Configure environment variables per service and ensure Supabase redirect URLs match the deployed frontend domain.
