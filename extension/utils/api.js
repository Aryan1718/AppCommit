import { runtimeConfig } from "../config.js";

const BASE_URL = runtimeConfig.apiBaseUrl;

function buildHeaders(options = {}) {
  const headers = new Headers(options.headers ?? {});
  const hasBody = options.body !== undefined && options.body !== null;

  if (hasBody && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

function isBackgroundContext() {
  return typeof window === "undefined";
}

async function readErrorText(response) {
  try {
    const text = await response.text();
    return text || "";
  } catch {
    return "";
  }
}

export async function authFetch(path, options = {}) {
  if (!isBackgroundContext()) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "API_FETCH",
        data: {
          path,
          method: options.method ?? "GET",
          body: options.body ?? null,
        },
      });

      if (!response) {
        throw new Error("No response from background");
      }

      if (response.error) {
        throw new Error(response.error);
      }

      return {
        ok: response.ok,
        status: response.status,
        json: async () => response.data,
        text: async () =>
          typeof response.data === "string"
            ? response.data
            : response.data === null || response.data === undefined
              ? ""
              : JSON.stringify(response.data),
      };
    } catch (err) {
      console.log("[AppCommit API] authFetch error:", err?.message ?? err);
      throw err;
    }
  }

  const headers = buildHeaders(options);

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  return response;
}

export async function checkAuth() {
  try {
    const response = await authFetch("/api/auth/me", { method: "GET" });

    if (!response.ok) {
      console.log("[AppCommit Auth] Auth check server error:", response.status);
      return { authenticated: false, reason: "server_error" };
    }

    const data = await response.json();
    console.log("[AppCommit Auth] Authenticated:", Boolean(data));
    return { authenticated: true, user: data };
  } catch (err) {
    console.log("[AppCommit Auth] Network error:", err?.message ?? err);
    return { authenticated: false, reason: "network_error" };
  }
}

export async function saveApplication(data) {
  try {
    const response = await authFetch("/api/applications", {
      method: "POST",
      body: JSON.stringify({
        company: data?.company ?? null,
        job_title: data?.job_title ?? null,
        job_description: data?.job_description ?? null,
        portal: data?.portal ?? null,
        resume_id: data?.resume_id ?? null,
        resume_filename: data?.resume_filename ?? null,
        url: data?.url ?? null,
      }),
    });

    if (!response.ok) {
      const errorText = await readErrorText(response);
      return {
        success: false,
        status: response.status,
        error: errorText || "Application save failed",
      };
    }

    return { success: true, data: await response.json() };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Application save request failed",
      reason: "network_error",
    };
  }
}

export async function uploadResume(payload) {
  try {
    const response = await authFetch("/api/resumes/upload", {
      method: "POST",
      body: JSON.stringify({
        filename: payload?.filename ?? null,
        mimetype: payload?.mimetype ?? null,
        size: payload?.size ?? null,
        base64: payload?.base64 ?? null,
      }),
    });

    if (!response.ok) {
      const errorText = await readErrorText(response);
      return {
        success: false,
        status: response.status,
        error: errorText || "Resume upload failed",
      };
    }

    return { success: true, data: await response.json() };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Resume upload request failed",
      reason: "network_error",
    };
  }
}

export async function getResumes() {
  try {
    const response = await authFetch("/api/resumes", {
      method: "GET",
    });

    if (!response.ok) {
      console.log("[AppCommit Auth] Resume list failed:", response.status);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.log("[AppCommit Auth] Resume list network error:", err);
    return [];
  }
}

export async function parseLLM(payload) {
  try {
    const response = await authFetch("/api/parse-llm", {
      method: "POST",
      body: JSON.stringify(payload && typeof payload === "object" ? payload : {}),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}
