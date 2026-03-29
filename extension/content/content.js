const DASHBOARD_URL = "http://localhost:3000";
const DASHBOARD_APP_URL = "http://localhost:3000/dashboard";
const AUTO_SAVE_STORAGE_KEY = "appcommit_autosave_enabled";
const LLM_TIMEOUT_MS = 10000;
const SPA_WATCH_TIMEOUT_MS = 5 * 60 * 1000;
const PORTAL_SELECTORS = {
  workday:
    '[data-automation-id="bottom-navigation-next-button"], [data-automation-id="pageFooter-button-submit"]',
  lever: 'button[type="submit"], input[type="submit"]',
};

function isContextValid() {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

let urlObserver = null;
let formObserver = null;

let supportModulesPromise = null;
let sidebarResourcesPromise = null;
let sidebarInstancePromise = null;
let autoSaveEnabled = true;
let currentJobData = null;
let activePortal = "unknown";
let knownPortalListenerBound = false;
let genericPortalClickHandler = null;
let unknownSubmitBound = false;
let greenhouseObserver = null;
let manualSaveListenerBound = false;
let detectNowListenerBound = false;
let authRecheckListenerBound = false;
let authStorageListenerBound = false;
let spaWatcherBound = false;
let spaWatcherObserver = null;
let spaWatcherTimeoutId = null;
let lastKnownUrl = window.location.href;
let isDetecting = false;
let popstateHandler = null;
let currentResume = null;
let currentResumeSource = null;
let resumeInputObserver = null;
let boundResumeInput = null;
let boundResumeSelector = null;
let resumeUploadHandlerBound = false;
let manualResumeUploadHandlerBound = false;
let CURRENT_TAB_ID = null;
let collapsedTabListenerBound = false;
let dismissedThisSession = false;
let dismissedHostname = null;

function getHostname(url = window.location.href) {
  try {
    return new URL(url).hostname;
  } catch {
    return window.location.hostname;
  }
}

async function getSidebarForUrlChange(existingSidebar, currentUrl) {
  const currentHostname = getHostname(currentUrl);

  if (dismissedThisSession && dismissedHostname && dismissedHostname !== currentHostname) {
    dismissedThisSession = false;
    dismissedHostname = null;
  }

  if (dismissedThisSession) {
    console.log("[AppCommit] Dismissed — skipping re-detection");
    return null;
  }

  if (!document.getElementById("appcommit-sidebar") || !document.getElementById("appcommit-tab")) {
    return ensureSidebar();
  }

  return existingSidebar;
}

function setSidebarSuppressed(isSuppressed) {
  const sidebar = document.getElementById("appcommit-sidebar");
  const tab = document.getElementById("appcommit-tab");

  if (sidebar instanceof HTMLElement) {
    sidebar.style.display = isSuppressed ? "none" : "";
  }

  if (tab instanceof HTMLElement) {
    tab.style.display = isSuppressed ? "none" : "";
  }
}

function isStateVisible(id) {
  const state = document.getElementById(id);
  return state instanceof HTMLElement && !state.classList.contains("hidden");
}

async function handleTokenStorageChange(oldToken, newToken) {
  if (!isContextValid() || dismissedThisSession) {
    return;
  }

  const hadToken = typeof oldToken === "string" && oldToken.length > 0;
  const hasToken = typeof newToken === "string" && newToken.length > 0;
  const sidebarShowingAuth = isStateVisible("ac-state-auth");

  if (!hasToken) {
    if (sidebarShowingAuth || hadToken) {
      const sidebar = await ensureSidebar();
      sidebar.showAuth("no_token");
    }
    return;
  }

  if (!sidebarShowingAuth && hadToken) {
    return;
  }

  if (isDetecting) {
    return;
  }

  isDetecting = true;

  try {
    const sidebar = await ensureSidebar();
    sidebar.showState("ac-state-detecting");
    sidebar.setDetectingMessage("Sign-in detected. Loading your session...");

    const authResponse = await checkAuthStatus();
    if (!authResponse?.authenticated) {
      sidebar.showAuth(authResponse?.reason ?? "no_token");
      return;
    }

    await runDetection(sidebar);
  } finally {
    isDetecting = false;
  }
}

function bindAuthStorageListener() {
  if (authStorageListenerBound || !isContextValid()) {
    return;
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.token) {
      return;
    }

    console.log("[AppCommit Auth] Token storage changed");
    void handleTokenStorageChange(changes.token.oldValue, changes.token.newValue);
  });

  authStorageListenerBound = true;
}

function stopAllObservers() {
  urlObserver?.disconnect();
  formObserver?.disconnect();
  greenhouseObserver?.disconnect();
  urlObserver = null;
  formObserver = null;
  greenhouseObserver = null;
  stopResumeObserver();
  stopSpaWatcher();
  console.log("[AppCommit] Observers stopped — context invalidated");
}

async function safeChromeCall(fn, fallback = null) {
  if (!isContextValid()) {
    console.log("[AppCommit] Extension context invalid, skipping chrome call");
    return fallback;
  }

  try {
    return await fn();
  } catch (err) {
    if (
      err?.message?.includes("Extension context invalidated") ||
      err?.message?.includes("Cannot access a chrome")
    ) {
      console.log("[AppCommit] Context invalidated during call");
      stopAllObservers();
      return fallback;
    }
    throw err;
  }
}

