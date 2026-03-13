// Parses a Workday job page into normalized job metadata.
export function parse() {
  const company = extractCompanyFromHostname();
  const jobTitle =
    normalizeText(document.querySelector?.('[data-automation-id="jobPostingHeader"]')?.innerText) ||
    normalizeText(document.querySelector?.("h2.css-1q5uzed")?.innerText) ||
    normalizeText(document.querySelector?.('[class*="jobTitle"]')?.innerText);
  const jobDescription =
    normalizeText(document.querySelector?.('[data-automation-id="jobPostingDescription"]')?.innerText) ||
    normalizeText(document.querySelector?.(".job-description")?.innerText) ||
    normalizeText(document.querySelector?.('[class*="description"]')?.innerText);

  return {
    company,
    job_title: jobTitle,
    job_description: jobDescription,
    portal: "workday",
    url: window.location.href,
  };
}

// Extracts and formats the company name from a Workday hostname.
function extractCompanyFromHostname() {
  const hostname = normalizeText(window.location.hostname);

  if (!hostname) {
    return null;
  }

  const subdomain = hostname.split(".")?.[0] ?? "";
  const formatted = subdomain
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

// Workday is a multi-step form. The caller (content.js) is responsible for
// detecting the final submit step. This parser just extracts whatever is
// visible on the current page.
