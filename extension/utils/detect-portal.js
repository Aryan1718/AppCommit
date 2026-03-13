// Detects which supported job portal a URL belongs to.
export function detectPortal(url) {
  const normalizedUrl = typeof url === "string" ? url : "";

  if (normalizedUrl.includes("jobright")) {
    return "jobright";
  }

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

export function isApplicationForm() {
  const hasFileInput = Boolean(document.querySelector('input[type="file"]'));

  const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"], button');
  const hasApplySubmit = Array.from(submitButtons).some((button) => {
    const text = (button.innerText || button.value || "").toLowerCase();
    return (
      text.includes("apply") ||
      text.includes("submit application") ||
      text.includes("submit your application") ||
      text.includes("send application")
    );
  });

  const formInputs = document.querySelectorAll('form input[type="text"], form input[type="email"]');
  const hasFormInputs = formInputs.length >= 2;

  const applyUrlPatterns = [
    /\/apply/i,
    /\/application/i,
    /greenhouse\.io\/.*\/jobs\//i,
    /jobs\.lever\.co\//i,
    /myworkdayjobs\.com\//i,
    /ashbyhq\.com\//i,
    /smartrecruiters\.com\//i,
    /jobvite\.com\//i,
  ];
  const matchesApplyUrl = applyUrlPatterns.some((pattern) => pattern.test(window.location.href));

  if (matchesApplyUrl) {
    return true;
  }

  if (hasFileInput && hasFormInputs) {
    return true;
  }

  if (hasApplySubmit && hasFormInputs) {
    return true;
  }

  if (hasFileInput && hasApplySubmit) {
    return true;
  }

  return false;
}