async function safeMessage(message, fallback = null) {
  return safeChromeCall(() => chrome.runtime.sendMessage(message), fallback);
}

function safeRuntimeUrl(path) {
  if (!isContextValid()) {
    console.log("[AppCommit] Extension context invalid, skipping runtime URL");
    return "";
  }

  try {
    return chrome.runtime.getURL(path);
  } catch (err) {
    if (err?.message?.includes("Extension context invalidated")) {
      console.log("[AppCommit] Context invalidated while building runtime URL");
      stopAllObservers();
      return "";
    }
    throw err;
  }
}

async function initTabId() {
  try {
    const response = await safeMessage({
      type: "GET_TAB_ID",
    });
    CURRENT_TAB_ID = response?.tabId ?? null;
    console.log("[AppCommit] Tab ID:", CURRENT_TAB_ID);
  } catch (err) {
    console.log("[AppCommit] Could not get tab ID:", err);
    CURRENT_TAB_ID = null;
  }
}

async function getTabId() {
  return CURRENT_TAB_ID;
}

async function saveSession(tabId, jobData) {
  await safeMessage({
    type: "SAVE_JOB_SESSION",
    data: { tabId, jobData },
  });
}

async function getSession(tabId) {
  const response = await safeMessage({
    type: "GET_JOB_SESSION",
    data: { tabId },
  });
  return response?.session ?? null;
}

async function updateSession(tabId, updates) {
  await safeMessage({
    type: "UPDATE_JOB_SESSION",
    data: { tabId, updates },
  });
}

async function clearSession(tabId) {
  await safeMessage({
    type: "CLEAR_JOB_SESSION",
    data: { tabId },
  });
}

function isApplyUrl(url) {
  const patterns = [
    /\/apply\//i,
    /\/application/i,
    /\/jobs\/.*\/apply/i,
    /greenhouse\.io\/.*\/jobs\//i,
    /jobs\.lever\.co\//i,
    /myworkdayjobs\.com\//i,
  ];

  return patterns.some((pattern) => pattern.test(url));
}

function isSameJobUrl(urlA, urlB) {
  if (!urlA || !urlB) {
    return false;
  }

  try {
    return new URL(urlA).hostname === new URL(urlB).hostname;
  } catch {
    return false;
  }
}

async function getSupportModules() {
  if (!supportModulesPromise) {
    supportModulesPromise = Promise.all([
      import("../utils/detect-portal.js"),
      import("../utils/resume-capture.js"),
      import("./parsers/llm.js"),
      import("./parsers/greenhouse.js"),
      import("./parsers/workday.js"),
      import("./parsers/lever.js"),
      import("../utils/candidate-extractor.js"),
    ]).then(
      ([
        portalModule,
        resumeModule,
        llmModule,
        greenhouseModule,
        workdayModule,
        leverModule,
        extractorModule,
      ]) => ({
        detectPortal: portalModule.detectPortal,
        isApplicationForm: portalModule.isApplicationForm,
        readFileAsResume: resumeModule.readFileAsResume,
        watchResumeInput: resumeModule.watchResumeInput,
        fillMissingFields: llmModule.fillMissingFields,
        parsers: {
          greenhouse: greenhouseModule.parse,
          workday: workdayModule.parse,
          lever: leverModule.parse,
        },
        cleanJobData: extractorModule.cleanJobData,
        getSubmitButton: greenhouseModule.getSubmitButton,
        extractResumeInputSelector: extractorModule.extractResumeInputSelector,
      }),
    );
  }

  return supportModulesPromise;
}

async function getSidebarResources() {
  if (!sidebarResourcesPromise) {
    const sidebarHtmlUrl = safeRuntimeUrl("sidebar/sidebar.html");
    const sidebarCssUrl = safeRuntimeUrl("sidebar/sidebar.css");

    if (!sidebarHtmlUrl || !sidebarCssUrl) {
      throw new Error("Extension context invalidated");
    }

    sidebarResourcesPromise = Promise.all([
      import("../sidebar/sidebar.js"),
      fetch(sidebarHtmlUrl).then((response) => response.text()),
    ]).then(([sidebarModule, html]) => ({
      initSidebar: sidebarModule.initSidebar,
      html,
      cssHref: sidebarCssUrl,
    }));
  }

  return sidebarResourcesPromise;
}

function normalizeJobData(data = {}) {
  return {
    company: typeof data.company === "string" ? data.company.trim() || null : null,
    job_title: typeof data.job_title === "string" ? data.job_title.trim() || null : null,
    job_description:
      typeof data.job_description === "string" ? data.job_description.trim() || null : null,
    portal: typeof data.portal === "string" ? data.portal.trim() || "unknown" : "unknown",
    url: typeof data.url === "string" ? data.url.trim() || window.location.href : window.location.href,
    is_embed: Boolean(data.is_embed),
    resume_input_selector:
      typeof data.resume_input_selector === "string" ? data.resume_input_selector.trim() || null : null,
  };
}

async function sanitizeJobData(data = {}) {
  const normalized = normalizeJobData(data);

  try {
    const { cleanJobData } = await getSupportModules();
    const cleaned = typeof cleanJobData === "function" ? cleanJobData(normalized) : normalized;
    return normalizeJobData(cleaned);
  } catch (error) {
    console.log("[AppCommit] Failed to clean job data:", error);
    return normalized;
  }
}

