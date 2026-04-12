import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const envPath = path.join(repoRoot, ".env");
const extensionDir = path.join(repoRoot, "extension");
const configOutputPath = path.join(extensionDir, "config.js");
const manifestOutputPath = path.join(extensionDir, "manifest.json");

const ATS_MATCHES = [
  "https://*.greenhouse.io/*",
  "https://job-boards.greenhouse.io/*",
  "https://boards.greenhouse.io/*",
  "https://*.myworkdayjobs.com/*",
  "https://*.lever.co/*",
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${filePath}. Copy .env.example to .env first.`);
  }

  const env = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function requireEnv(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function joinUrl(base, pathname) {
  return `${trimTrailingSlash(base)}${pathname}`;
}

function toOriginMatch(urlString) {
  const url = new URL(urlString);
  return `${url.origin}/*`;
}

const env = parseEnvFile(envPath);
const apiBaseUrl = requireEnv(env, "EXTENSION_API_BASE_URL");
const dashboardUrl = requireEnv(env, "EXTENSION_DASHBOARD_URL");
const dashboardAppUrl = requireEnv(env, "EXTENSION_DASHBOARD_APP_URL");

const configSource = `export const runtimeConfig = Object.freeze({
  apiBaseUrl: ${JSON.stringify(trimTrailingSlash(apiBaseUrl))},
  dashboardUrl: ${JSON.stringify(trimTrailingSlash(dashboardUrl))},
  dashboardAppUrl: ${JSON.stringify(trimTrailingSlash(dashboardAppUrl))},
});
`;

const manifest = {
  manifest_version: 3,
  name: "AppCommit",
  version: "1.0.0",
  description:
    "Captures job application details automatically across supported job sites so you can save job snapshots and resumes.",
  icons: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
  permissions: ["storage", "tabs", "alarms"],
  host_permissions: [toOriginMatch(apiBaseUrl)],
  background: {
    service_worker: "background.js",
    type: "module",
  },
  content_scripts: [
    {
      matches: ATS_MATCHES,
      js: ["content/content.js"],
      run_at: "document_idle",
      all_frames: false,
    },
  ],
  web_accessible_resources: [
    {
      resources: [
        "content/parsers/llm.js",
        "content/parsers/greenhouse.js",
        "content/parsers/workday.js",
        "content/parsers/lever.js",
        "utils/candidate-extractor.js",
        "utils/resume-capture.js",
        "utils/api.js",
        "utils/detect-portal.js",
        "sidebar/sidebar.js",
        "sidebar/sidebar.css",
        "sidebar/sidebar.html",
      ],
      matches: ATS_MATCHES,
    },
  ],
  action: {
    default_popup: "popup/popup.html",
    default_icon: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    },
    default_title: "AppCommit",
  },
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'",
  },
};

fs.writeFileSync(configOutputPath, configSource, "utf8");
fs.writeFileSync(manifestOutputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote ${path.relative(repoRoot, configOutputPath)}`);
console.log(`Wrote ${path.relative(repoRoot, manifestOutputPath)}`);
