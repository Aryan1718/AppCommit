# PARSERS.md — Portal Parsers + LLM Fallback

## Overview

Parsers are responsible for extracting structured data from job application pages.
There are two types:

1. **Hardcoded parsers** — for Greenhouse, Workday, Lever
2. **LLM fallback parser** — for any other site

Each parser returns the same shape of data:

```javascript
{
  company: "Stripe",
  job_title: "Backend Engineer",
  job_description: "We are looking for...",
  portal: "greenhouse",
  resume_filename: "backend_v3.pdf",  // or null — filename for display
  resume: {                           // full file for upload, or null
    filename: "backend_v3.pdf",
    mimetype: "application/pdf",
    size: 204800,
    base64: "JVBERi0x..."
  },
  url: "https://boards.greenhouse.io/stripe/jobs/123"
}
```

---

## Parser 1 — Greenhouse

**URL pattern:** `*.greenhouse.io/*` or `boards.greenhouse.io/*`

Greenhouse has a completely consistent HTML structure across ALL companies that use it.

```javascript
// parsers/greenhouse.js

export function parse() {
  const company = document.querySelector('.company-name')?.innerText?.trim()
    ?? extractFromTitle('greenhouse');

  const job_title = document.querySelector('.app-title h1')?.innerText?.trim()
    ?? document.querySelector('h1.job-title')?.innerText?.trim();

  const job_description = document.querySelector('#content')?.innerText?.trim()
    ?? document.querySelector('.job-description')?.innerText?.trim();

  const resume_filename = getResumeFilename();

  return {
    company,
    job_title,
    job_description,
    portal: 'greenhouse',
    resume_filename,
    url: window.location.href
  };
}

function getResumeFilename() {
  const fileInput = document.querySelector('input[type="file"]');
  return fileInput?.files?.[0]?.name ?? null;
}

function extractFromTitle(portal) {
  // Fallback: parse company from page title
  // "Software Engineer at Stripe - Greenhouse" → "Stripe"
  const title = document.title;
  const match = title.match(/at (.+?) [-–|]/);
  return match?.[1] ?? 'Unknown Company';
}
```

**Key selectors for Greenhouse:**
| Field | Selector |
|-------|----------|
| Company | `.company-name` or page title |
| Job Title | `.app-title h1` |
| Job Description | `#content` or `.job-description` |
| Resume Input | `input[type="file"]` |
| Submit Button | `input[type="submit"]`, `button[type="submit"]` |

---

## Parser 2 — Workday

**URL pattern:** `*.myworkdayjobs.com/*`

Workday is more complex — it's a React SPA. Selectors are less stable but still consistent across companies.

```javascript
// parsers/workday.js

export function parse() {
  const job_title = document.querySelector('[data-automation-id="jobPostingHeader"]')
    ?.innerText?.trim();

  const company = extractCompanyFromWorkdayUrl();

  const job_description = document.querySelector('[data-automation-id="jobPostingDescription"]')
    ?.innerText?.trim();

  const resume_filename = getResumeFilename();

  return {
    company,
    job_title,
    job_description,
    portal: 'workday',
    resume_filename,
    url: window.location.href
  };
}

function extractCompanyFromWorkdayUrl() {
  // URL: amazon.myworkdayjobs.com → "Amazon"
  const hostname = window.location.hostname;
  const company = hostname.split('.')[0];
  return company.charAt(0).toUpperCase() + company.slice(1);
}

function getResumeFilename() {
  // Workday uses a custom file upload — look for the filename display element
  const filenameEl = document.querySelector('[data-automation-id="file-upload-filename"]');
  return filenameEl?.innerText?.trim() ?? null;
}
```

**Key selectors for Workday:**
| Field | Selector |
|-------|----------|
| Job Title | `[data-automation-id="jobPostingHeader"]` |
| Company | Extracted from subdomain |
| Job Description | `[data-automation-id="jobPostingDescription"]` |
| Resume Filename | `[data-automation-id="file-upload-filename"]` |
| Submit Button | `[data-automation-id="bottom-navigation-next-button"]` |

