const REFRESH_INTERVAL = 8 * 60 * 1000;
const EXPIRY_WARNING_WINDOW_MS = 5 * 60 * 1000;
let syncInterval = null;

function findSupabaseAuthKey() {
  return (
    Object.keys(localStorage).find((key) => key.startsWith("sb-") && key.endsWith("-auth-token")) ?? null
  );
}

function parseJWT(token) {
  try {
    const base64 = token.split(".")[1];
    if (!base64) {
      return null;
    }

    const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function normalizeSession(rawSession) {
  if (!rawSession || typeof rawSession !== "object") {
    return null;
  }

  return rawSession.currentSession || rawSession.session || rawSession;
}

async function clearExtensionToken() {
  if (!chrome.runtime?.id) {
    console.log("[AppCommit AuthSync] Context invalidated, stopping token clear");
    if (syncInterval) {
      window.clearInterval(syncInterval);
      syncInterval = null;
    }
    return;
  }

  await chrome.storage.local.remove(["token", "tokenExpiresAt", "userEmail"]);
  console.log("[AppCommit Auth] Token cleared");
}

async function getSupabaseSession() {
  try {
    const key = findSupabaseAuthKey();
    if (!key) {
      return null;
    }

    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    return normalizeSession(JSON.parse(raw));
  } catch (err) {
    console.log("[AppCommit Auth] Error reading Supabase session:", err);
    return null;
  }
}

async function syncToken() {
  if (!chrome.runtime?.id) {
    console.log("[AppCommit AuthSync] Context invalidated, stopping sync");
    if (syncInterval) {
      window.clearInterval(syncInterval);
      syncInterval = null;
    }
    return;
  }

  try {
    const session = await getSupabaseSession();

    if (!session?.access_token) {
      await chrome.storage.local.remove(["token", "tokenExpiresAt", "userEmail"]);
      return;
    }

    const tokenPayload = parseJWT(session.access_token);
    const expiresAt =
      (typeof tokenPayload?.exp === "number" ? tokenPayload.exp * 1000 : null) ??
      (typeof session?.expires_at === "number" ? session.expires_at * 1000 : null) ??
      (typeof session?.expiresAt === "number" ? session.expiresAt : null) ??
      Date.now() + 3600000;

    await chrome.storage.local.set({
      token: session.access_token,
      tokenExpiresAt: expiresAt,
    });

    const timeUntilExpiry = expiresAt - Date.now();
    console.log(
      `[AppCommit AuthSync] Token synced, expires in ${Math.round(timeUntilExpiry / 60000)}min`,
    );

    if (timeUntilExpiry < EXPIRY_WARNING_WINDOW_MS) {
      console.log("[AppCommit Auth] Token expiring soon, waiting for Supabase refresh");
    }
  } catch (err) {
    if (
      err?.message?.includes("Extension context invalidated") ||
      err?.message?.includes("Cannot access a chrome")
    ) {
      console.log("[AppCommit AuthSync] Context lost, clearing interval");
      if (syncInterval) {
        window.clearInterval(syncInterval);
        syncInterval = null;
      }
    } else {
      console.log("[AppCommit AuthSync] Sync error:", err);
    }
  }
}

void syncToken();
syncInterval = window.setInterval(() => {
  void syncToken();
}, REFRESH_INTERVAL);

window.addEventListener("storage", (event) => {
  if (!event.key?.startsWith("sb-")) {
    return;
  }

  if (event.key.endsWith("-auth-token")) {
    console.log("[AppCommit Auth] Supabase auth state changed, syncing token");
    void syncToken();
    return;
  }

  if (event.newValue === null) {
    console.log("[AppCommit Auth] Supabase session removed, clearing token");
    void clearExtensionToken();
  }
});

window.addEventListener("unload", () => {
  if (syncInterval) {
    window.clearInterval(syncInterval);
    syncInterval = null;
  }
});
