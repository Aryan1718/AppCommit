const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export function watchResumeInput(selector, onFileSelected) {
  const input = findBestResumeInput(selector);

  if (!input) {
    console.log("[AppCommit Resume] No file input found on page");
    return { found: false, hasExistingFile: false, existingFile: null };
  }

  const existingFile = input.files?.[0] ?? null;
  if (existingFile) {
    console.log("[AppCommit Resume] Pre-filled file found:", existingFile.name);
  }

  if (input.dataset.appcommitResumeWatchBound !== "true") {
    input.dataset.appcommitResumeWatchBound = "true";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }

      console.log("[AppCommit Resume] File attached:", file.name);

      const error = validateResumeFile(file);
      if (error) {
        onFileSelected(null, error);
        return;
      }

      const base64 = await fileToBase64(file);
      onFileSelected(
        {
          filename: file.name,
          mimetype: file.type,
          size: file.size,
          base64,
          source: "form",
        },
        null,
      );
    });
  }

  return {
    found: true,
    hasExistingFile: Boolean(existingFile),
    existingFile: existingFile
      ? {
          filename: existingFile.name,
          size: existingFile.size,
        }
      : null,
  };
}

function findBestResumeInput(preferredSelector) {
  const candidates = new Map();

  for (const selector of [preferredSelector, 'input[type="file"]', 'input[name*="resume" i]', 'input[name*="cv" i]', 'input[accept*="pdf"]', '[data-testid*="resume" i]', '[aria-label*="resume" i]'].filter(Boolean)) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (
          element instanceof HTMLInputElement &&
          element.type === "file" &&
          !isAppCommitElement(element)
        ) {
          const existing = candidates.get(element) ?? 0;
          candidates.set(element, existing + scoreResumeInput(element, selector));
        }
      }
    } catch {
      continue;
    }
  }

  let bestInput = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const [input, score] of candidates.entries()) {
    if (score > bestScore) {
      bestInput = input;
      bestScore = score;
    }
  }

  if (bestInput) {
    console.log(
      "[AppCommit Resume] Found input with:",
      preferredSelector && bestScore > 0 ? preferredSelector : describeResumeInput(bestInput),
      "score:",
      bestScore,
    );
  }

  return bestInput;
}

function scoreResumeInput(input, selector) {
  let score = 0;
  const attributeText = [
    input.name,
    input.id,
    input.className,
    input.getAttribute("aria-label"),
    input.getAttribute("data-testid"),
    selector,
  ]
    .map((value) => normalizeText(value)?.toLowerCase())
    .filter(Boolean)
    .join(" ");

  if (attributeText.includes("resume") || attributeText.includes("cv")) {
    score += 10;
  }

  if (attributeText.includes("cover")) {
    score -= 5;
  }

  const contextText = getContextText(input);
  if (contextText.includes("resume") || contextText.includes("curriculum vitae") || contextText.includes("cv")) {
    score += 25;
  }

  if (contextText.includes("upload resume") || contextText.includes("attach resume")) {
    score += 10;
  }

  if (contextText.includes("cover letter")) {
    score -= 8;
  }

  if (input.accept?.toLowerCase().includes("pdf")) {
    score += 2;
  }

  return score;
}

function getContextText(input) {
  const texts = [];
  const labelByFor = input.id ? document.querySelector(`label[for="${cssEscape(input.id)}"]`) : null;
  const parentLabel = input.closest("label");
  const container = input.closest('[class*="field" i], [class*="upload" i], [class*="resume" i], [data-testid*="resume" i]');

  for (const value of [
    labelByFor?.textContent,
    parentLabel?.textContent,
    input.getAttribute("aria-label"),
    container?.textContent,
    input.previousElementSibling?.textContent,
  ]) {
    const normalized = normalizeText(value);
    if (normalized) {
      texts.push(normalized.toLowerCase());
    }
  }

  return texts.join(" ");
}

function describeResumeInput(input) {
  if (input.id) {
    return `#${input.id}`;
  }

  if (input.name) {
    return `input[name="${input.name}"]`;
  }

  return 'input[type="file"]';
}

function isAppCommitElement(element) {
  return Boolean(
    element?.closest?.("#appcommit-sidebar") ||
      element?.closest?.("#appcommit-tab"),
  );
}

function normalizeText(value) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text || null;
}

function cssEscape(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return String(value).replace(/["\\#.:()[\]]/g, "\\$&");
}

export async function readFileAsResume(file) {
  const error = validateResumeFile(file);
  if (error) {
    return { error };
  }

  const base64 = await fileToBase64(file);
  return {
    filename: file.name,
    mimetype: file.type,
    size: file.size,
    base64,
  };
}

function validateResumeFile(file) {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return "Invalid file type. Use PDF or Word.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "File too large. Max 5MB.";
  }

  return null;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
