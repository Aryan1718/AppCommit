// Parses a Lever job page into normalized job metadata.
export function parse() {
  const company = extractCompanyFromPath();
  const jobTitle =
    normalizeText(document.querySelector?.(".posting-headline h2")?.innerText) ||
    normalizeText(document.querySelector?.(".posting-header h2")?.innerText) ||
    normalizeText(document.querySelector?.("h2.posting-name")?.innerText) ||
    normalizeText(document.querySelector?.('[data-qa="posting-name"]')?.innerText);
  const jobDescription =
    normalizeText(document.querySelector?.('[data-qa="job-description"]')?.innerText) ||
    normalizeText(document.querySelector?.(".posting-content")?.innerText) ||
    normalizeText(document.querySelector?.(".posting-description")?.innerText) ||
    normalizeText(document.querySelector?.('.section.page-centered[data-qa="job-description"]')?.innerText);

  return {
    company,
    job_title: jobTitle,
    job_description: jobDescription,
    portal: "lever",
    url: window.location.href,
  };
}

// Extracts and formats the company name from a Lever URL path.
function extractCompanyFromPath() {
  const pathSegment = normalizeText(window.location.pathname.split("/")?.[1] ?? null);

  if (!pathSegment) {
    return null;
  }

  const formatted = pathSegment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return normalizeText(formatted);
}

// Trims text values and converts empty results to null.
function normalizeText(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}
