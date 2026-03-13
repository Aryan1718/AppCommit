# EXTENSION.md — Browser Extension Specification

## Overview

A Chrome extension (Manifest V3) that:
1. Detects when the user is on a supported job application page
2. Shows a popup letting them save the application
3. Also auto-saves when the user clicks Submit
4. Sends captured data to the JobTracker backend

## File Structure

```
extension/
├── manifest.json
├── background.js          ← service worker
├── content/
│   ├── content.js         ← injected into every page
│   ├── parsers/
│   │   ├── greenhouse.js  ← Greenhouse-specific parser
│   │   ├── workday.js     ← Workday-specific parser
│   │   └── lever.js       ← Lever-specific parser
│   └── llm-parser.js      ← fallback: sends DOM to backend
├── popup/
│   ├── popup.html         ← the small extension popup UI
│   ├── popup.js
│   └── popup.css
└── utils/
    ├── api.js             ← calls to JobTracker backend
    ├── storage.js         ← chrome.storage for auth token
    └── detect-portal.js   ← figures out which ATS is being used
```

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "JobTracker",
  "version": "1.0.0",
  "description": "Version control for your job applications",
  "permissions": [
    "activeTab",
    "storage",
    "scripting"
  ],
  "host_permissions": [
    "https://*.greenhouse.io/*",
    "https://*.myworkdayjobs.com/*",
    "https://*.lever.co/*",
    "*://*/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html"
  }
}
```

## Portal Detection (detect-portal.js)

```javascript
export function detectPortal(url) {
  if (url.includes('greenhouse.io')) return 'greenhouse';
  if (url.includes('myworkdayjobs.com')) return 'workday';
  if (url.includes('lever.co')) return 'lever';
  return 'unknown';
}
```

## Content Script Flow (content.js)

```
Page loads
↓
detectPortal(window.location.href)
↓
If known portal → load specific parser
If unknown → prepare LLM parser as fallback
↓
Watch for submit button click
↓
On submit → run parser → send to background.js
↓
Show "Saved!" confirmation toast on page
```

```javascript
// content.js simplified
import { detectPortal } from '../utils/detect-portal.js';

const portal = detectPortal(window.location.href);

if (portal !== 'unknown') {
  // Hook into submit button
  const submitBtn = document.querySelector('[type="submit"]');
  submitBtn?.addEventListener('click', async () => {
    const data = await parseCurrentPortal(portal);
    chrome.runtime.sendMessage({ type: 'SAVE_APPLICATION', data });
  });
}

async function parseCurrentPortal(portal) {
  const parsers = {
    greenhouse: () => import('./parsers/greenhouse.js'),
    workday: () => import('./parsers/workday.js'),
    lever: () => import('./parsers/lever.js'),
  };
  const { parse } = await parsers[portal]();
  return parse();
}
```

## Popup UI

The popup appears when user clicks the extension icon.

```
┌─────────────────────────────┐
│  🎯 JobTracker              │
├─────────────────────────────┤
│  Stripe                     │
│  Backend Engineer           │
│  via Greenhouse             │
│                             │
│  Resume: backend_v3.pdf ▼   │
│                             │
│  [Save Application]         │
│                             │
│  ✓ Saved 3 apps today       │
└─────────────────────────────┘
```

**Logic:**
- If on a known job application page → show detected job info
- If not on a job page → show "Open a job application to track it"
- Resume dropdown → populated from user's stored resumes (fetched from API)
- "Save Application" → sends data to backend

**Not logged in state:**
```
┌─────────────────────────────┐
│  🎯 JobTracker              │
├─────────────────────────────┤
│  Please log in to           │
│  track applications         │
│                             │
│  [Open Dashboard]           │
└─────────────────────────────┘
```

## Background Service Worker (background.js)

Handles messages from content script and popup.

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_APPLICATION') {
    saveApplication(message.data).then(sendResponse);
    return true; // keeps channel open for async
  }
});

async function saveApplication(data) {
  const { token } = await chrome.storage.local.get('token');
  const response = await fetch('https://your-api.com/api/applications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  return response.json();
}
```

## Auth Flow

- User logs in on the dashboard (web app)
- Dashboard stores JWT token in localStorage
- Extension reads the same token via a content script injected on your dashboard domain
- Stores token in `chrome.storage.local`
- All API calls use this token

