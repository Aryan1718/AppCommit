function normalizeText(value) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text || null;
}

export function cleanJobData(data) {
  if (!data || typeof data !== "object") {
    return data;
  }

  return {
    ...data,
    company: cleanCompanyName(data.company),
    job_title: cleanJobTitle(data.job_title),
  };
}

function cleanCompanyName(name) {
  if (!name || typeof name !== "string") {
    return null;
  }

  let cleaned = name.trim();
  const original = cleaned;

  const trailingNoise = [
    /\s*[-–|]\s*careers?$/i,
    /\s*[-–|]\s*jobs?$/i,
    /\s*[-–|]\s*hiring$/i,
    /\s*[-–|]\s*job board$/i,
    /\s+careers?$/i,
    /\s+hiring$/i,
    /\s+inc\.?$/i,
    /\s+llc\.?$/i,
    /\s+ltd\.?$/i,
    /\s+corp\.?$/i,
    /\s+via\s+[a-z0-9 .&'-]+$/i,
  ];

  for (const pattern of trailingNoise) {
    cleaned = cleaned.replace(pattern, "").trim();
  }

  const leadingNoise = [/^via\s+/i, /^at\s+/i, /^by\s+/i, /^from\s+/i, /^jobs?\s+at\s+/i];
  for (const pattern of leadingNoise) {
    cleaned = cleaned.replace(pattern, "").trim();
  }

  const parts = cleaned.split(/\s+at\s+/i);
  if (parts.length === 2) {
    const [beforeAt, afterAt] = parts;
    const jobWords = [
      "engineer",
      "manager",
      "designer",
      "analyst",
      "developer",
      "lead",
      "director",
      "intern",
      "scientist",
      "architect",
      "consultant",
      "associate",
      "specialist",
      "coordinator",
      "head",
      "vp",
      "chief",
    ];
    const looksLikeTitle = jobWords.some((word) => beforeAt.toLowerCase().includes(word));
    if (looksLikeTitle && afterAt.trim()) {
      cleaned = afterAt.trim();
    }
  }

  return cleaned || original;
}

function cleanJobTitle(title) {
  if (!title || typeof title !== "string") {
    return null;
  }

  let cleaned = title.trim();
  const original = cleaned;

  const sitePrefixes = [/^via\s+\w+\s*[-–:]\s*/i, /^from\s+\w+\s*[-–:]\s*/i];
  for (const pattern of sitePrefixes) {
    cleaned = cleaned.replace(pattern, "").trim();
  }

  cleaned = cleaned.replace(/\s+at\s+.+$/i, "").trim();
  cleaned = cleaned.replace(/\s*[-–|]\s*(careers?|jobs?|job board|hiring)$/i, "").trim();
  cleaned = cleaned.replace(/\s*[-–|]\s*via\s+[a-z0-9 .&'-]+$/i, "").trim();
  cleaned = cleaned.replace(/,\s*(remote|hybrid|onsite)$/i, "").trim();

  return cleaned || original;
}

function truncateText(value, maxLength) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function deduplicateCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const normalized = normalizeText(candidate?.text)?.toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

function parseJsonLdValue(raw) {
  if (!raw || typeof raw !== "object") {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.flatMap((item) => parseJsonLdValue(item));
  }

  const graph = Array.isArray(raw["@graph"]) ? raw["@graph"] : null;
  if (graph) {
    return graph.flatMap((item) => parseJsonLdValue(item));
  }

  return [raw];
}

function extractJsonLD() {
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      const rawText = script.textContent?.trim();
      if (!rawText) {
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        continue;
      }

      const items = parseJsonLdValue(parsed);
      for (const item of items) {
        const typeValue = item?.["@type"];
        const types = Array.isArray(typeValue) ? typeValue : [typeValue];

        if (!types.includes("JobPosting")) {
          continue;
        }

        console.log("[AppCommit Extractor] Found JSON-LD JobPosting");
        return {
          title: truncateText(item.title, 200),
          company: truncateText(
            typeof item.hiringOrganization === "string"
              ? item.hiringOrganization
              : item.hiringOrganization?.name,
            200,
          ),
          description: truncateText(item.description, 800),
          identifier: item.identifier ?? null,
        };
      }
    }
  } catch (err) {
    console.log("[AppCommit Extractor] JSON-LD parse error:", err);
  }

  return null;
}

function extractRoleCandidates() {
  const candidates = [];

  document.querySelectorAll("h1").forEach((element) => {
    const text = normalizeText(element.innerText);
    if (text && text.length < 100) {
      candidates.push({ text, score: 10, source: "h1" });
    }
  });

  const title = normalizeText(document.title);
  if (title) {
    const atMatch = title.match(/^(.+?)\s+at\s+/i);
    if (atMatch?.[1]) {
      candidates.push({
        text: atMatch[1].trim(),
        score: 8,
        source: "title_at",
      });
    }

    const pipeMatch = title.match(/^(.+?)\s*[\|\u2013-]\s*/i);
    if (pipeMatch?.[1] && pipeMatch[1].trim().length < 80) {
      candidates.push({
        text: pipeMatch[1].trim(),
        score: 7,
        source: "title_pipe",
      });
    }

    candidates.push({ text: title, score: 3, source: "title_full" });
  }

  const ogTitle = normalizeText(document.querySelector('meta[property="og:title"]')?.content);
  if (ogTitle) {
    candidates.push({ text: ogTitle, score: 6, source: "og_title" });
  }

  const applyArea = document.querySelector(
    '[class*="apply" i], [id*="apply" i], [class*="job-header" i]',
  );
  if (applyArea) {
    const heading = applyArea.querySelector("h2, h3");
    const text = normalizeText(heading?.innerText);
    if (text) {
      candidates.push({
        text,
        score: 9,
        source: "apply_heading",
      });
    }
  }

  const mainHeading = document.querySelector('[role="heading"][aria-level="1"], [class*="job-title" i]');
  if (mainHeading) {
    const text = normalizeText(mainHeading.innerText);
    if (text) {
      candidates.push({
        text,
        score: 9,
        source: "aria_heading",
      });
    }
  }

  return deduplicateCandidates(candidates)
    .filter((candidate) => candidate.text && candidate.text.length > 2 && candidate.text.length < 120)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map((candidate) => candidate.text);
}

function extractCompanyCandidates() {
  const candidates = [];
  const title = normalizeText(document.title);

  if (title) {
    const atMatch = title.match(/\bat\s+(.+?)(?:\s*[\|\-\u2013]|$)/i);
    if (atMatch?.[1]) {
      candidates.push({
        text: atMatch[1].trim(),
        score: 8,
        source: "title_after_at",
      });
    }

    const pipeMatch = title.match(/[\|\-\u2013]\s*(.+)$/);
    if (pipeMatch?.[1]) {
      candidates.push({
        text: pipeMatch[1].trim(),
        score: 6,
        source: "title_after_pipe",
      });
    }
  }

  document
    .querySelectorAll('img[alt*="logo" i], [class*="logo" i] img, [id*="logo" i] img')
    .forEach((logo) => {
      const text = normalizeText(logo.alt);
      if (text && text.length > 1 && text.length < 50) {
        candidates.push({ text, score: 7, source: "logo_alt" });
      }
    });

  const brand = document.querySelector('.navbar-brand, [class*="brand" i], [class*="company-name" i]');
  if (brand) {
    const text = normalizeText(brand.innerText);
    if (text && text.length < 60) {
      candidates.push({ text, score: 8, source: "brand" });
    }
  }

  const siteName = normalizeText(document.querySelector('meta[property="og:site_name"]')?.content);
  if (siteName) {
    candidates.push({ text: siteName, score: 7, source: "og_site" });
  }

  const footer = document.querySelector("footer");
  if (footer) {
    const footerText = normalizeText(footer.innerText);
    const copyrightMatch = footerText?.match(/©\s*\d{4}\s+(.+?)(?:\.|,|All rights)/i);
    if (copyrightMatch?.[1]) {
      candidates.push({
        text: copyrightMatch[1].trim(),
        score: 5,
        source: "footer_copyright",
      });
    }
  }

  return deduplicateCandidates(candidates)
    .filter((candidate) => candidate.text && candidate.text.length > 1 && candidate.text.length < 80)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map((candidate) => candidate.text);
}

function extractDescriptionCandidates() {
  const candidates = [];
  const descriptionLabels = [
    "job description",
    "about the role",
    "about this role",
    "about the job",
    "the role",
    "position overview",
    "role overview",
    "what you will do",
    "what you'll do",
    "responsibilities",
    "about this position",
    "job details",
    "role description",
    "about the opportunity",
  ];
  const skipHeadings = [
    "about us",
    "about the company",
    "who we are",
    "our company",
    "company overview",
    "our mission",
    "our values",
    "benefits",
    "perks",
    "compensation",
  ];
  const labelSelectors = [
    "h1",
    "h2",
    "h3",
    "h4",
    "strong",
    "b",
    '[class*="label" i]',
    '[class*="heading" i]',
    '[class*="title" i]',
    "dt",
    "legend",
  ];
  const atsSectionSelectors = [
    '[class*="job-description" i]',
    '[id*="job-description" i]',
    '[class*="jobDescription" i]',
    '[class*="posting-description" i]',
    '[class*="section-wrapper" i]',
    '[data-automation-id*="jobPostingDescription"]',
    '[class*="job-requisition-description" i]',
    '[class*="description-content" i]',
    '[class*="job-detail" i]',
    '[class*="jobdetail" i]',
    '[id*="jobdetail" i]',
    'article[class*="job" i]',
  ];

  const addCandidate = (text, score, source) => {
    const normalized = normalizeText(text);
    if (!normalized || normalized.length <= 100) {
      return;
    }

    const candidate = {
      text: normalized.slice(0, 3000),
      score,
      source,
    };

    candidates.push(candidate);
    console.log("[AppCommit Extractor] Description candidate:", {
      source,
      score,
      preview: `${candidate.text.slice(0, 80)}...`,
    });
  };

  const isDescriptionLabel = (text) =>
    descriptionLabels.some(
      (label) => text === label || text.startsWith(label) || label.includes(text),
    );

  const isSkipHeading = (text) => skipHeadings.some((heading) => text.includes(heading));

  for (const selector of labelSelectors) {
    const elements = document.querySelectorAll(selector);

    for (const element of elements) {
      const text = normalizeText(element.innerText)?.toLowerCase();
      if (!text || !isDescriptionLabel(text)) {
        continue;
      }

      console.log("[AppCommit Extractor] Found description label:", element.innerText.trim());

      let content = "";
      let sibling = element.nextElementSibling;
      let siblingCount = 0;

      while (sibling && siblingCount < 8) {
        const tag = sibling.tagName?.toLowerCase();

        if (["h1", "h2", "h3"].includes(tag)) {
          const siblingHeading = normalizeText(sibling.innerText)?.toLowerCase() ?? "";
          if (!descriptionLabels.some((label) => siblingHeading.includes(label))) {
            break;
          }
        }

        const siblingText = normalizeText(sibling.innerText);
        if (siblingText) {
          content += ` ${siblingText}`;
        }

        sibling = sibling.nextElementSibling;
        siblingCount += 1;
      }

      addCandidate(content, 15, `after_label_${element.innerText.trim()}`);

      const parent = element.parentElement;
      if (parent) {
        const parentText = normalizeText(parent.innerText);
        const labelText = normalizeText(element.innerText);
        const startIndex = parentText && labelText ? parentText.indexOf(labelText) : -1;
        const afterLabel =
          startIndex >= 0 ? parentText.slice(startIndex + labelText.length).trim() : null;

        addCandidate(afterLabel, 12, "parent_after_label");
      }
    }
  }

  for (const selector of atsSectionSelectors) {
    try {
      const element = document.querySelector(selector);
      const text = normalizeText(element?.innerText);
      if (!text) {
        continue;
      }

      const startsWithCompany = /^about\s+(us|the\s+company|our\s+company)/i.test(text);
      addCandidate(text, startsWithCompany ? 6 : 10, selector);
      break;
    } catch {
      continue;
    }
  }

  if (candidates.filter((candidate) => candidate.score >= 10).length === 0) {
    const mainSelectors = ["main", '[role="main"]', "article"];

    for (const selector of mainSelectors) {
      const element = document.querySelector(selector);
      if (!element) {
        continue;
      }

      const sections = element.querySelectorAll(
        'section, div[class*="section" i], div[class*="block" i]',
      );

      for (const section of sections) {
        const firstHeading = section.querySelector("h1, h2, h3, h4");
        const headingText = normalizeText(firstHeading?.innerText)?.toLowerCase() ?? "";

        if (headingText && isSkipHeading(headingText)) {
          console.log("[AppCommit Extractor] Skipping company section:", headingText);
          continue;
        }

        const isJobSection = descriptionLabels.some((label) => headingText.includes(label));
        const text = normalizeText(section.innerText);
        if (!text) {
          continue;
        }

        addCandidate(text, isJobSection ? 8 : 4, `main_section_${headingText || "unknown"}`);
      }

      break;
    }
  }

  const sorted = deduplicateCandidates(candidates)
    .filter((candidate) => candidate.text && candidate.text.length > 100)
    .sort((left, right) => right.score - left.score);

  console.log(
    "[AppCommit Extractor] Description candidates found:",
    sorted.map((candidate) => ({
      source: candidate.source,
      score: candidate.score,
      preview: `${candidate.text.slice(0, 80)}...`,
    })),
  );

  return sorted.slice(0, 2).map((candidate) => candidate.text);
}

function findResumeInputSelector() {
  const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')).filter(
    (element) => element instanceof HTMLInputElement && !isAppCommitElement(element),
  );

  if (fileInputs.length === 0) {
    console.log("[AppCommit Extractor] No resume input found locally");
    return null;
  }

  let bestMatch = null;

  for (const input of fileInputs) {
    const score = scoreResumeInput(input);
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { input, score };
    }
  }

  if (!bestMatch) {
    return null;
  }

  const selector = buildSelectorForInput(bestMatch.input);

  if (bestMatch.score <= 0) {
    console.log("[AppCommit Extractor] Low-confidence resume input fallback:", selector);
    return selector;
  }

  console.log("[AppCommit Extractor] Resume input found:", selector, "score:", bestMatch.score);
  return selector;
}