function hasJobData(data) {
  return Boolean(data?.company || data?.job_title);
}

function hasRequiredJobData(data) {
  return Boolean(data?.company && data?.job_title && data?.job_description);
}

function looksLikeJobPage(portal) {
  const title = document.title.toLowerCase();

  return Boolean(
    portal === "jobright" ||
    portal !== "unknown" ||
      window.location.href.includes("job") ||
      window.location.href.includes("career") ||
      window.location.href.includes("apply") ||
      window.location.href.includes("hiring") ||
      title.includes("job") ||
      title.includes("career"),
  );
}

function shouldSuppressPage(portal) {
  return portal === "jobright" || window.location.hostname.includes("jobright");
}

function shouldAutoRunPortal(portal) {
  return portal === "greenhouse" || portal === "workday" || portal === "lever";
}

async function loadParser(portal) {
  try {
    const { parsers } = await getSupportModules();
    return typeof parsers?.[portal] === "function" ? { parse: parsers[portal] } : null;
  } catch (error) {
    console.log("[AppCommit] Failed to load parser:", portal, error);
    return null;
  }
}

async function checkAuthStatus() {
  try {
    const response = await safeMessage({ type: "CHECK_AUTH" });
    console.log("[AppCommit] Auth check result:", {
      authenticated: Boolean(response?.authenticated),
      reason: response?.reason ?? null,
    });
    return response ?? { authenticated: false, reason: "no_token" };
  } catch (error) {
    console.log("[AppCommit] Auth check failed:", error);
    return { authenticated: false, reason: "network_error" };
  }
}

async function getAutoSavePreference() {
  try {
    const result = await safeChromeCall(
      () => chrome.storage.local.get(AUTO_SAVE_STORAGE_KEY),
      {},
    );
    return result?.[AUTO_SAVE_STORAGE_KEY] !== false;
  } catch {
    return true;
  }
}

async function setAutoSavePreference(enabled) {
  autoSaveEnabled = Boolean(enabled);

  try {
    await safeChromeCall(() => chrome.storage.local.set({ [AUTO_SAVE_STORAGE_KEY]: autoSaveEnabled }));
  } catch {
    // Preference persistence should fail silently.
  }
}

