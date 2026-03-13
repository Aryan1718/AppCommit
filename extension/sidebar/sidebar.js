const SIDEBAR_ID = "appcommit-sidebar";
const TAB_ID = "appcommit-tab";
const CSS_ID = "appcommit-sidebar-css";

export function initSidebar(options = {}) {
  const existingSidebar = document.getElementById(SIDEBAR_ID);
  const existingTab = document.getElementById(TAB_ID);

  if (existingSidebar && existingTab) {
    initializeVisibility(existingSidebar);
    return buildApi(existingSidebar, existingTab, options);
  }

  ensureStylesheet(options.cssHref);

  const fragment = document.createRange().createContextualFragment(options.html || "");
  document.body?.appendChild(fragment);

  const sidebar = document.getElementById(SIDEBAR_ID);
  const tab = document.getElementById(TAB_ID);

  initializeVisibility(sidebar);

  return buildApi(sidebar, tab, options);
}

function ensureStylesheet(cssHref) {
  if (!cssHref || document.getElementById(CSS_ID)) {
    return;
  }

  const link = document.createElement("link");
  link.id = CSS_ID;
  link.rel = "stylesheet";
  link.href = cssHref;
  document.head?.appendChild(link);
}

function buildApi(sidebar, tab, options) {
  if (!(sidebar instanceof HTMLElement) || !(tab instanceof HTMLElement)) {
    throw new Error("AppCommit sidebar could not be initialized");
  }

  const stateElements = Array.from(sidebar.querySelectorAll(".ac-state"));
  let saveHandler = null;
  let uploadErrorTimeoutId = null;

  const elements = {
    close: sidebar.querySelector("#ac-close-btn") || sidebar.querySelector(".ac-close"),
    redetect: sidebar.querySelector("#ac-redetect-btn"),
    portalBadge: sidebar.querySelector("#ac-portal-badge"),
    company: sidebar.querySelector("#ac-company"),
    companyInput: sidebar.querySelector("#ac-company-input"),
    companyEdit: sidebar.querySelector("#ac-company-edit"),
    role: sidebar.querySelector("#ac-role"),
    roleInput: sidebar.querySelector("#ac-role-input"),
    roleEdit: sidebar.querySelector("#ac-role-edit"),
    jdStatus: sidebar.querySelector("#ac-jd-status"),
    resumeFoundState: sidebar.querySelector("#ac-resume-found-state"),
    resumeWatching: sidebar.querySelector("#ac-resume-watching"),
    resumeCaptured: sidebar.querySelector("#ac-resume-captured"),
    resumeUploadState: sidebar.querySelector("#ac-resume-upload-state"),
    resumeUploaded: sidebar.querySelector("#ac-resume-uploaded"),
    resumeFilename: sidebar.querySelector("#ac-resume-filename"),
    uploadedFilename: sidebar.querySelector("#ac-uploaded-filename"),
    uploadError: sidebar.querySelector("#ac-upload-error"),
    fileInput: sidebar.querySelector("#ac-file-input"),
    dropzone: sidebar.querySelector("#ac-dropzone"),
    autoSaveToggle: sidebar.querySelector("#ac-autosave"),
    saveButton: sidebar.querySelector("#ac-save-btn"),
    successCompany: sidebar.querySelector("#ac-success-company"),
    successRole: sidebar.querySelector("#ac-success-role"),
    savedResumeName: sidebar.querySelector("#ac-saved-resume-name"),
    viewDashboard: sidebar.querySelector("#ac-view-dashboard-btn"),
    saveAnother: sidebar.querySelector("#ac-save-another-btn"),
    openDashboard: sidebar.querySelector("#ac-open-dashboard-btn"),
    checkAuth: sidebar.querySelector("#ac-check-auth-btn"),
    authTitle: sidebar.querySelector("#ac-auth-title"),
    authSub: sidebar.querySelector("#ac-auth-sub"),
    authReason: sidebar.querySelector("#ac-auth-reason"),
    errorTitle: sidebar.querySelector("#ac-error-title"),
    errorSub: sidebar.querySelector("#ac-error-sub"),
    retry: sidebar.querySelector("#ac-retry-btn"),
    detectNow: sidebar.querySelector("#ac-detect-now-btn"),
    detectedPortalName: sidebar.querySelector("#ac-detected-portal-name"),
    detectingMessage: sidebar.querySelector(".ac-detecting-msg"),
    manualTitle: sidebar.querySelector("#ac-manual-title"),
    manualSub: sidebar.querySelector("#ac-manual-sub"),
    manualCompany: sidebar.querySelector("#ac-manual-company"),
    manualRole: sidebar.querySelector("#ac-manual-role"),
    manualDescription: sidebar.querySelector("#ac-manual-description"),
    manualFileInput: sidebar.querySelector("#ac-manual-save-file-input"),
    manualDropzone: sidebar.querySelector("#ac-manual-save-dropzone"),
    manualUploadError: sidebar.querySelector("#ac-manual-save-upload-error"),
    manualResumeUploaded: sidebar.querySelector("#ac-manual-save-resume-uploaded"),
    manualResumeName: sidebar.querySelector("#ac-manual-save-resume-name"),
    manualSaveButton: sidebar.querySelector("#ac-manual-save-btn"),
  };

  if (elements.autoSaveToggle instanceof HTMLInputElement) {
    elements.autoSaveToggle.checked = Boolean(options.initialAutoSaveEnabled ?? true);
  }

  clearLegacyHiddenClass(tab);
  setOpen(sidebar.classList.contains("ac-open"));

  elements.close?.addEventListener("click", () => {
    api.hide();
  });

  tab.addEventListener("click", () => {
    api.show();
  });

  elements.saveButton?.addEventListener("click", () => {
    if (typeof saveHandler === "function") {
      void saveHandler();
    }
  });

  elements.viewDashboard?.addEventListener("click", () => {
    options.onOpenDashboard?.(options.dashboardAppUrl || options.dashboardUrl || "");
  });

  elements.saveAnother?.addEventListener("click", () => {
    api.showState("ac-state-found");
  });

  elements.openDashboard?.addEventListener("click", () => {
    options.onOpenDashboard?.("http://localhost:5173");
  });

  elements.checkAuth?.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("appcommit-recheck-auth"));
  });

  elements.retry?.addEventListener("click", () => {
    options.onRetry?.();
  });

  elements.detectNow?.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("appcommit-detect-now"));
  });

  const resetManualFieldState = () => {
    if (elements.manualCompany instanceof HTMLInputElement) {
      elements.manualCompany.style.borderColor = "";
    }

    if (elements.manualRole instanceof HTMLInputElement) {
      elements.manualRole.style.borderColor = "";
    }

    if (elements.manualDescription instanceof HTMLTextAreaElement) {
      elements.manualDescription.style.borderColor = "";
    }
  };

  const setManualFieldError = (element) => {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.style.borderColor = "#ef4444";
    }
  };

  elements.manualCompany?.addEventListener("input", resetManualFieldState);
  elements.manualRole?.addEventListener("input", resetManualFieldState);
  elements.manualDescription?.addEventListener("input", resetManualFieldState);

  elements.manualSaveButton?.addEventListener("click", () => {
    const company =
      elements.manualCompany instanceof HTMLInputElement ? elements.manualCompany.value.trim() : "";
    const jobTitle =
      elements.manualRole instanceof HTMLInputElement ? elements.manualRole.value.trim() : "";
    const jobDescription =
      elements.manualDescription instanceof HTMLTextAreaElement
        ? elements.manualDescription.value.trim()
        : "";

    resetManualFieldState();

    let hasError = false;

    if (!company) {
      setManualFieldError(elements.manualCompany);
      hasError = true;
    }

    if (!jobTitle) {
      setManualFieldError(elements.manualRole);
      hasError = true;
    }

    if (!jobDescription) {
      setManualFieldError(elements.manualDescription);
      hasError = true;
    }

    if (hasError) {
      return;
    }

    document.dispatchEvent(
      new CustomEvent("appcommit-manual-save", {
        detail: {
          company: company || "Unknown Company",
          job_title: jobTitle || "Unknown Role",
          job_description: jobDescription || null,
          portal: "manual",
          url: window.location.href,
        },
      }),
    );
  });

  const setManualUploadError = (message = "") => {
    if (elements.manualUploadError) {
      elements.manualUploadError.textContent = message;
      elements.manualUploadError.style.display = message ? "block" : "none";
    }
  };

  const clearResumeError = () => {
    if (uploadErrorTimeoutId) {
      window.clearTimeout(uploadErrorTimeoutId);
      uploadErrorTimeoutId = null;
    }

    if (elements.uploadError instanceof HTMLElement) {
      elements.uploadError.textContent = "";
      elements.uploadError.style.display = "none";
    }
  };

  const setManualResumeUploaded = (filename = "") => {
    if (elements.manualResumeName) {
      elements.manualResumeName.textContent = filename || "—";
    }
    if (elements.manualResumeUploaded instanceof HTMLElement) {
      elements.manualResumeUploaded.style.display = filename ? "block" : "none";
    }
  };

  const bindManualResumeUpload = (handler) => {
    const input = elements.manualFileInput;
    const dropzone = elements.manualDropzone;

    if (!(input instanceof HTMLInputElement) || !(dropzone instanceof HTMLElement)) {
      return;
    }

    if (dropzone.dataset.appcommitUploadBound === "true") {
      return;
    }

    dropzone.dataset.appcommitUploadBound = "true";

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) handler(file);
    });

    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("drag-over");
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("drag-over");
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag-over");
      const file = e.dataTransfer?.files?.[0];
      if (file) handler(file);
    });
  };

  elements.autoSaveToggle?.addEventListener("change", (event) => {
    const target = event.target instanceof HTMLInputElement ? event.target : null;
    options.onAutoSaveChange?.(Boolean(target?.checked));
  });

  const api = {
    show() {
      setOpen(true);
    },

    hide() {
      setOpen(false);
    },

    showState(id) {
      for (const stateElement of stateElements) {
        stateElement.removeAttribute("data-active");
        stateElement.style.display = "none";
      }

      if (id === "ac-state-no-job") {
        resetManualFieldState();
        setManualUploadError("");
      }

      const targetState = sidebar.querySelector(`#${id}`);
      if (targetState instanceof HTMLElement) {
        targetState.setAttribute("data-active", "true");
        targetState.style.display = "flex";
      }

      console.log("[AppCommit Sidebar] Showing state:", id);
    },

    setDetectingMessage(message) {
      if (elements.detectingMessage) {
        elements.detectingMessage.textContent =
          normalizeText(message) || "Detecting job details...";
      }
    },

    showPortalDetected(portal) {
      const portalNames = {
        greenhouse: "Greenhouse",
        workday: "Workday",
        lever: "Lever",
        unknown: "Job Portal",
      };

      if (elements.detectedPortalName) {
        elements.detectedPortalName.textContent = portalNames[portal] ?? "Job Portal";
      }

      api.showState("ac-state-portal-detected");
    },

    showAuth(reason) {
      const messages = {
        not_authenticated: {
          title: "Sign in to AppCommit",
          sub: "You need to be signed in to capture snapshots.",
          reason: "",
        },
        token_expired: {
          title: "Session Expired",
          sub: "Your session has expired. Please sign in again to continue.",
          reason: "Your session expired. Sign in again.",
        },
        network_error: {
          title: "Cannot Connect",
          sub: "AppCommit backend is not reachable. Make sure it is running.",
          reason: "",
        },
        no_token: {
          title: "Sign in to AppCommit",
          sub: "You need to be signed in to capture snapshots.",
          reason: "",
        },
      };

      const message = messages[reason] ?? messages.not_authenticated;

      if (reason === "network_error") {
        if (elements.errorTitle) {
          elements.errorTitle.textContent = message.title;
        }

        if (elements.errorSub) {
          elements.errorSub.textContent = message.sub;
        }

        api.showState("ac-state-error");
        return;
      }

      if (elements.authTitle) {
        elements.authTitle.textContent = message.title;
      }

      if (elements.authSub) {
        elements.authSub.textContent = message.sub;
      }

      if (elements.authReason) {
        elements.authReason.textContent = message.reason;
      }

      api.showState("ac-state-auth");
    },

    setManualData(data = {}) {
      const company = normalizeText(data.company) || "";
      const jobTitle = normalizeText(data.job_title) || "";
      const jobDescription = normalizeText(data.job_description) || "";
      const hasPartialData = Boolean(company || jobTitle || jobDescription);

      if (elements.manualTitle) {
        elements.manualTitle.textContent = hasPartialData
          ? "Complete missing details"
          : "Could not detect job";
      }

      if (elements.manualSub) {
        elements.manualSub.textContent = hasPartialData
          ? "AppCommit found part of this job. Review and fill in the missing fields below."
          : "AppCommit couldn't read this page automatically. Enter the job details manually instead.";
      }

      if (elements.manualCompany instanceof HTMLInputElement) {
        elements.manualCompany.value = company;
      }

      if (elements.manualRole instanceof HTMLInputElement) {
        elements.manualRole.value = jobTitle;
      }

      if (elements.manualDescription instanceof HTMLTextAreaElement) {
        elements.manualDescription.value = jobDescription;
      }

      setManualUploadError("");
      setManualResumeUploaded("");
      resetManualFieldState();
    },

    setJob(data = {}) {
      if (elements.company) {
        elements.company.textContent = data.company || "—";
      }

      if (elements.companyInput instanceof HTMLInputElement) {
        elements.companyInput.value = data.company || "";
      }

      if (elements.role) {
        elements.role.textContent = data.job_title || "—";
      }

      if (elements.roleInput instanceof HTMLInputElement) {
        elements.roleInput.value = data.job_title || "";
      }

      if (elements.portalBadge) {
        const names = {
          greenhouse: "Greenhouse",
          workday: "Workday",
          lever: "Lever",
          unknown: "Job Portal",
          manual: "Manual",
        };
        elements.portalBadge.textContent = `via ${names[data.portal] ?? "Job Portal"}`;
      }

      if (elements.jdStatus) {
        if (data.job_description) {
          elements.jdStatus.textContent = "Fetched";
          elements.jdStatus.className = "ac-field-value-success ac-status-found";
        } else {
          elements.jdStatus.textContent = "Not found";
          elements.jdStatus.className = "ac-field-value-success ac-status-not-found";
        }
      }
    },

    setDescriptionLoading() {
      if (elements.jdStatus) {
        elements.jdStatus.textContent = "Fetching...";
        elements.jdStatus.className = "ac-field-value-success ac-status-loading";
      }
    },

    setDescriptionFetched() {
      if (elements.jdStatus) {
        elements.jdStatus.textContent = "Fetched";
        elements.jdStatus.className = "ac-field-value-success ac-status-found";
      }
    },

    setDescriptionNotFound() {
      if (elements.jdStatus) {
        elements.jdStatus.textContent = "Not found";
        elements.jdStatus.className = "ac-field-value-success ac-status-not-found";
      }
    },

    showResumeFound() {
      clearResumeError();

      if (elements.resumeFoundState instanceof HTMLElement) {
        elements.resumeFoundState.style.display = "block";
      }

      if (elements.resumeUploadState instanceof HTMLElement) {
        elements.resumeUploadState.style.display = "none";
      }

      if (elements.resumeWatching instanceof HTMLElement) {
        elements.resumeWatching.style.display = "flex";
      }

      if (elements.resumeCaptured instanceof HTMLElement) {
        elements.resumeCaptured.style.display = "none";
      }

      console.log("[AppCommit Sidebar] Resume: field found, watching");
    },

    showResumeCaptured(filename) {
      clearResumeError();

      if (elements.resumeWatching instanceof HTMLElement) {
        elements.resumeWatching.style.display = "none";
      }

      if (elements.resumeCaptured instanceof HTMLElement) {
        elements.resumeCaptured.style.display = "flex";
      }

      if (elements.resumeFilename) {
        elements.resumeFilename.textContent = filename;
      }

      console.log("[AppCommit Sidebar] Resume captured:", filename);
    },

    showResumeUpload() {
      clearResumeError();

      if (elements.resumeFoundState instanceof HTMLElement) {
        elements.resumeFoundState.style.display = "none";
      }

      if (elements.resumeUploadState instanceof HTMLElement) {
        elements.resumeUploadState.style.display = "block";
      }

      if (elements.dropzone instanceof HTMLElement) {
        elements.dropzone.style.display = "flex";
      }

      if (elements.resumeUploaded instanceof HTMLElement) {
        elements.resumeUploaded.style.display = "none";
      }

      console.log("[AppCommit Sidebar] Resume: no field found, showing upload");
    },

    showResumeUploaded(filename) {
      clearResumeError();

      if (elements.dropzone instanceof HTMLElement) {
        elements.dropzone.style.display = "none";
      }

      if (elements.resumeUploaded instanceof HTMLElement) {
        elements.resumeUploaded.style.display = "flex";
      }

      if (elements.uploadedFilename) {
        elements.uploadedFilename.textContent = filename;
      }

      console.log("[AppCommit Sidebar] Resume uploaded:", filename);
    },

    showResumeError(message) {
      clearResumeError();

      if (elements.uploadError instanceof HTMLElement) {
        elements.uploadError.textContent = message;
        elements.uploadError.style.display = "block";
        uploadErrorTimeoutId = window.setTimeout(() => {
          if (elements.uploadError instanceof HTMLElement) {
            elements.uploadError.style.display = "none";
          }
        }, 4000);
      }
    },

    onResumeUpload(fn) {
      bindUploadTarget(elements.fileInput, elements.dropzone, fn);
    },

    onManualResumeUpload(fn) {
      bindManualResumeUpload(fn);
    },

    showManualResumeUploaded(filename) {
      setManualUploadError("");
      setManualResumeUploaded(filename);
    },

    showManualResumeError(message) {
      setManualUploadError(message);
    },

    onSave(fn) {
      saveHandler = typeof fn === "function" ? fn : null;
    },

    onRedetect(fn) {
      if (!(elements.redetect instanceof HTMLButtonElement)) {
        return;
      }

      elements.redetect._appcommitRedetectHandler = typeof fn === "function" ? fn : null;

      if (elements.redetect.dataset.appcommitBound === "true") {
        return;
      }

      elements.redetect.dataset.appcommitBound = "true";
      elements.redetect.addEventListener("click", () => {
        console.log("[AppCommit Sidebar] Re-detect clicked");
        void elements.redetect._appcommitRedetectHandler?.();
      });
    },

    setRedetecting(loading) {
      if (!(elements.redetect instanceof HTMLButtonElement)) {
        return;
      }

      if (loading) {
        elements.redetect.classList.add("ac-spinning");
        elements.redetect.disabled = true;
        return;
      }

      elements.redetect.classList.remove("ac-spinning");
      elements.redetect.disabled = false;
    },

    initEditableFields(onUpdate) {
      setupEditableField(
        elements.company,
        elements.companyInput,
        elements.companyEdit,
        "ac-company",
        onUpdate,
      );
      setupEditableField(
        elements.role,
        elements.roleInput,
        elements.roleEdit,
        "ac-role",
        onUpdate,
      );
    },

    showSaved(data = {}) {
      if (elements.successCompany) {
        elements.successCompany.textContent = normalizeText(data.company) || "Unknown Company";
      }

      if (elements.successRole) {
        elements.successRole.textContent = normalizeText(data.job_title) || "Unknown role";
      }

      if (elements.savedResumeName) {
        elements.savedResumeName.textContent =
          normalizeText(data.resume_filename) || "No resume saved";
      }

      api.showState("ac-state-saved");
      api.show();
    },

    showError() {
      api.showState("ac-state-error");
      api.show();
    },

    setAutoSave(enabled) {
      if (elements.autoSaveToggle instanceof HTMLInputElement) {
        elements.autoSaveToggle.checked = Boolean(enabled);
      }
    },
  };

  return api;
}