```javascript
// On dashboard domain, content script runs:
const token = localStorage.getItem('jobtracker_token');
if (token) {
  chrome.storage.local.set({ token });
}
```

## Resume Capture — Auto Upload on Submit

When the user submits a job application, the extension reads the resume file from the form and uploads it automatically to the backend. The user never has to manually upload to the dashboard.

### How It Works

```
User attaches resume to job application form
↓
User clicks Submit (or clicks Save in popup)
↓
Extension reads the File object from the file input
↓
Converts file to base64 using FileReader API
↓
Sends base64 string + filename to backend /api/resumes/upload
↓
Backend decodes, saves to Supabase Storage
↓
Backend checks if this filename already exists for this user
  → If yes: returns existing resume ID (no duplicate stored)
  → If no: saves new resume, returns new ID
↓
Resume ID is attached to the application record
```

### Key Point — Why This Works

Browsers block extensions from reading arbitrary files on disk. BUT when a user selects a file via `<input type="file">`, that file object is accessible in the DOM. The extension can read it using the FileReader API because the **user explicitly chose the file**.

### Code — Reading and Encoding the File

```javascript
// utils/resume-capture.js

export async function captureResume() {
  const fileInput = document.querySelector('input[type="file"]');
  const file = fileInput?.files?.[0];

  if (!file) return null;

  // Only accept PDFs and Word docs
  const allowed = ['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowed.includes(file.type)) return null;

  const base64 = await fileToBase64(file);

  return {
    filename: file.name,       // e.g. "backend_v3.pdf"
    mimetype: file.type,       // e.g. "application/pdf"
    size: file.size,           // in bytes
    base64                     // full file content encoded
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:application/pdf;base64,JVBERi0x..."
      // strip the prefix to get just the base64 data
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

### Code — Sending to Backend

```javascript
// In background.js — updated saveApplication function

async function saveApplication(data) {
  const { token } = await chrome.storage.local.get('token');
  const headers = { 'Authorization': `Bearer ${token}` };

  let resumeId = null;

  // Step 1: Upload resume if captured
  if (data.resume) {
    const resumeRes = await fetch('https://your-api.com/api/resumes/upload', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data.resume)  // { filename, mimetype, size, base64 }
    });
    const resumeData = await resumeRes.json();
    resumeId = resumeData.id;
  }

  // Step 2: Save application with resume ID
  const appRes = await fetch('https://your-api.com/api/applications', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company: data.company,
      job_title: data.job_title,
      job_description: data.job_description,
      portal: data.portal,
      resume_id: resumeId,
      resume_filename: data.resume?.filename ?? null,
      url: data.url
    })
  });

  return appRes.json();
}
```

### Updated Content Script Flow

```javascript
// content.js — updated submit handler

submitBtn?.addEventListener('click', async () => {
  const [jobData, resume] = await Promise.all([
    parseCurrentPortal(portal),
    captureResume()           // ← new: read file before page navigates
  ]);

  chrome.runtime.sendMessage({
    type: 'SAVE_APPLICATION',
    data: { ...jobData, resume }
  });
});
```

### Deduplication Logic (Backend)

If the user applies to 50 jobs with the same `backend_v3.pdf`, the file should only be stored once.

Backend checks before saving:
```
Does a resume with this exact filename already exist for this user?
  → Yes: return existing resume record, skip upload
  → No: upload to Supabase Storage, create new resume record
```

### Size Limit

Reject resumes over **5MB** in the extension before even sending:

```javascript
if (file.size > 5 * 1024 * 1024) {
  console.warn('Resume too large to auto-capture');
  return null;
}
```

### Popup — Resume Captured State

When the extension successfully reads a resume:

```
┌─────────────────────────────┐
│  🎯 JobTracker              │
├─────────────────────────────┤
│  Stripe                     │
│  Backend Engineer           │
│  via Greenhouse             │
│                             │
│  📄 backend_v3.pdf          │
│     Resume detected ✓       │
│                             │
│  [Save Application]         │
└─────────────────────────────┘
```

When no resume is detected:

```
┌─────────────────────────────┐
│  🎯 JobTracker              │
├─────────────────────────────┤
│  Stripe                     │
│  Backend Engineer           │
│                             │
│  ⚠ No resume detected       │
│                             │
│  [Save Anyway]              │
└─────────────────────────────┘
```
