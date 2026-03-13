// Parses a Greenhouse job page into normalized job metadata.
export function parse() {
  const isEmbed = window.location.href.includes("/embed/");
  const company =
    normalizeText(document.querySelector?.(".company-name")?.innerText) ||
    normalizeText(document.querySelector?.('[class*="company"]')?.innerText) ||
    normalizeText(document.querySelector?.("#header .name")?.innerText) ||
    extractFromTitle("company") ||
    extractCompanyFromUrl() ||
    (isEmbed ? "Unknown Company" : null);

  const jobTitle =
    normalizeText(document.querySelector?.(".app-title h1")?.innerText) ||
    normalizeText(document.querySelector?.("h1.job-title")?.innerText) ||
    normalizeText(document.querySelector?.("#job_title")?.innerText) ||
    normalizeText(document.querySelector?.('[class*="job-title"]')?.innerText) ||
    normalizeText(document.querySelector?.('[class*="jobtitle"]')?.innerText) ||
    normalizeText(document.querySelector?.("h1")?.innerText) ||
    extractFromTitle("title") ||
    extractTitleFromDocumentTitle();

  const jobDescription =
    normalizeText(document.querySelector?.("#content")?.innerText) ||
    normalizeText(document.querySelector?.(".job-description")?.innerText) ||
    normalizeText(document.querySelector?.("#job-description")?.innerText) ||
    normalizeText(document.querySelector?.('[id*="description"]')?.innerText) ||
    normalizeText(document.querySelector?.('[class*="description"]')?.innerText) ||
    normalizeText(document.querySelector?.("#app_body")?.innerText) ||
    normalizeText(document.querySelector?.(".application-description")?.innerText) ||
    normalizeText(document.querySelector?.("main")?.innerText);

  return {
    company,
    job_title: jobTitle,
    job_description: jobDescription,
    portal: "greenhouse",
    url: window.location.href,
    is_embed: isEmbed,
  };
}

// Returns the current Greenhouse submit button for both standard and embedded forms.
export function getSubmitButton() {
  return (
    document.querySelector?.('input[type="submit"]') ||
    document.querySelector?.('button[type="submit"]') ||
    document.querySelector?.("#submit_app") ||
    document.querySelector?.('[value="Submit Application"]') ||
    document.querySelector?.('button[class*="submit"]') ||
    null
  );
}

// Extracts the requested company or title value from a Greenhouse page title.
function extractFromTitle(part) {
  const title = normalizeText(document.title);

  if (!title) {
    return null;
  }

  const patterns = [
    /^Job Application for\s+(.*?)\s+at\s+(.*?)$/i,
    /^(.*?)\s+at\s+(.*?)\s+-\s+Greenhouse$/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);

    if (!match) {
      continue;
    }

    if (part === "title") {
      return normalizeText(match[1]);
    }

    if (part === "company") {
      return normalizeText(match[2]);
    }
  }

  return null;
}

function extractTitleFromDocumentTitle() {
  const title = normalizeText(document.title);

  if (!title) {
    return null;
  }

  const atIndex = title.indexOf(" at ");

  if (atIndex > 0) {
    return normalizeText(title.slice(0, atIndex));
  }

  const dashIndex = title.indexOf(" - ");

  if (dashIndex > 0) {
    return normalizeText(title.slice(0, dashIndex));
  }

  return null;
}

// Extracts the company slug from supported Greenhouse URL formats and formats it.
function extractCompanyFromUrl() {
  const url = normalizeText(window.location.href);

  if (!url) {
    return null;
  }

  const match =
    url.match(/job-boards(?:\.cdn)?\.greenhouse\.io\/([^/]+)\/jobs(?:\/|$)/i) ||
    url.match(/boards\.greenhouse\.io\/([^/]+)\/jobs(?:\/|$)/i) ||
    url.match(/https?:\/\/([^/.]+)\.greenhouse\.io\/jobs(?:\/|$)/i) ||
    url.match(/[?&]for=([^&]+)/i);

  return formatSlug(match?.[1] ?? null);
}

// Formats a slug into a capitalized company-style string.
function formatSlug(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  return normalizeText(
    normalized
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  );
}

// Trims text values and converts empty results to null.
function normalizeText(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

// Development helper. This can be removed before Chrome Web Store submission.
export function debugParse() {
  const result = parse();
  console.log("[AppCommit Greenhouse Parser]", result);
  return result;
}
