document.addEventListener("DOMContentLoaded", async () => {
  const runtimeConfig = await chrome.runtime.sendMessage({ type: "GET_RUNTIME_CONFIG" });
  const statusMessage = document.getElementById("status-message");
  const sidebarButton = document.getElementById("btn-sidebar");
  const dashboardButton = document.getElementById("btn-dashboard");

  const showStatusMessage = (message) => {
    if (statusMessage instanceof HTMLElement) {
      statusMessage.textContent = message;
      statusMessage.style.display = "block";
    }
  };

  dashboardButton?.addEventListener("click", () => {
    if (!runtimeConfig?.dashboardAppUrl) {
      return;
    }

    chrome.tabs.create({
      url: runtimeConfig.dashboardAppUrl,
    });
    window.close();
  });

  sidebarButton?.addEventListener("click", async () => {
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
      showStatusMessage("AppCommit only works on supported job application pages.");
      if (sidebarButton instanceof HTMLButtonElement) {
        sidebarButton.textContent = "Unsupported Page";
        sidebarButton.disabled = true;
      }
    }
  });
});