function setupEditableField(valueEl, inputEl, btnEl, fieldId, onUpdate) {
  if (
    !(valueEl instanceof HTMLElement) ||
    !(inputEl instanceof HTMLInputElement) ||
    !(btnEl instanceof HTMLButtonElement)
  ) {
    return;
  }

  if (btnEl.dataset.appcommitEditableBound === "true") {
    btnEl.dataset.appcommitEditableCallback = "true";
    btnEl._appcommitOnUpdate = onUpdate;
    return;
  }

  let isEditing = false;
  let originalValue = "";

  const switchToDisplay = () => {
    inputEl.style.display = "none";
    valueEl.style.display = "block";
    btnEl.style.display = "flex";
    isEditing = false;
  };

  const switchToInput = () => {
    originalValue = valueEl.textContent === "—" ? "" : valueEl.textContent || "";
    inputEl.value = originalValue;
    valueEl.style.display = "none";
    btnEl.style.display = "none";
    inputEl.style.display = "block";
    isEditing = true;
    inputEl.focus();
    inputEl.select();
  };

  const confirmEdit = () => {
    if (!isEditing) {
      return;
    }

    const newValue = inputEl.value.trim();
    if (newValue && newValue !== valueEl.textContent) {
      valueEl.textContent = newValue;
      console.log("[AppCommit Sidebar] Field edited:", fieldId, "→", newValue);
      btnEl._appcommitOnUpdate?.(fieldId, newValue);
    }

    switchToDisplay();
  };

  const cancelEdit = () => {
    if (!isEditing) {
      return;
    }

    inputEl.value = originalValue;
    switchToDisplay();
  };

  btnEl.addEventListener("click", () => {
    btnEl._appcommitOnUpdate = onUpdate;
    switchToInput();
  });

  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      confirmEdit();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  });

  inputEl.addEventListener("blur", () => {
    confirmEdit();
  });

  btnEl.dataset.appcommitEditableBound = "true";
  btnEl._appcommitOnUpdate = onUpdate;
}