function openDashboard(url) {
  if (!url) {
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

async function ensureSidebar() {
  if (!sidebarInstancePromise) {
    sidebarInstancePromise = (async () => {
      const autoSave = await getAutoSavePreference();
      autoSaveEnabled = autoSave;

      const { initSidebar, html, cssHref } = await getSidebarResources();
      const sidebar = initSidebar({
        html,
        cssHref,
        dashboardUrl: DASHBOARD_URL,
        dashboardAppUrl: DASHBOARD_APP_URL,
        initialAutoSaveEnabled: autoSave,
        onOpenDashboard: openDashboard,
        onRetry: () => {
          void runDetection(sidebar);
        },
        onAutoSaveChange: (enabled) => {
          void setAutoSavePreference(enabled);
        },
      });

      sidebar.onSave(async () => {
        await saveCurrentSnapshot();
      });

      sidebar.onRedetect(async () => {
        console.log("[AppCommit] Re-detect triggered by user");

        if (CURRENT_TAB_ID) {
          await clearSession(CURRENT_TAB_ID);
          console.log("[AppCommit] Session cleared for re-detect");
        }

        currentResume = null;
        currentResumeSource = null;
        sidebar.setRedetecting(true);

        try {
          await runDetection(sidebar);
        } finally {
          sidebar.setRedetecting(false);
        }
      });

      sidebar.onCollapse(() => {
        sidebar.close();
      });

      sidebar.onDismiss(() => {
        sidebar.dismiss();
        dismissedThisSession = true;
        dismissedHostname = getHostname();
        sidebarInstancePromise = null;
        collapsedTabListenerBound = false;
        console.log("[AppCommit] Dismissed for this page session");
      });

      if (!manualSaveListenerBound) {
        document.addEventListener("appcommit-manual-save", async (event) => {
          const manualData = await sanitizeJobData(event?.detail);
          console.log("[AppCommit] Manual save triggered:", manualData);
          await handleSave(sidebar, manualData);
        });
        manualSaveListenerBound = true;
      }

      if (!manualResumeUploadHandlerBound) {
        sidebar.onManualResumeUpload(async (file) => {
          const { readFileAsResume } = await getSupportModules();
          const result = await readFileAsResume(file);

          if (result.error) {
            sidebar.showManualResumeError(result.error);
            return;
          }

          currentResume = result;
          currentResumeSource = "manual";
          sidebar.showManualResumeUploaded(result.filename);
          console.log("[AppCommit Resume] Uploaded via manual form:", result.filename);
        });
        manualResumeUploadHandlerBound = true;
      }

      if (!detectNowListenerBound) {
        document.addEventListener("appcommit-detect-now", async () => {
          console.log("[AppCommit] Detect Now triggered");
          await runDetection(sidebar);
        });
        detectNowListenerBound = true;
      }

      if (!authRecheckListenerBound) {
        document.addEventListener("appcommit-recheck-auth", async () => {
          console.log("[AppCommit] Re-checking auth...");
          sidebar.showState("ac-state-detecting");
          sidebar.setDetectingMessage("Checking login status...");

          const authResponse = await checkAuthStatus();

          if (!authResponse?.authenticated) {
            sidebar.showAuth(authResponse?.reason ?? "no_token");
            return;
          }

          console.log("[AppCommit] Authenticated! Running detection...");
          await runDetection(sidebar);
        });
        authRecheckListenerBound = true;
      }

      return sidebar;
    })();
  }

  return sidebarInstancePromise;
}

async function initCollapsedTab() {
  const sidebar = await ensureSidebar();
  sidebar.close();

  if (collapsedTabListenerBound) {
    return sidebar;
  }

  const tab = document.getElementById("appcommit-tab");
  if (!(tab instanceof HTMLElement)) {
    return sidebar;
  }

  tab.addEventListener("click", () => {
    void (async () => {
      const currentSidebar = await ensureSidebar();
      currentSidebar.open();

      if (isDetecting) {
        return;
      }

      const authResponse = await checkAuthStatus();
      if (!authResponse?.authenticated) {
        currentSidebar.showAuth(authResponse?.reason ?? "no_token");
        return;
      }

      isDetecting = true;
      try {
        await runDetection(currentSidebar);
      } finally {
        isDetecting = false;
      }
    })();
  });

  collapsedTabListenerBound = true;
  return sidebar;
}

async function openSidebarForForm(sidebar) {
  const authResponse = await checkAuthStatus();
  console.log("[AppCommit] Auth status:", {
    authenticated: Boolean(authResponse?.authenticated),
    reason: authResponse?.reason ?? null,
  });

  sidebar.show();

  if (!authResponse?.authenticated) {
    console.log("[AppCommit] User not authenticated");
    sidebar.showAuth(authResponse?.reason ?? "no_token");
    return false;
  }

  await runDetection(sidebar);
  return true;
}

function setSaveButtonState(isSaving) {
  const buttons = [
    document.getElementById("ac-save-btn"),
    document.getElementById("ac-manual-save-btn"),
  ];

  for (const button of buttons) {
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }

    if (button.id === "ac-manual-save-btn") {
      button.disabled = isSaving;
      button.textContent = isSaving ? "Saving..." : "Save Snapshot";
      continue;
    }

    button.disabled = isSaving;
    button.textContent = isSaving ? "Saving..." : "Save Snapshot Now";
  }
}

async function handleSave(sidebar, jobData) {
  const normalizedData = await sanitizeJobData(jobData);
  currentJobData = normalizedData;

  console.log("[AppCommit Save] Resume:", currentResume?.filename ?? "none");

  const saveBtn = document.getElementById("ac-save-btn");
  if (saveBtn instanceof HTMLButtonElement) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  try {
    const response = await safeMessage({
      type: "SAVE_APPLICATION",
      data: { ...normalizedData, resume: currentResume },
    });

    if (response?.success) {
      const tabId = await getTabId();
      if (tabId !== null) {
        await clearSession(tabId);
      }
      sidebar.showSaved({
        company: normalizedData.company,
        job_title: normalizedData.job_title,
        resume_filename: currentResume?.filename ?? null,
      });
      return true;
    }

    if (response?.reason === "token_expired" || response?.reason === "not_authenticated") {
      sidebar.showAuth(response.reason);
      return false;
    }

    if (response?.reason === "network_error") {
      sidebar.showAuth("network_error");
      return false;
    }

    sidebar.showError();
    if (saveBtn instanceof HTMLButtonElement) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Snapshot Now";
    }
    return false;
  } catch (error) {
    console.log("[AppCommit Save] Error:", error);
    sidebar.showError();
    if (saveBtn instanceof HTMLButtonElement) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Snapshot Now";
    }
    return false;
  }
}

async function fetchDescription(jobData) {
  try {
    const { fillMissingFields } = await import("./parsers/llm.js");

    const result = await Promise.race([
      fillMissingFields(jobData),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("Timeout")), 20000);
      }),
    ]);

    return result?.job_description ?? null;
  } catch (err) {
    console.log("[AppCommit] Description fetch failed:", err?.message ?? err);
    return null;
  }
}

function stopResumeObserver() {
  resumeInputObserver?.disconnect();
  resumeInputObserver = null;
  boundResumeInput = null;
  boundResumeSelector = null;
  formObserver = null;
}

function getResumeFileSignature(file) {
  if (!(file instanceof File)) {
    return null;
  }

  return [file.name, file.size, file.type].join("::");
}

function getCurrentResumeSignature() {
  if (!currentResume) {
    return null;
  }

  return [currentResume.filename, currentResume.size, currentResume.mimetype].join("::");
}

function showExistingResumeState(sidebar) {
  if (!currentResume?.filename) {
    return false;
  }

  if (currentResumeSource === "sidebar" || currentResumeSource === "manual") {
    sidebar.showResumeUploaded(currentResume.filename);
    return true;
  }

  sidebar.showResumeCaptured(currentResume.filename);
  return true;
}

