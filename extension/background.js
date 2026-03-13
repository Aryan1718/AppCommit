import {
  checkAuth,
  clearToken,
  getResumes,
  saveApplication,
  saveToken,
  uploadResume,
} from "./utils/api.js";
import {
  clearJobSession,
  getJobSession,
  isSameJob,
  saveJobSession,
  updateJobSession,
} from "./utils/job-session.js";

const TOKEN_EXPIRY_ALARM = "appcommit-token-expiry-check";
const SESSION_KEY_PREFIX = "job_session_";

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

  if (
    normalizedUrl.includes("greenhouse.io") ||
    normalizedUrl.includes("job-boards.greenhouse") ||
    normalizedUrl.includes("boards.greenhouse")
  ) {
    return "greenhouse";
  }

  if (normalizedUrl.includes("myworkdayjobs.com")) {
    return "workday";
  }

  if (normalizedUrl.includes("lever.co")) {
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

async function checkForExpiringToken() {
  const result = await chrome.storage.local.get("tokenExpiresAt");
  const expiresAt = result?.tokenExpiresAt ?? null;

  if (typeof expiresAt !== "number") {
    return;
  }

  const timeUntilExpiry = expiresAt - Date.now();
  const twoMinutes = 2 * 60 * 1000;

  if (timeUntilExpiry > 0 && timeUntilExpiry < twoMinutes) {
    console.log("[AppCommit Auth] Token expiring in less than 2 minutes");
    await broadcastAuthMessage("TOKEN_EXPIRING_SOON");
  }
}

function ensureTokenExpiryAlarm() {
  chrome.alarms.create(TOKEN_EXPIRY_ALARM, { periodInMinutes: 5 });
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
  const method = data?.method ?? "GET";
  const body = data?.body ?? null;

  try {
    const { token } = await chrome.storage.local.get("token");

    const response = await fetch(`${"http://localhost:8000"}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body } : {}),
    });

    let responseData = null;
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }

    if (response.status === 401) {
      await chrome.storage.local.remove("token");
      await broadcastAuthMessage("AUTH_EXPIRED", { reason: "token_expired" });
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
        sendResponse(await handleSaveApplication(message?.data));
        return;
      }

      if (type === "GET_RESUMES") {
        sendResponse({ resumes: await getResumes() });
        return;
      }

      if (type === "CHECK_AUTH") {
        const result = await checkAuth();
        const normalized =
          result?.reason === "not_authenticated"
            ? { authenticated: false, reason: "no_token" }
            : result;

        console.log("[AppCommit Auth] CHECK_AUTH result:", normalized);
        sendResponse(normalized);
        return;
      }

      if (type === "GET_JOB_DATA") {
        sendResponse(await getJobDataFromActiveTab());
        return;
      }

      if (type === "API_FETCH") {
        sendResponse(await handleApiFetch(message?.data));
        return;
      }

      if (type === "GET_TAB_ID") {
        sendResponse({ tabId: sender?.tab?.id ?? null });
        return;
      }

      if (type === "SAVE_JOB_SESSION") {
        await saveJobSession(message?.data?.tabId ?? null, message?.data?.jobData ?? null);
        sendResponse({ success: true });
        return;
      }

      if (type === "GET_JOB_SESSION") {
        const session = await getJobSession(message?.data?.tabId ?? null);
        const currentUrl = message?.data?.currentUrl ?? null;

        if (session && currentUrl && !isSameJob(session.sourceUrl, currentUrl)) {
          sendResponse({ session: null });
          return;
        }

        sendResponse({ session: session ?? null });
        return;
      }

      if (type === "UPDATE_JOB_SESSION") {
        await updateJobSession(message?.data?.tabId ?? null, message?.data?.updates ?? {});
        sendResponse({ success: true });
        return;
      }

      if (type === "CLEAR_JOB_SESSION") {
        await clearJobSession(message?.data?.tabId ?? null);
        sendResponse({ success: true });
        return;
      }

      if (type === "STORE_TOKEN") {
        await saveToken(message?.token ?? null, {
          tokenExpiresAt: message?.tokenExpiresAt ?? null,
          userEmail: message?.userEmail ?? null,
        });
        sendResponse({ success: true });
        return;
      }

      if (type === "CLEAR_TOKEN") {
        await clearToken();
        sendResponse({ success: true });
        return;
      }

      if (type === "AUTH_EXPIRED") {
        console.log("[AppCommit Auth] Token expired, notifying tabs");
        await broadcastAuthMessage("AUTH_EXPIRED", {
          reason: message?.reason ?? "token_expired",
        });
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== TOKEN_EXPIRY_ALARM) {
    return;
  }

  void checkForExpiringToken();
});

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    ensureTokenExpiryAlarm();
    await cleanupStaleSessions();
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    ensureTokenExpiryAlarm();
    await cleanupStaleSessions();
  })();
});

ensureTokenExpiryAlarm();

chrome.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    await clearJobSession(tabId);
    console.log("[AppCommit Session] Cleaned up closed tab:", tabId);
  })();
});