function scoreResumeInput(input) {
  const keywords = ["resume", "cv", "curriculum vitae"];
  const uploadKeywords = ["upload resume", "attach resume", "resume upload", "add resume"];
  let score = 0;

  const attributeValues = [
    input.name,
    input.id,
    input.className,
    input.getAttribute("aria-label"),
    input.getAttribute("data-testid"),
    input.getAttribute("accept"),
  ]
    .map((value) => normalizeText(value)?.toLowerCase())
    .filter(Boolean);

  for (const value of attributeValues) {
    if (keywords.some((keyword) => value.includes(keyword))) {
      score += 10;
    }
    if (uploadKeywords.some((keyword) => value.includes(keyword))) {
      score += 6;
    }
  }

  const associatedText = getResumeContextText(input);
  if (associatedText) {
    if (keywords.some((keyword) => associatedText.includes(keyword))) {
      score += 20;
    }
    if (uploadKeywords.some((keyword) => associatedText.includes(keyword))) {
      score += 10;
    }
    if (associatedText.includes("cover letter")) {
      score -= 8;
    }
  }

  if (input.accept?.toLowerCase().includes("pdf")) {
    score += 2;
  }

  return score;
}

function getResumeContextText(input) {
  const textParts = [];
  const labelByFor = input.id ? document.querySelector(`label[for="${cssEscape(input.id)}"]`) : null;
  const parentLabel = input.closest("label");
  const fieldContainer = input.closest('[class*="field" i], [class*="upload" i], [class*="resume" i]');
  const previousSiblingText = normalizeText(input.previousElementSibling?.textContent);

  for (const value of [
    labelByFor?.textContent,
    parentLabel?.textContent,
    fieldContainer?.textContent,
    previousSiblingText,
  ]) {
    const normalized = normalizeText(value);
    if (normalized) {
      textParts.push(normalized.toLowerCase());
    }
  }

  return textParts.join(" ");
}

