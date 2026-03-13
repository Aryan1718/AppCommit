// Popup state management and backend bridge for the AppCommit extension.
const DASHBOARD_URL = "http://localhost:3000";
const DASHBOARD_APP_URL = "http://localhost:3000/dashboard";

const stateElements = {
  loading: document.getElementById("state-loading"),
  auth: document.getElementById("state-auth"),
  job: document.getElementById("state-job"),
  idle: document.getElementById("state-idle"),
  saved: document.getElementById("state-saved"),
};

const jobCompany = document.getElementById("job-company");
const jobTitle = document.getElementById("job-title");
const jobPortal = document.getElementById("job-portal");
const jobResume = document.getElementById("job-resume");
const jobError = document.getElementById("job-error");
const saveButton = document.getElementById("save-snapshot");
const savedCompany = document.getElementById("saved-company");
const savedJobTitle = document.getElementById("saved-job-title");
const dailyStats = document.getElementById("daily-stats");
const authMessage = document.getElementById("auth-message");

let currentJobData = null;

// Switches the popup to a single visible state pane.
function showState(name) {
  for (const element of Object.values(stateElements)) {
    element?.classList.remove("active");
  }

  stateElements[name]?.classList.add("active");
}

// Formats a portal string into the popup badge label.
function formatPortalLabel(portal) {
  if (portal === "greenhouse") {
    return "via Greenhouse";
  }

  if (portal === "workday") {
    return "via Workday";
  }

  if (portal === "lever") {
    return "via Lever";
  }

  return "via Unknown";
}

// Opens a dashboard URL in a new browser tab.
async function openDashboard(url) {
  try {
    await chrome.tabs.create({ url });
  } catch {
    // Ignore popup navigation errors.
  }
}

// Wraps runtime messaging so the popup can handle disconnected backends cleanly.
async function sendRuntimeMessage(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch {
    return null;
  }
}

// Reads the daily save counter that the background worker updates.
async function loadDailyCount() {
  try {
    const result = await chrome.storage.local.get("daily_count");
    const stored = result?.daily_count;
    const today = new Date().toDateString();
    const count = stored?.date === today ? Number(stored?.count || 0) : 0;

    dailyStats.textContent = `Today: ${count} snapshots saved`;
  } catch {
    dailyStats.textContent = "Today: 0 snapshots saved";
  }
}

// Checks whether the extension already has a stored auth token.
async function hasStoredToken() {
  try {
    const result = await chrome.storage.local.get("token");
    return Boolean(result?.token);
  } catch {
    return false;
  }
}

// Populates the job state with parsed page data and resume status.
function renderJobState(jobData) {
  currentJobData = jobData;
  jobCompany.textContent = jobData?.company || "Unknown Company";
  jobTitle.textContent = jobData?.job_title || "Unknown role";
  jobPortal.textContent = formatPortalLabel(jobData?.portal || "unknown");
  jobError.textContent = "";

  if (jobData?.resume?.filename) {
    jobResume.textContent = `📄 ${jobData.resume.filename} · Resume detected ✓`;
    jobResume.className = "resume-status resume-detected";
  } else {
    jobResume.textContent = "⚠ No resume detected";
    jobResume.className = "resume-status resume-missing";
  }

  showState("job");
}

// Shows the saved confirmation panel using the last-known job details.
function renderSavedState(jobData) {
  savedCompany.textContent = jobData?.company || "Unknown Company";
  savedJobTitle.textContent = jobData?.job_title || "Unknown role";
  showState("saved");
}

// Initializes the popup based on auth state and current-tab parsing.
async function initializePopup() {
  showState("loading");

  const authResponse = await sendRuntimeMessage({ type: "CHECK_AUTH" });

  if (!authResponse?.authenticated) {
    authMessage.textContent = (await hasStoredToken())
      ? "Could not connect to AppCommit"
      : "Sign in to start tracking";
    showState("auth");
    return;
  }

  const jobData = await sendRuntimeMessage({ type: "GET_JOB_DATA" });

  if (jobData && (jobData.company || jobData.job_title)) {
    renderJobState(jobData);
    return;
  }

  await loadDailyCount();
  showState("idle");
}

// Saves the current parsed job snapshot through the background worker.
async function handleSaveSnapshot() {
  if (!currentJobData) {
    jobError.textContent = "Could not detect job details";
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";
  jobError.textContent = "";

  const response = await sendRuntimeMessage({
    type: "SAVE_APPLICATION",
    data: currentJobData,
  });

  if (response?.success) {
    renderSavedState({
      company: response.application?.company || currentJobData.company,
      job_title: response.application?.job_title || currentJobData.job_title,
    });
    return;
  }

  jobError.textContent = response?.error || "Could not connect to AppCommit";
  window.setTimeout(() => {
    saveButton.disabled = false;
    saveButton.textContent = "Save Snapshot";
  }, 2000);
}

document.getElementById("open-dashboard-auth")?.addEventListener("click", () => {
  void openDashboard(DASHBOARD_URL);
});

document.getElementById("open-dashboard-idle")?.addEventListener("click", () => {
  void openDashboard(DASHBOARD_URL);
});

document.getElementById("view-dashboard")?.addEventListener("click", () => {
  void openDashboard(DASHBOARD_APP_URL);
});

saveButton?.addEventListener("click", () => {
  void handleSaveSnapshot();
});

void initializePopup();
