import { runtimeConfig } from "./config.js";
import {
  checkAuth,
  getResumes,
  saveApplication,
  uploadResume,
} from "./utils/api.js";
import {
  clearJobSession,
  getJobSession,
  isSameJob,
  saveJobSession,
  updateJobSession,
} from "./utils/job-session.js";

const SESSION_KEY_PREFIX = "job_session_";
const API_BASE_URL = runtimeConfig.apiBaseUrl;
const ALLOWED_API_METHODS = new Set(["GET", "POST"]);
const ALLOWED_API_PATH_PREFIXES = [
  "/api/parse-llm",
  "/api/applications",
  "/api/resumes",
  "/api/auth/me",
  "/api/resumes/upload",
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidTabId(value) {
  return Number.isInteger(value) && value > 0;
}

function isValidApiPath(path) {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    !path.includes("://") &&
    ALLOWED_API_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`))
  );
}

function normalizeApiMethod(value) {
  const method = typeof value === "string" ? value.toUpperCase() : "GET";
  return ALLOWED_API_METHODS.has(method) ? method : null;
}

function normalizeAuthLog(result) {
  return {
    authenticated: Boolean(result?.authenticated),
    reason: result?.reason ?? null,
  };
}

function validateResumePayload(resume) {
  if (resume == null) {
    return true;
  }

  return (
    isPlainObject(resume) &&
    typeof resume.filename === "string" &&
    typeof resume.mimetype === "string" &&
    typeof resume.size === "number" &&
    typeof resume.base64 === "string"
  );
}

// Stores the per-day popup counter after a successful save.
async function incrementDailyCount() {
  try {
    const date = new Date().toDateString();
    const result = await chrome.storage.local.get("daily_count");
    const stored = result?.daily_count ?? {};
    const count = stored?.date === date ? Number(stored?.count || 0) + 1 : 1;

    await chrome.storage.local.set({
      daily_count: {
        date,
        count,
      },
    });
  } catch {
    // Storage errors should never break the extension flow.
  }
}

function detectPortal(url) {
  const normalizedUrl = typeof url === "string" ? url : "";
  let hostname = "";

  try {
    hostname = new URL(normalizedUrl).hostname.toLowerCase();
  } catch {
    hostname = normalizedUrl.toLowerCase();
  }

  if (
    hostname.includes("greenhouse.io") ||
    hostname.includes("job-boards.greenhouse") ||
    hostname.includes("boards.greenhouse")
  ) {
    return "greenhouse";
  }

  if (hostname.includes("myworkdayjobs.com")) {
    return "workday";
  }

  if (hostname.includes("lever.co")) {
    return "lever";
  }

  return "unknown";
}

async function broadcastAuthMessage(type, payload = {}) {
  const tabs = await chrome.tabs.query({});

  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab?.id) {
        return;
      }

      try {
        await chrome.tabs.sendMessage(tab.id, { type, ...payload });
      } catch {
        // Ignore tabs without the content script.
      }
    }),
  );
}

async function cleanupStaleSessions() {
  try {
    const all = await chrome.storage.session.get(null);
    const sessionKeys = Object.keys(all).filter((key) => key.startsWith(SESSION_KEY_PREFIX));

    if (sessionKeys.length === 0) {
      return;
    }

    const tabs = await chrome.tabs.query({});
    const openTabIds = new Set(
      tabs.map((tab) => tab?.id).filter((tabId) => Number.isInteger(tabId) && tabId > 0),
    );

    const staleKeys = sessionKeys.filter((key) => {
      const tabId = Number.parseInt(key.replace(SESSION_KEY_PREFIX, ""), 10);
      return !openTabIds.has(tabId);
    });

    if (staleKeys.length > 0) {
      await chrome.storage.session.remove(staleKeys);
      console.log("[AppCommit Session] Cleaned up stale sessions:", staleKeys);
    }
  } catch (err) {
    console.log("[AppCommit Session] Cleanup error:", err);
  }
}

// Returns the current active tab id for popup-driven requests.
async function getActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  return tabs?.[0] ?? null;
}

// Forwards a parsing request to the content script on the active tab.
async function getJobDataFromActiveTab() {
  try {
    const tab = await getActiveTab();
    const tabId = tab?.id ?? null;

    if (!tabId) {
      return null;
    }

    console.log("[AppCommit] Checking tab URL:", tab?.url);
    console.log("[AppCommit] Detected portal:", detectPortal(tab?.url));

    return await chrome.tabs.sendMessage(tabId, { type: "PARSE_CURRENT_PAGE" });
  } catch {
    return null;
  }
}

// Persists an application and optional resume upload through the backend API.
async function handleSaveApplication(data) {
  const payload = data && typeof data === "object" ? data : {};
  let resumeId = null;
  let resumeFilename = null;

  if (payload.resume) {
    const uploadedResume = await uploadResume(payload.resume);

    if (uploadedResume?.success && uploadedResume.data?.id) {
      resumeId = uploadedResume.data.id;
      resumeFilename = uploadedResume.data.filename || payload.resume.filename || null;
    } else if (uploadedResume && !uploadedResume.success) {
      return {
        success: false,
        error: uploadedResume.error || "Resume upload failed",
        status: uploadedResume.status ?? null,
        stage: "resume_upload",
        reason: uploadedResume.reason ?? null,
      };
    }
  }

  const application = await saveApplication({
    company: payload.company ?? null,
    job_title: payload.job_title ?? null,
    job_description: payload.job_description ?? null,
    portal: payload.portal ?? null,
    url: payload.url ?? null,
    resume_id: resumeId,
    resume_filename: resumeFilename,
  });

  if (!application?.success) {
    return {
      success: false,
      error: application?.error || "Could not connect to AppCommit",
      status: application?.status ?? null,
      stage: "application_save",
      reason: application?.reason ?? null,
    };
  }

  await incrementDailyCount();
  return { success: true, application: application.data };
}

async function handleApiFetch(data) {
  const path = typeof data?.path === "string" ? data.path : "";
  const method = normalizeApiMethod(data?.method);
  const body = data?.body ?? null;

  if (!isValidApiPath(path)) {
    return {
      ok: false,
      status: 0,
      error: "Path not allowed",
      data: null,
    };
  }

  if (!method) {
    return {
      ok: false,
      status: 0,
      error: "Method not allowed",
      data: null,
    };
  }

  if (body !== null && typeof body !== "string") {
    return {
      ok: false,
      status: 0,
      error: "Invalid request body",
      data: null,
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      ...(body ? { body } : {}),
    });

    let responseData = null;
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      data: responseData,
    };
  } catch (err) {
    console.log("[AppCommit API] Background fetch error:", err?.message ?? err);
    return {
      ok: false,
      status: 0,
      error: err?.message ?? "Background fetch failed",
      data: null,
    };
  }
}

// Handles all popup and content-script messages in one async entrypoint.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      const type = message?.type;

      if (type === "SAVE_APPLICATION") {
        if (!isPlainObject(message?.data) || !validateResumePayload(message.data.resume)) {
          sendResponse({ success: false, error: "Invalid save payload" });
          return;
        }
        sendResponse(await handleSaveApplication(message?.data));
        return;
      }

      if (type === "GET_RESUMES") {
        sendResponse({ resumes: await getResumes() });
        return;
      }

      if (type === "CHECK_AUTH") {
        const result = await checkAuth();
        console.log("[AppCommit Auth] CHECK_AUTH result:", normalizeAuthLog(result));
        sendResponse(result);
        return;
      }

      if (type === "GET_JOB_DATA") {
        sendResponse(await getJobDataFromActiveTab());
        return;
      }

      if (type === "GET_RUNTIME_CONFIG") {
        sendResponse({
          dashboardUrl: runtimeConfig.dashboardUrl,
          dashboardAppUrl: runtimeConfig.dashboardAppUrl,
        });
        return;
      }

      if (type === "API_FETCH") {
        if (!isPlainObject(message?.data)) {
          sendResponse({ ok: false, status: 0, error: "Invalid request payload", data: null });
          return;
        }
        sendResponse(await handleApiFetch(message?.data));
        return;
      }

      if (type === "GET_TAB_ID") {
        sendResponse({ tabId: sender?.tab?.id ?? null });
        return;
      }

      if (type === "SAVE_JOB_SESSION") {
        if (!isValidTabId(message?.data?.tabId) || !isPlainObject(message?.data?.jobData)) {
          sendResponse({ success: false, error: "Invalid session payload" });
          return;
        }
        await saveJobSession(message?.data.tabId, message.data.jobData);
        sendResponse({ success: true });
        return;
      }

      if (type === "GET_JOB_SESSION") {
        if (!isValidTabId(message?.data?.tabId)) {
          sendResponse({ session: null, error: "Invalid tabId" });
          return;
        }
        const session = await getJobSession(message.data.tabId);
        const currentUrl = typeof message?.data?.currentUrl === "string" ? message.data.currentUrl : null;

        if (session && currentUrl && !isSameJob(session.sourceUrl, currentUrl)) {
          sendResponse({ session: null });
          return;
        }

        sendResponse({ session: session ?? null });
        return;
      }

      if (type === "UPDATE_JOB_SESSION") {
        if (!isValidTabId(message?.data?.tabId) || !isPlainObject(message?.data?.updates)) {
          sendResponse({ success: false, error: "Invalid session update" });
          return;
        }
        await updateJobSession(message.data.tabId, message.data.updates);
        sendResponse({ success: true });
        return;
      }

      if (type === "CLEAR_JOB_SESSION") {
        if (!isValidTabId(message?.data?.tabId)) {
          sendResponse({ success: false, error: "Invalid tabId" });
          return;
        }
        await clearJobSession(message.data.tabId);
        sendResponse({ success: true });
        return;
      }

      sendResponse({ success: false, error: "Unknown message type" });
    } catch (error) {
      console.log("[AppCommit Auth] Background handler failed:", error);
      sendResponse({ success: false, error: "Could not connect to AppCommit" });
    }
  })();

  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    await cleanupStaleSessions();
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    await cleanupStaleSessions();
  })();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    await clearJobSession(tabId);
    console.log("[AppCommit Session] Cleaned up closed tab:", tabId);
  })();
});
