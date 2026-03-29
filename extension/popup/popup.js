document.addEventListener("DOMContentLoaded", async () => {
  const { token } = await chrome.storage.local.get("token");

  if (!token) {
    const authSection = document.getElementById("auth-section");
    if (authSection instanceof HTMLElement) {
      authSection.style.display = "flex";
    }
  }

  document.getElementById("btn-signin")?.addEventListener("click", () => {
    chrome.tabs.create({
      url: "https://www.appcommit.online/login",
    });
    window.close();
  });

  document.getElementById("btn-signup")?.addEventListener("click", () => {
    chrome.tabs.create({
      url: "https://www.appcommit.online/signup",
    });
    window.close();
  });

  document.getElementById("btn-sidebar")?.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      return;
    }

    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "OPEN_SIDEBAR",
      });
      window.close();
    } catch {
      const button = document.getElementById("btn-sidebar");
      if (button instanceof HTMLButtonElement) {
        button.textContent = "Not available here";
        button.disabled = true;
      }
    }
  });
});
