<div align="center">

# AppCommit

![React](https://img.shields.io/badge/frontend-React%2018-61DAFB?logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688?logo=fastapi&logoColor=white)
![Supabase](https://img.shields.io/badge/storage-Supabase-3ECF8E?logo=supabase&logoColor=white)
![Extension](https://img.shields.io/badge/browser%20extension-Manifest%20V3-FBBC04?logo=googlechrome&logoColor=white)

Track every job application with the exact resume, job description, portal, and applied date you submitted.

</div>

AppCommit is an open-source job application tracking workspace built for recall. Instead of only saving company names and statuses, it preserves the actual submission context so you can review what you sent before interviews and follow-ups.

## Features

- Capture job application snapshots from supported job portals.
- Store the exact role, company, job description, portal, and applied date.
- Link each application to the resume version used at the time of submission.
- Review saved applications in a dashboard with filters and detail views.
- Manage resume versions in one place.
- Use portal-specific parsers with an LLM fallback for unsupported pages.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS, Zustand |
| Backend | FastAPI, Pydantic, Uvicorn |
| Storage | Supabase Database + Storage |
| Extension | Vanilla JavaScript, Chrome Manifest V3 |
| Parsing | Hardcoded portal parsers + Anthropic-powered fallback |

## Repository Structure

```text
AppCommit/
├── frontend/    # React dashboard
├── backend/     # FastAPI API
├── extension/   # Browser extension
├── supabase/    # SQL migrations
├── docs/        # Product and architecture notes
├── scripts/     # Project utilities
└── .env.example # Shared environment template
```

## How It Works

1. Add your resumes in the dashboard.
2. Open a supported application page.
3. The browser extension captures job details when you save or submit.
4. AppCommit stores the application snapshot with the resume version used.
5. Later, you can open the dashboard and review the exact submission details.

## Quick Start

### 1. Clone and configure

```bash
git clone <your-fork-or-repo-url>
cd AppCommit
cp .env.example .env
```

Update `.env` with your own values before starting the app.

### 2. Run with Docker Compose

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

After the app is running, generate the extension config:

```bash
node scripts/generate-extension-config.mjs
```

This generates:

- `extension/config.js`
- `extension/manifest.json`

## Manual Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Extension

Generate the extension runtime config from the repository root:

```bash
node scripts/generate-extension-config.mjs
```

Then load the `extension/` directory as an unpacked extension in your browser.

## Environment Variables

Use the root `.env.example` as the source of truth for local setup.

### Backend

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_RESUME_BUCKET`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`

### Frontend

- `VITE_API_URL`

### Extension

- `EXTENSION_API_BASE_URL`
- `EXTENSION_DASHBOARD_URL`
- `EXTENSION_DASHBOARD_APP_URL`

## Supported Portals

- Greenhouse
- Workday
- Lever

Other sites can be handled through the LLM parsing fallback when configured.

## API

The backend exposes:

- `/health`
- `/api/applications`
- `/api/resumes`
- `/api/auth`
- `/api/parse-llm`

Run the backend locally and open `http://localhost:8000/health` to verify the service is up.

## Deployment

- Frontend: Vercel
- Backend: Render or Railway
- Database and file storage: Supabase
- Browser extension: Chrome Web Store or local unpacked install

## Privacy Model

AppCommit is designed around user-controlled storage. Application records and resumes are stored in the database and storage services you configure for your deployment. The project is intended to help users manage their own application history rather than collect it for a centralized service.

## Documentation

- [Frontend notes](./docs/FRONTEND.md)
- [Backend notes](./docs/BACKEND.md)
- [Extension notes](./docs/EXTENSION.md)
- [Parser notes](./docs/PARSERS.md)

## Contributing

Issues and pull requests are welcome. If you plan to make larger changes, open an issue first so the implementation direction is clear before work starts.