async function bindResumeInput(sidebar, input, readFileAsResume, selector) {
  if (!(input instanceof HTMLInputElement) || input.type !== "file") {
    return false;
  }

  const existingFileSignature = getResumeFileSignature(input.files?.[0] ?? null);
  const currentResumeSignature = getCurrentResumeSignature();
  const preserveCapturedState = currentResumeSource === "form" && Boolean(currentResumeSignature);
  const alreadyCapturedSameResume =
    preserveCapturedState &&
    Boolean(existingFileSignature) &&
    existingFileSignature === currentResumeSignature;

  if (!preserveCapturedState) {
    sidebar.showResumeFound();
  }

  input._appcommitResumeChangeHandler = async () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    console.log("[AppCommit Resume] File attached:", file.name);

    const result = await readFileAsResume(file);
    if (result.error) {
      sidebar.showResumeError(result.error);
      return;
    }

    currentResume = {
      ...result,
      source: "form",
    };
    currentResumeSource = "form";
    sidebar.showResumeCaptured(file.name);
  };

  if (input.dataset.appcommitResumeDirectBound !== "true") {
    input.dataset.appcommitResumeDirectBound = "true";
    input.addEventListener("change", () => {
      void input._appcommitResumeChangeHandler?.();
    });
  }

  boundResumeInput = input;
  boundResumeSelector = selector ?? null;

  if (input.files?.[0] && !alreadyCapturedSameResume) {
    await input._appcommitResumeChangeHandler();
  }

  if (!preserveCapturedState) {
    console.log("[AppCommit Resume] Watching form input directly");
  } else {
    console.log("[AppCommit Resume] Rebound resume input without resetting captured state");
  }
  return true;
}

async function handleResumeDetection(sidebar, resumeInputSelector) {
  const { readFileAsResume, extractResumeInputSelector } = await getSupportModules();
  let detectionScheduled = false;

  stopResumeObserver();

  const resolveResumeSelector = () => {
    const preferredSelector =
      currentJobData?.resume_input_selector ?? resumeInputSelector ?? null;

    if (preferredSelector) {
      try {
        const preferredInput = document.querySelector(preferredSelector);
        if (preferredInput instanceof HTMLInputElement && preferredInput.type === "file") {
          return preferredSelector;
        }
      } catch {
        // Ignore invalid selectors and fall back to fresh extraction.
      }
    }

    const detectedSelector =
      typeof extractResumeInputSelector === "function" ? extractResumeInputSelector() : null;

    if (detectedSelector && currentJobData) {
      currentJobData.resume_input_selector = detectedSelector;
    }

    return detectedSelector;
  };

  const tryBindResumeInput = async () => {
    if (boundResumeInput && document.contains(boundResumeInput)) {
      return true;
    }

    const selector = resolveResumeSelector();
    console.log("[AppCommit Resume] Selector:", selector);

    if (!selector) {
      boundResumeInput = null;
      boundResumeSelector = null;
      return false;
    }

    try {
      const input = document.querySelector(selector);
      boundResumeInput = null;
      return bindResumeInput(sidebar, input, readFileAsResume, selector);
    } catch {
      boundResumeInput = null;
      boundResumeSelector = null;
      return false;
    }
  };

  const hasBoundResumeInput = await tryBindResumeInput();

  if (!hasBoundResumeInput) {
    if (!showExistingResumeState(sidebar)) {
      sidebar.showResumeUpload();
    }
  }

  if (!resumeUploadHandlerBound) {
    sidebar.onResumeUpload(async (file) => {
      const result = await readFileAsResume(file);

      if (result.error) {
        sidebar.showResumeError(result.error);
        return;
      }

      currentResume = { ...result, source: "sidebar" };
      currentResumeSource = "sidebar";
      sidebar.showResumeUploaded(result.filename);
    });
    resumeUploadHandlerBound = true;
  }

  if (!(document.body instanceof Element)) {
    return;
  }

  resumeInputObserver = new MutationObserver(() => {
    if (detectionScheduled) {
      return;
    }

    detectionScheduled = true;
    window.setTimeout(() => {
      detectionScheduled = false;
      void (async () => {
        const found = await tryBindResumeInput();

        if (found) {
          return;
        }

        if (!showExistingResumeState(sidebar)) {
          sidebar.showResumeUpload();
        }
      })();
    }, 250);
  });

  formObserver = resumeInputObserver;
  resumeInputObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

async function saveCurrentSnapshot() {
  const sidebar = await ensureSidebar();
  sidebar.show();

  const authResponse = await checkAuthStatus();
  if (!authResponse?.authenticated) {
    sidebar.showAuth(authResponse?.reason ?? "no_token");
    return false;
  }

  const jobData = hasJobData(currentJobData) ? currentJobData : await runDetection(sidebar);

  if (!hasJobData(jobData)) {
    return false;
  }

  return handleSave(sidebar, jobData);
}

async function handleAutoSaveSubmit() {
  if (!autoSaveEnabled) {
    return;
  }

  console.log("[AppCommit] Auto-save triggered");
  void saveCurrentSnapshot();
}

function bindGenericPortalSubmitListener(portal) {
  if (knownPortalListenerBound) {
    return;
  }

  const selector = PORTAL_SELECTORS[portal];
  if (!selector) {
    return;
  }

  genericPortalClickHandler = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest(selector)) {
      return;
    }

    void handleAutoSaveSubmit();
  };

  document.addEventListener("click", genericPortalClickHandler, true);
  knownPortalListenerBound = true;
}

