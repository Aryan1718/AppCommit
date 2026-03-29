const BASE_URL = "http://localhost:8000";

export class AuthError extends Error {
  constructor(reason) {
    super(`Auth error: ${reason}`);
    this.name = "AuthError";
    this.reason = reason;
  }
}

export async function getToken() {
  try {
    const result = await chrome.storage.local.get("token");
    return result?.token ?? null;
  } catch (err) {
    console.log("[AppCommit Auth] Error getting token:", err);
    return null;
  }
}

export async function saveToken(token, metadata = {}) {
  const nextState = {
    token,
    ...metadata,
  };

  await chrome.storage.local.set(nextState);
  await chrome.storage.local.remove("userEmail");
  console.log("[AppCommit Auth] Token saved");
}

export async function clearToken() {
  await chrome.storage.local.remove(["token", "tokenExpiresAt", "userEmail"]);
  console.log("[AppCommit Auth] Token cleared");
}

async function notifyAuthExpired(reason = "token_expired") {
  try {
    await chrome.runtime.sendMessage({ type: "AUTH_EXPIRED", reason });
  } catch (err) {
    console.log("[AppCommit Auth] Could not broadcast auth expiry:", err);
  }
}

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

  const token = await getToken();

  if (!token) {
    console.log("[AppCommit Auth] No token for request:", path);
    throw new AuthError("not_authenticated");
  }

  const headers = buildHeaders(options);
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    console.log("[AppCommit Auth] 401 on:", path, "clearing token");
    await clearToken();
    await notifyAuthExpired("token_expired");
    throw new AuthError("token_expired");
  }

  return response;
}

function isAuthError(error) {
  return error instanceof AuthError;
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
    if (isAuthError(err)) {
      return { authenticated: false, reason: err.reason };
    }

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
    if (isAuthError(err)) {
      return {
        success: false,
        status: 401,
        error: err.message,
        reason: err.reason,
      };
    }

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
    if (isAuthError(err)) {
      return {
        success: false,
        status: 401,
        error: err.message,
        reason: err.reason,
      };
    }

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
    if (!isAuthError(err)) {
      console.log("[AppCommit Auth] Resume list network error:", err);
    }
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