> **Note:** Workday uses multi-step forms. Hook into the final submit, not intermediate "Next" buttons.

---

## Parser 3 — Lever

**URL pattern:** `jobs.lever.co/*`

Lever is simpler than Workday. Clean HTML, easy to parse.

```javascript
// parsers/lever.js

export function parse() {
  const job_title = document.querySelector('.posting-headline h2')?.innerText?.trim();

  const company = document.querySelector('.main-header-text .posting-categories .sort-by-team')
    ?.innerText?.trim()
    ?? extractFromLeverUrl();

  const job_description = document.querySelector('.section-wrapper')?.innerText?.trim();

  const resume_filename = getResumeFilename();

  return {
    company,
    job_title,
    job_description,
    portal: 'lever',
    resume_filename,
    url: window.location.href
  };
}

function extractFromLeverUrl() {
  // URL: jobs.lever.co/stripe/abc123 → "Stripe"
  const parts = window.location.pathname.split('/');
  const company = parts[1];
  return company.charAt(0).toUpperCase() + company.slice(1);
}

function getResumeFilename() {
  const fileInput = document.querySelector('input[type="file"]');
  return fileInput?.files?.[0]?.name ?? null;
}
```

**Key selectors for Lever:**
| Field | Selector |
|-------|----------|
| Job Title | `.posting-headline h2` |
| Company | From URL path |
| Job Description | `.section-wrapper` |
| Resume Input | `input[type="file"]` |
| Submit Button | `button[type="submit"]` |

---

## Parser 4 — LLM Fallback

Used when `detectPortal()` returns `'unknown'`.

### How It Works

```
Extension detects unknown site
↓
Extracts sanitized DOM (removes scripts, styles, nav, footer)
↓
Sends DOM text to backend /api/parse-llm
↓
Backend sends to Claude API with structured prompt
↓
Claude returns JSON with extracted fields
↓
Extension uses the JSON to populate save popup
↓
User confirms or edits before saving
```

### DOM Sanitization (in content.js)

```javascript
export function extractCleanDOM() {
  const clone = document.body.cloneNode(true);
  
  // Remove noise
  ['script', 'style', 'nav', 'footer', 'header', 'iframe'].forEach(tag => {
    clone.querySelectorAll(tag).forEach(el => el.remove());
  });

  // Limit to 8000 characters to control token usage
  return clone.innerText.slice(0, 8000);
}
```

### Backend LLM Parser (/api/parse-llm)

```javascript
// backend/routes/parse-llm.js

const prompt = `
You are analyzing the text content of a job application page.
Extract the following fields and return ONLY valid JSON, nothing else.

Text content:
${domText}

Return this exact JSON structure:
{
  "company": "company name or null",
  "job_title": "job title or null", 
  "job_description": "full job description text or null",
  "confidence": "high | medium | low"
}

Rules:
- If you cannot find a field, use null
- job_description should be the full requirements/responsibilities text
- Do not include application form fields in job_description
- company should be the hiring company, not the ATS platform name
`;

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1000,
  messages: [{ role: 'user', content: prompt }]
});

const result = JSON.parse(response.content[0].text);
```

### LLM Fallback UI in Popup

When LLM parser is used, the popup shows the extracted data with edit fields:

```
┌─────────────────────────────────┐
│  🎯 JobTracker                  │
│  ⚡ Auto-detected (verify below) │
├─────────────────────────────────┤
│  Company:   [Stripe          ]  │
│  Role:      [Backend Engineer]  │
│                                 │
│  Resume: backend_v3.pdf ▼       │
│                                 │
│  [Save Application]             │
└─────────────────────────────────┘
```

User can correct any field before saving. This makes it reliable even when LLM makes a mistake.

---

## Adding New Parsers

To add support for a new portal (e.g. iCIMS):

1. Create `extension/content/parsers/icims.js`
2. Export a `parse()` function returning the standard data shape
3. Add URL detection in `detect-portal.js`:
   ```javascript
   if (url.includes('icims.com')) return 'icims';
   ```
4. Import in `content.js` parser map

That's it. The rest of the system works automatically.