async function bindGreenhouseSubmitListener() {
  if (knownPortalListenerBound) {
    return;
  }

  const { getSubmitButton } = await getSupportModules();

  if (typeof getSubmitButton !== "function") {
    return;
  }

  const bindButton = (button) => {
    if (!(button instanceof Element) || button.dataset.appcommitHooked === "true") {
      return false;
    }

    button.dataset.appcommitHooked = "true";
    button.addEventListener("click", () => {
      void handleAutoSaveSubmit();
    });
    knownPortalListenerBound = true;
    greenhouseObserver?.disconnect();
    greenhouseObserver = null;
    return true;
  };

  if (bindButton(getSubmitButton())) {
    return;
  }

  if (!(document.body instanceof Element)) {
    return;
  }

  greenhouseObserver?.disconnect();
  greenhouseObserver = new MutationObserver(() => {
    if (bindButton(getSubmitButton())) {
      greenhouseObserver?.disconnect();
      greenhouseObserver = null;
    }
  });
  formObserver = greenhouseObserver;

  greenhouseObserver.observe(document.body, { childList: true, subtree: true });

  window.setTimeout(() => {
    greenhouseObserver?.disconnect();
    greenhouseObserver = null;
  }, 30000);
}

function bindUnknownPortalSubmitListener() {
  if (unknownSubmitBound) {
    return;
  }

  document.addEventListener(
    "submit",
    () => {
      void handleAutoSaveSubmit();
    },
    true,
  );
  unknownSubmitBound = true;
}

async function hookFormSubmit(_sidebar, jobData) {
  const portal = normalizeJobData(jobData).portal;
  console.log("[AppCommit] Hooking form submit for portal:", portal);

  if (portal === "greenhouse") {
    await bindGreenhouseSubmitListener();
    return;
  }

  if (portal === "workday" || portal === "lever") {
    bindGenericPortalSubmitListener(portal);
    return;
  }

  bindUnknownPortalSubmitListener();
}

async function runDetection(sidebar) {
  const { detectPortal, fillMissingFields, isApplicationForm } = await getSupportModules();
  const tabId = await getTabId();
  const currentUrl = window.location.href;
  const portal = detectPortal(currentUrl);

  sidebar.show();
  sidebar.showState("ac-state-detecting");
  sidebar.setDetectingMessage("Detecting job details...");
  setSaveButtonState(false);
  stopResumeObserver();

  activePortal = portal;
  let jobData = {
    company: null,
    job_title: null,
    job_description: null,
    portal,
    url: currentUrl,
  };

  if (tabId === null) {
    console.log("[AppCommit] Warning: tab ID unavailable, session persistence disabled");
  }

  if (tabId !== null) {
    const session = await getSession(tabId);

    if (session?.jobData) {
      const sessionData = await sanitizeJobData(session.jobData);
      console.log("[AppCommit] Session found:", {
        company: sessionData.company,
        job_title: sessionData.job_title,
        url: session.sourceUrl,
      });

      jobData.company = sessionData.company ?? null;
      jobData.job_title = sessionData.job_title ?? null;
      jobData.job_description = sessionData.job_description ?? null;
    }
  }

  console.log("[AppCommit] Starting detection flow:", {
    portal,
    isApplicationForm: isApplicationForm(),
    url: currentUrl,
    hasSession: Boolean(jobData.company || jobData.job_title || jobData.job_description),
  });

  const needsParser = !jobData.company || !jobData.job_title;

  if (needsParser && portal !== "unknown") {
    try {
      const parserModule = await loadParser(portal);
      const parse = typeof parserModule?.parse === "function" ? parserModule.parse : null;

      if (parse) {
        const parsedData = await sanitizeJobData(await parse());
        jobData = await sanitizeJobData({
          company: jobData.company || parsedData.company,
          job_title: jobData.job_title || parsedData.job_title,
          job_description: jobData.job_description || parsedData.job_description,
          portal,
          url: currentUrl,
          is_embed: jobData.is_embed || parsedData.is_embed,
          resume_input_selector: null,
        });
        console.log("[AppCommit] Hardcoded parser result:", jobData);
      }
    } catch (error) {
      console.log("[AppCommit] Hardcoded parser failed:", error);
    }
  }

  try {
    const { extractCandidates } = await import("../utils/candidate-extractor.js");
    const candidates = extractCandidates();
    jobData = await sanitizeJobData({
      ...jobData,
      resume_input_selector: candidates.resume_input_selector,
    });
    console.log("[AppCommit] Resume selector:", candidates.resume_input_selector);
  } catch (error) {
    console.log("[AppCommit] Extractor error:", error);
  }

  if (!jobData.company || !jobData.job_title) {
    console.log("[AppCommit] Running LLM candidate completion:", {
      company: !jobData.company,
      job_title: !jobData.job_title,
      job_description: !jobData.job_description,
    });
    sidebar.setDetectingMessage("Analyzing with AI...");

    try {
      const llmResult = await sanitizeJobData(await fillMissingFields(jobData));
      jobData = await sanitizeJobData({
        ...jobData,
        company: jobData.company || llmResult.company,
        job_title: jobData.job_title || llmResult.job_title,
        job_description: jobData.job_description || llmResult.job_description,
        resume_input_selector: jobData.resume_input_selector || llmResult.resume_input_selector,
      });
      console.log("[AppCommit] LLM result:", jobData);
    } catch (error) {
      console.log("[AppCommit] LLM call failed:", error);
    }
  }

  jobData = await sanitizeJobData(jobData);
  console.log("[AppCommit] Cleaned job data:", {
    company: jobData.company,
    job_title: jobData.job_title,
  });

  currentJobData = jobData;
  if (!hasJobData(jobData)) {
    console.log("[AppCommit] No job data found after LLM call, showing manual form");
    sidebar.setManualData(jobData);
    sidebar.showState("ac-state-no-job");
    return jobData;
  }

  if (tabId !== null) {
    await saveSession(tabId, jobData);
    console.log("[AppCommit] Session saved with full data");
  }

  sidebar.setJob(jobData);
  sidebar.showState("ac-state-found");
  sidebar.initEditableFields(async (fieldId, newValue) => {
    if (!currentJobData) {
      currentJobData = await sanitizeJobData(jobData);
    }

    if (fieldId === "ac-company") {
      currentJobData.company = newValue;
      jobData.company = newValue;
      console.log("[AppCommit] Company updated by user:", newValue);
    }

    if (fieldId === "ac-role") {
      currentJobData.job_title = newValue;
      jobData.job_title = newValue;
      console.log("[AppCommit] Role updated by user:", newValue);
    }

    const cleaned = await sanitizeJobData(currentJobData);
    currentJobData = cleaned;
    jobData.company = cleaned.company;
    jobData.job_title = cleaned.job_title;
    sidebar.setJob(cleaned);

    if (CURRENT_TAB_ID !== null) {
      await updateSession(CURRENT_TAB_ID, {
        company: cleaned.company,
        job_title: cleaned.job_title,
      });
    }
  });
  if (jobData.job_description) {
    sidebar.setDescriptionFetched();
  } else {
    sidebar.setDescriptionLoading();
    void fetchDescription(jobData)
      .then(async (description) => {
        if (description) {
          const cleaned = await sanitizeJobData({
            ...jobData,
            job_description: description,
          });
          jobData.job_description = cleaned.job_description;
          currentJobData = cleaned;
          sidebar.setDescriptionFetched();

          if (CURRENT_TAB_ID !== null) {
            await updateSession(CURRENT_TAB_ID, {
              job_description: cleaned.job_description,
            });
          }

          return;
        }

        sidebar.setDescriptionNotFound();
      })
      .catch(() => {
        sidebar.setDescriptionNotFound();
      });
  }
  await handleResumeDetection(sidebar, jobData.resume_input_selector ?? null);
  sidebar.setAutoSave(autoSaveEnabled);
  sidebar.onSave(async () => {
    await handleSave(sidebar, jobData);
  });
  await hookFormSubmit(sidebar, jobData);

  return jobData;
}