function normalizeText(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function initializeVisibility(sidebar) {
  if (!(sidebar instanceof HTMLElement)) {
    return;
  }

  const allStates = sidebar.querySelectorAll(".ac-state");
  for (const stateElement of allStates) {
    if (stateElement instanceof HTMLElement) {
      clearLegacyHiddenClass(stateElement);
      stateElement.removeAttribute("data-active");
      stateElement.style.display = "none";
    }
  }

  const resumeStates = [
    sidebar.querySelector("#ac-resume-found-state"),
    sidebar.querySelector("#ac-resume-waiting"),
    sidebar.querySelector("#ac-resume-captured"),
    sidebar.querySelector("#ac-resume-upload-state"),
    sidebar.querySelector("#ac-resume-uploaded"),
    sidebar.querySelector("#ac-manual-save-resume-uploaded"),
    sidebar.querySelector("#ac-upload-error"),
    sidebar.querySelector("#ac-manual-save-upload-error"),
  ];

  for (const resumeState of resumeStates) {
    if (resumeState instanceof HTMLElement) {
      clearLegacyHiddenClass(resumeState);
      resumeState.style.display = "none";
    }
  }

  const detectingState = sidebar.querySelector("#ac-state-detecting");
  if (detectingState instanceof HTMLElement) {
    detectingState.setAttribute("data-active", "true");
    detectingState.style.display = "flex";
  }
}

function clearLegacyHiddenClass(element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.className = element.className
    .split(/\s+/)
    .filter((className) => className && className !== "hidden")
    .join(" ");
}

function bindUploadTarget(input, dropzone, handler) {
  if (!(input instanceof HTMLInputElement) || !(dropzone instanceof HTMLElement)) {
    return;
  }

  dropzone._appcommitUploadHandler = typeof handler === "function" ? handler : null;

  if (dropzone.dataset.appcommitUploadBound === "true") {
    return;
  }

  dropzone.dataset.appcommitUploadBound = "true";

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) {
      dropzone._appcommitUploadHandler?.(file);
    }
  });

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("drag-over");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("drag-over");
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("drag-over");
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      dropzone._appcommitUploadHandler?.(file);
    }
  });
}

function setOpen(isOpen) {
  const sidebar = document.getElementById(SIDEBAR_ID);
  const tab = document.getElementById(TAB_ID);

  if (!(sidebar instanceof HTMLElement) || !(tab instanceof HTMLElement)) {
    return;
  }

  sidebar.classList.toggle("ac-open", isOpen);
  tab.classList.toggle("ac-hidden", isOpen);
}