function isAppCommitElement(element) {
  return Boolean(
    element?.closest?.("#appcommit-sidebar") ||
      element?.closest?.("#appcommit-tab"),
  );
}

function buildSelectorForInput(input) {
  if (input.id) {
    return `#${cssEscape(input.id)}`;
  }

  for (const attribute of ["name", "data-automation-id", "data-testid", "aria-label", "accept"]) {
    const value = input.getAttribute(attribute);
    if (value) {
      return `input[type="file"][${attribute}="${cssEscape(value)}"]`;
    }
  }

  const form = input.closest("form");
  if (form instanceof HTMLFormElement) {
    const scopedSelector = buildScopedSelector(input, form);
    if (scopedSelector) {
      return scopedSelector;
    }
  }

  const pathSelector = buildDomPathSelector(input);
  if (pathSelector) {
    return pathSelector;
  }

  return 'input[type="file"]';
}

function buildScopedSelector(input, boundary) {
  const formId = boundary.getAttribute("id");
  const inputPath = buildDomPathSelector(input, boundary);

  if (formId && inputPath) {
    return `form#${cssEscape(formId)} ${inputPath}`;
  }

  const formName = boundary.getAttribute("name");
  if (formName && inputPath) {
    return `form[name="${cssEscape(formName)}"] ${inputPath}`;
  }

  return inputPath;
}