async function classifyAndShowSidebar(sidebar) {
  const { detectPortal, isApplicationForm } = await getSupportModules();
  const portal = detectPortal(window.location.href);
  const onApplicationForm = isApplicationForm();

  activePortal = portal;
  console.log("[AppCommit] Initial page classification:", {
    portal,
    isApplicationForm: onApplicationForm,
    url: window.location.href,
  });

  if (portal !== "unknown" && !onApplicationForm) {
    currentJobData = null;
    sidebar.showPortalDetected(portal);
    return { portal, shouldRunDetection: false };
  }

  if (portal === "unknown") {
    currentJobData = null;
    sidebar.showPortalDetected("unknown");
    return { portal, shouldRunDetection: false };
  }

  return { portal, shouldRunDetection: true };
}

function stopSpaWatcher() {
  spaWatcherObserver?.disconnect();
  spaWatcherObserver = null;

  if (popstateHandler) {
    window.removeEventListener("popstate", popstateHandler);
    popstateHandler = null;
  }

  if (spaWatcherTimeoutId) {
    window.clearTimeout(spaWatcherTimeoutId);
    spaWatcherTimeoutId = null;
  }

  spaWatcherBound = false;
}

function watchForFormNavigation(sidebar) {
  if (spaWatcherBound || !(document.body instanceof Element)) {
    return;
  }

  console.log("[AppCommit] Starting SPA navigation watcher");
  spaWatcherBound = true;
  lastKnownUrl = window.location.href;

  const handleUrlChange = async () => {
    if (!isContextValid()) {
      stopAllObservers();
      return;
    }

    const currentUrl = window.location.href;
    if (currentUrl === lastKnownUrl) {
      return;
    }
    if (isDetecting) {
      return;
    }

    console.log("[AppCommit] URL changed:", lastKnownUrl, "→", currentUrl);
    lastKnownUrl = currentUrl;

    const currentSidebar = await getSidebarForUrlChange(sidebar, currentUrl);
    if (!currentSidebar) {
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1500));

    const { detectPortal, isApplicationForm } = await getSupportModules();
    const portal = detectPortal(currentUrl);

    if (shouldSuppressPage(portal)) {
      setSidebarSuppressed(true);
      currentSidebar.hide();
      console.log("[AppCommit] Jobright handoff detected, waiting for redirect");
      return;
    }

    setSidebarSuppressed(false);
    const onForm = isApplicationForm();
    const shouldAutoRun = onForm && shouldAutoRunPortal(portal);

    console.log("[AppCommit] After navigation — is form:", onForm);
    console.log("[AppCommit] After navigation — auto-run:", shouldAutoRun, "portal:", portal);

    if (shouldAutoRun) {
      if (isApplyUrl(currentUrl)) {
        console.log("[AppCommit] Apply URL detected — re-running with session");
      }

      isDetecting = true;
      try {
        await openSidebarForForm(currentSidebar);
      } finally {
        isDetecting = false;
      }
      return;
    }

    currentSidebar.hide();
    console.log("[AppCommit] Sidebar collapsed — manual detect only");
  };

  spaWatcherObserver = new MutationObserver(() => {
    void handleUrlChange();
  });
  urlObserver = spaWatcherObserver;
  spaWatcherObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  popstateHandler = () => {
    void (async () => {
      if (isDetecting) {
        return;
      }
      const currentUrl = window.location.href;
      lastKnownUrl = currentUrl;

      const currentSidebar = await getSidebarForUrlChange(sidebar, currentUrl);
      if (!currentSidebar) {
        return;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      const { detectPortal, isApplicationForm } = await getSupportModules();
      const portal = detectPortal(currentUrl);

      if (shouldSuppressPage(portal)) {
        setSidebarSuppressed(true);
        currentSidebar.hide();
        console.log("[AppCommit] Jobright handoff detected, waiting for redirect");
        return;
      }

      setSidebarSuppressed(false);
      const onForm = isApplicationForm();
      const shouldAutoRun = onForm && shouldAutoRunPortal(portal);

      if (!shouldAutoRun) {
        currentSidebar.hide();
        console.log("[AppCommit] Sidebar collapsed — manual detect only");
        return;
      }

      isDetecting = true;
      try {
        await openSidebarForForm(currentSidebar);
      } finally {
        isDetecting = false;
      }
    })();
  };
  window.addEventListener("popstate", popstateHandler);

  spaWatcherTimeoutId = window.setTimeout(() => {
    console.log("[AppCommit] SPA navigation watcher stopped after timeout");
    stopSpaWatcher();
  }, SPA_WATCH_TIMEOUT_MS);
}

