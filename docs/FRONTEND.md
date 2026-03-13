# FRONTEND.md — Dashboard Specification

## Overview

The frontend is a React dashboard where users:
- See all their job applications in one place
- Upload and manage their resumes
- View the exact details of any application (for interview prep)
- Manually add applications if needed

## Pages

### 1. Auth Pages
- `/login` — Email + password login
- `/signup` — Create account

### 2. Dashboard — `/dashboard`
Main page. Shows all applications.

**Layout:**
```
[Header: JobTracker logo | Resumes | Log Out]

[Stats bar]
Total Applied: 47  |  Interviews: 8  |  Offers: 1

[Applications list]
Each card shows:
  - Company name + logo (favicon)
  - Job title
  - Portal used (Greenhouse / Workday / etc.)
  - Date applied
  - Resume used
  - Status badge (Applied / Interview / Offer / Rejected)
```

**Filters:**
- Search by company or job title
- Filter by status
- Sort by date (newest first default)

### 3. Application Detail — `/application/:id`
Opened when user clicks an application card.

**Shows:**
```
Company: Stripe
Role: Backend Engineer
Applied: March 7, 2024
Portal: Greenhouse
Status: [Interview Scheduled ▼]  ← dropdown to update

[Resume Used]
backend_v3.pdf  [View] [Download]

[Job Description]
Full text of the job description saved at time of application
Scrollable, read-only

[Notes]
Free text area — user can add interview notes, recruiter name, etc.

[Timeline]
Mar 7  — Applied
Mar 12 — Added note: "Recruiter reached out"
Mar 18 — Status changed to Interview
```

### 4. Resumes — `/resumes`
Where users manage their resume versions.

**Layout:**
```
[Upload New Resume]  ← button opens file picker

List of resumes:
  backend_v3.pdf      Uploaded Mar 1   Used in 12 applications  [Delete]
  general_v2.pdf      Uploaded Feb 15  Used in 34 applications  [Delete]
  frontend_v1.pdf     Uploaded Jan 20  Used in 1 application    [Delete]
```

**Important:** Users upload resumes HERE first. The extension then matches by filename when detecting which resume was used in an application.

### 5. Manual Add — `/add`
Form for adding an application without the extension.

```
Company Name*
Job Title*
Job Description  (paste)
Resume Used      (dropdown of uploaded resumes)
Date Applied     (date picker, defaults to today)
Portal           (dropdown: Greenhouse / Workday / Lever / Other)
```

## Component Structure

```
src/
├── pages/
│   ├── Login.jsx
│   ├── Signup.jsx
│   ├── Dashboard.jsx
│   ├── ApplicationDetail.jsx
│   ├── Resumes.jsx
│   └── ManualAdd.jsx
├── components/
│   ├── ApplicationCard.jsx
│   ├── StatusBadge.jsx
│   ├── ResumeList.jsx
│   ├── Timeline.jsx
│   ├── JobDescriptionViewer.jsx
│   └── Header.jsx
├── api/
│   └── client.js        ← all API calls in one place
└── store/
    └── useAppStore.js   ← Zustand store for global state
```

## State Management

Use **Zustand** (lightweight, simple).

```javascript
// useAppStore.js
{
  applications: [],
  resumes: [],
  currentUser: null,
  fetchApplications: async () => {},
  fetchResumes: async () => {},
  addApplication: async (data) => {},
  updateStatus: async (id, status) => {}
}
```

## Key UI Decisions

- **No complex animations** — keep it fast and clean
- **Tailwind CSS** for styling
- **Date formatting** — always show human readable (Mar 7, 2024 not 2024-03-07)
- **Empty state** — when no applications, show: "Install the extension to start tracking applications automatically"
- **Resume match display** — if resume used is unknown, show "Resume not detected" in grey

## API Calls the Frontend Makes

```
GET    /api/applications          ← fetch all applications
GET    /api/applications/:id      ← fetch one application
POST   /api/applications          ← manual add
PATCH  /api/applications/:id      ← update status or notes
DELETE /api/applications/:id      ← delete

GET    /api/resumes               ← fetch all resumes
POST   /api/resumes               ← upload resume
DELETE /api/resumes/:id           ← delete resume
```