function buildDomPathSelector(element, stopAt = document.body) {
  if (!(element instanceof Element)) {
    return null;
  }

  const segments = [];
  let current = element;

  while (current && current !== stopAt && current !== document.body) {
    const segment = getSelectorSegment(current);
    if (!segment) {
      return null;
    }
    segments.unshift(segment);
    current = current.parentElement;
  }

  return segments.join(" > ") || null;
}

function getSelectorSegment(element) {
  if (!(element instanceof Element)) {
    return null;
  }

  const tagName = element.tagName.toLowerCase();

  if (element.id) {
    return `${tagName}#${cssEscape(element.id)}`;
  }

  for (const attribute of ["name", "data-automation-id", "data-testid", "aria-label"]) {
    const value = element.getAttribute(attribute);
    if (value) {
      return `${tagName}[${attribute}="${cssEscape(value)}"]`;
    }
  }

  const siblings = Array.from(element.parentElement?.children ?? []).filter(
    (child) => child.tagName === element.tagName,
  );
  const siblingIndex = siblings.indexOf(element);

  if (siblingIndex === -1) {
    return tagName;
  }

  return `${tagName}:nth-of-type(${siblingIndex + 1})`;
}

function cssEscape(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return String(value).replace(/["\\#.:()[\]]/g, "\\$&");
}

export function extractResumeInputSelector() {
  console.log("[AppCommit Extractor] Checking resume input selector only");
  return findResumeInputSelector();
}

export function extractCandidates() {
  console.log("[AppCommit Extractor] Starting local extraction");

  try {
    const jsonld = extractJsonLD();
    const roleCandidates = extractRoleCandidates();
    const companyCandidates = extractCompanyCandidates();
    const descriptionCandidates = extractDescriptionCandidates();
    const resumeInputSelector = findResumeInputSelector();

    const result = {
      role_candidates: roleCandidates,
      company_candidates: companyCandidates,
      description_candidates: descriptionCandidates,
      resume_input_selector: resumeInputSelector,
      jsonld,
    };

    console.log("[AppCommit Extractor] Extraction complete:", {
      roles: roleCandidates.length,
      companies: companyCandidates.length,
      descriptions: descriptionCandidates.length,
      hasJsonLD: Boolean(jsonld),
      hasResumeInput: Boolean(resumeInputSelector),
    });

    return result;
  } catch (err) {
    console.log("[AppCommit Extractor] Extraction failed:", err);
    return {
      role_candidates: [],
      company_candidates: [],
      description_candidates: [],
      resume_input_selector: null,
      jsonld: null,
    };
  }
}
