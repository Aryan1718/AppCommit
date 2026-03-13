const SESSION_TTL = 30 * 60 * 1000;
const SESSION_KEY_PREFIX = "job_session_";

export async function saveJobSession(tabId, jobData) {
  if (!Number.isInteger(tabId) || tabId <= 0) {
    console.log("[AppCommit Session] Invalid tabId, skipping save:", tabId);
    return;
  }

  const key = SESSION_KEY_PREFIX + tabId;
  const now = Date.now();
  const session = {
    tabId,
    jobData,
    capturedAt: now,
    expiresAt: now + SESSION_TTL,
    sourceUrl: jobData?.url ?? null,
  };

  await chrome.storage.session.set({ [key]: session });
  console.log("[AppCommit Session] Saved session for tab:", tabId, {
    company: jobData?.company ?? null,
    job_title: jobData?.job_title ?? null,
    hasDescription: Boolean(jobData?.job_description),
    sourceUrl: jobData?.url ?? null,
  });
}

export async function getJobSession(tabId) {
  if (!Number.isInteger(tabId) || tabId <= 0) {
    console.log("[AppCommit Session] Invalid tabId, skipping get:", tabId);
    return null;
  }

  const key = SESSION_KEY_PREFIX + tabId;

  try {
    const result = await chrome.storage.session.get(key);
    const session = result?.[key] ?? null;

    if (!session) {
      console.log("[AppCommit Session] No session for tab:", tabId);
      return null;
    }

    if (session.tabId !== tabId) {
      console.log("[AppCommit Session] Tab ID mismatch — discarding");
      await chrome.storage.session.remove(key);
      return null;
    }

    if (Date.now() > session.expiresAt) {
      console.log("[AppCommit Session] Expired — discarding");
      await chrome.storage.session.remove(key);
      return null;
    }

    const ageSeconds = Math.round((Date.now() - session.capturedAt) / 1000);
    console.log("[AppCommit Session] Found session, age:", `${ageSeconds}s`, {
      company: session?.jobData?.company ?? null,
      job_title: session?.jobData?.job_title ?? null,
    });

    return session;
  } catch (err) {
    console.log("[AppCommit Session] Error reading session:", err);
    return null;
  }
}

export async function updateJobSession(tabId, updates) {
  if (!Number.isInteger(tabId) || tabId <= 0) {
    console.log("[AppCommit Session] Invalid tabId, skipping update:", tabId);
    return;
  }

  const key = SESSION_KEY_PREFIX + tabId;

  try {
    const result = await chrome.storage.session.get(key);
    const session = result?.[key] ?? null;

    if (!session) {
      return;
    }

    session.jobData = { ...session.jobData, ...updates };
    await chrome.storage.session.set({ [key]: session });

    console.log("[AppCommit Session] Updated session:", updates);
  } catch (err) {
    console.log("[AppCommit Session] Error updating session:", err);
  }
}

export async function clearJobSession(tabId) {
  if (!Number.isInteger(tabId) || tabId <= 0) {
    console.log("[AppCommit Session] Invalid tabId, skipping clear:", tabId);
    return;
  }

  const key = SESSION_KEY_PREFIX + tabId;
  await chrome.storage.session.remove(key);
  console.log("[AppCommit Session] Cleared session for tab:", tabId);
}

export async function debugSessions() {
  const all = await chrome.storage.session.get(null);
  const sessions = Object.entries(all)
    .filter(([key]) => key.startsWith(SESSION_KEY_PREFIX))
    .map(([key, value]) => ({
      key,
      tabId: value?.tabId ?? null,
      company: value?.jobData?.company ?? null,
      job_title: value?.jobData?.job_title ?? null,
      sourceUrl: value?.sourceUrl ?? null,
      age: `${Math.round((Date.now() - (value?.capturedAt ?? Date.now())) / 1000)}s`,
    }));

  console.log("[AppCommit Session] All active sessions:", sessions);
  return sessions;
}

export function isApplyUrl(url) {
  const applyPatterns = [
    /\/apply\//i,
    /\/application/i,
    /\/jobs\/.*\/apply/i,
    /[?&]apply=/i,
    /\/submit/i,
    /greenhouse\.io\/.*\/jobs\//i,
    /jobs\.lever\.co\//i,
    /myworkdayjobs\.com\//i,
    /\/careers\/.*\/apply/i,
  ];

  return applyPatterns.some((pattern) => pattern.test(url));
}

export function isSameJob(sessionUrl, currentUrl) {
  if (!sessionUrl || !currentUrl) {
    return false;
  }

  try {
    const source = new URL(sessionUrl);
    const current = new URL(currentUrl);

    if (source.hostname === current.hostname) {
      return true;
    }

    const sourceDomain = source.hostname.replace(/^www\./, "");
    const currentDomain = current.hostname.replace(/^www\./, "");
    const atsPatterns = [
      /^(.+?)\.greenhouse\.io/,
      /^(.+?)\.lever\.co/,
      /^(.+?)\.myworkdayjobs\.com/,
      /^(.+?)\.jobs\.com/,
    ];

    for (const pattern of atsPatterns) {
      const sourceMatch = sourceDomain.match(pattern);
      const currentMatch = currentDomain.match(pattern);
      if (sourceMatch && currentMatch && sourceMatch[1] === currentMatch[1]) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}
