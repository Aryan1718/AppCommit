# AppCommit

AppCommit is a job application tracking platform that captures application snapshots, stores resume versions, and helps users review exactly what was submitted for each role.

The system includes:
- A React dashboard for resume management and application history
- A FastAPI backend for application, resume, and parsing APIs
- Supabase for database access and file storage

## Core Capabilities

- Dashboard for browsing and reviewing application snapshots
- Resume upload and version tracking
- Application detail views with timeline history
- LLM-assisted parsing support for job metadata extraction

## Architecture

- `frontend/`: Vite + React application
- `backend/`: FastAPI service
- `supabase/`: database and platform-related assets
- `extension/`: browser extension source
- `.env.example`: shared local environment template

## Local Development

### Docker Compose

```bash
docker compose up --build
```

This starts:
- frontend on `http://localhost:5173`
- backend on `http://localhost:8000`

Use the repository root `.env.example` as the template for `.env` before starting Compose.

When the app containers are running, generate the browser extension config from the same root `.env`:

```bash
node scripts/generate-extension-config.mjs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Required frontend environment variables:
- `VITE_API_URL`

Before loading the browser extension locally, generate its runtime config:

```bash
node scripts/generate-extension-config.mjs
```

This generates:
- `extension/config.js`
- `extension/manifest.json`

Privacy defaults for the generated extension:
- injects only on supported ATS/job domains
- requests host access only to your configured backend API origin

Use the repository root `.env.example` as the single local template for frontend, backend, and extension variables.

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

Required extension environment variables:
- `EXTENSION_API_BASE_URL`
- `EXTENSION_DASHBOARD_URL`
- `EXTENSION_DASHBOARD_APP_URL`

Use the checked-in root `.env.example` as the template and keep the real `.env` file untracked.

## Deployment

- Frontend: Vercel
- Backend: Render or Railway
- Database and storage: Supabase
- Browser extension: Chrome Web Store

## Usage

1. Open the web application.
2. Upload and manage resume versions.
3. Review captured application snapshots in the dashboard.
4. Open an application record to inspect its metadata, attached resume, and timeline.

## Notes

This repository is structured for separate frontend and backend deployments. Configure environment variables per service and connect the backend to your own Supabase project.
