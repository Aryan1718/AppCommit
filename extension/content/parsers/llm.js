import { extractCandidates } from "../../utils/candidate-extractor.js";
import { authFetch } from "../../utils/api.js";

export async function fillMissingFields(existingData) {
  console.log("[AppCommit LLM] Starting with candidates approach");
  const baseData = normalizeExistingData(existingData);
  const candidates = extractCandidates();

  if (candidates.jsonld?.title && candidates.jsonld?.company) {
    console.log("[AppCommit LLM] JSON-LD has full data, skipping LLM");
    return {
      company: baseData.company || normalizeText(candidates.jsonld.company),
      job_title: baseData.job_title || normalizeText(candidates.jsonld.title),
      job_description: baseData.job_description || normalizeText(candidates.jsonld.description),
      portal: baseData.portal,
      url: baseData.url,
      resume_input_selector: candidates.resume_input_selector,
    };
  }

  const needCompany = !baseData.company;
  const needTitle = !baseData.job_title;
  const needDescription = !baseData.job_description;

  if (!needCompany && !needTitle && !needDescription) {
    console.log("[AppCommit LLM] All fields found, no LLM needed");
    return {
      ...baseData,
      resume_input_selector: candidates.resume_input_selector,
    };
  }

  const payload = {
    page_title: normalizeText(document.title),
  };

  if (needTitle || needCompany) {
    payload.role_candidates = candidates.role_candidates;
    payload.company_candidates = candidates.company_candidates;
  }

  if (needDescription) {
    payload.description_candidates = candidates.description_candidates;
  }

  if (candidates.jsonld) {
    payload.jsonld = candidates.jsonld;
  }

  console.log("[AppCommit LLM] Sending candidates to LLM:", {
    hasCandidates: Object.keys(payload).length,
    roleCount: payload.role_candidates?.length,
    companyCount: payload.company_candidates?.length,
    descCount: payload.description_candidates?.length,
  });

  try {
    const response = await authFetch("/api/parse-llm", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      await handleExpiredAuth();
      return {
        ...baseData,
        resume_input_selector: candidates.resume_input_selector,
      };
    }

    if (!response.ok) {
      console.log("[AppCommit LLM] Backend error:", response.status);
      return {
        ...baseData,
        resume_input_selector: candidates.resume_input_selector,
      };
    }

    const result = await response.json();
    console.log("[AppCommit LLM] Result:", result);

    return {
      company: baseData.company || normalizeText(result.company),
      job_title: baseData.job_title || normalizeText(result.job_title),
      job_description: baseData.job_description || normalizeText(result.job_description),
      portal: baseData.portal,
      url: baseData.url,
      resume_input_selector:
        candidates.resume_input_selector || normalizeText(result.resume_input_selector) || null,
    };
  } catch (err) {
    console.log("[AppCommit LLM] Error:", err?.name, err?.message ?? err);
    return {
      ...baseData,
      resume_input_selector: candidates.resume_input_selector,
    };
  }
}

// Normalizes the parser result shape so missing fields are always null.
function normalizeExistingData(existingData) {
  const source = existingData && typeof existingData === "object" ? existingData : {};

  return {
    company: normalizeText(source.company),
    job_title: normalizeText(source.job_title),
    job_description: normalizeText(source.job_description),
    portal: normalizeText(source.portal) || "unknown",
    url: normalizeText(source.url) || window.location.href,
    resume_input_selector: normalizeText(source.resume_input_selector),
  };
}

// Trims text values and converts empty results to null.
function normalizeText(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

async function handleExpiredAuth() {
  console.log("[AppCommit API] LLM request received 401");
}