async function main() {
  try {
    if (!isContextValid()) {
      console.log("[AppCommit] Context invalid on init, aborting");
      return;
    }

    const { detectPortal, isApplicationForm } = await getSupportModules();
    const portal = detectPortal(window.location.href);
    activePortal = portal;

    if (shouldSuppressPage(portal)) {
      const sidebar = await initCollapsedTab();
      setSidebarSuppressed(true);
      watchForFormNavigation(sidebar);
      console.log("[AppCommit] Jobright handoff detected, waiting for redirect");
      return;
    }

    setSidebarSuppressed(false);
    if (!looksLikeJobPage(portal)) {
      console.log("[AppCommit] Page does not look like a job page, skipping sidebar");
      return;
    }

    const sidebar = await initCollapsedTab();
    const onForm = isApplicationForm();
    const shouldAutoRun = onForm && shouldAutoRunPortal(portal);

    console.log("[AppCommit] Is application form:", onForm, window.location.href);
    console.log("[AppCommit] Auto-run enabled:", shouldAutoRun, "portal:", portal);

    if (shouldAutoRun) {
      console.log("[AppCommit] Known ATS form detected — opening");
      await openSidebarForForm(sidebar);
    } else {
      console.log("[AppCommit] Manual mode — staying collapsed");
    }

    watchForFormNavigation(sidebar);
  } catch (error) {
    console.log("[AppCommit] Startup failed:", error);
  }
}

if (isContextValid()) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isContextValid()) {
      stopAllObservers();
      return false;
    }

    if (message?.type === "AUTH_EXPIRED") {
      console.log("[AppCommit Auth] Token expired mid-session");
      void ensureSidebar().then((sidebar) => {
        sidebar.showAuth(message?.reason ?? "token_expired");
      });
      return false;
    }

    if (message?.type === "TOKEN_EXPIRING_SOON") {
      console.log("[AppCommit Auth] Token expiring soon, re-checking");
      void (async () => {
        const result = await checkAuthStatus();

        if (!result?.authenticated) {
          const sidebar = await ensureSidebar();
          sidebar.showAuth(result.reason ?? "token_expired");
        }
      })();
      return false;
    }

    if (message?.type === "OPEN_SIDEBAR") {
      console.log("[AppCommit] Open sidebar from popup");
      void (async () => {
        try {
          dismissedThisSession = false;
          dismissedHostname = null;

          const sidebar = await ensureSidebar();
          sidebar.open();
          await runDetection(sidebar);
          sendResponse({ success: true });
        } catch (error) {
          console.log("[AppCommit] OPEN_SIDEBAR failed:", error);
          sendResponse({ success: false });
        }
      })();
      return true;
    }

    if (message?.type !== "PARSE_CURRENT_PAGE") {
      return false;
    }

    (async () => {
      try {
        const { detectPortal } = await getSupportModules();
        const sidebar = await ensureSidebar();
        const data = await runDetection(sidebar);
        const portal = detectPortal(window.location.href);

        sendResponse({
          ...(data || {
            company: null,
            job_title: null,
            job_description: null,
            portal,
            url: window.location.href,
          }),
          resume: currentResume,
        });
      } catch (error) {
        console.log("[AppCommit] PARSE_CURRENT_PAGE failed:", error);
        sendResponse(null);
      }
    })();

    return true;
  });
}

async function init() {
  if (!isContextValid()) {
    console.log("[AppCommit] Context invalid on init, aborting");
    return;
  }

  try {
    bindAuthStorageListener();
    await initTabId();
    if (CURRENT_TAB_ID === null) {
      console.log("[AppCommit] Warning: running without tab-scoped session support");
    }
    await main();
  } catch (err) {
    if (err?.message?.includes("Extension context invalidated")) {
      stopAllObservers();
      return;
    }
    console.log("[AppCommit] Startup failed:", err);
  }
}

void init();
