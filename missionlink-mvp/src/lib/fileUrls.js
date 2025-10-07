// src/lib/fileUrls.js
import { API_BASE as API_BASE_ENV } from "./api";

// Where your Flask backend lives
const RENDER_BACKEND = "https://missionlink-mvp.onrender.com";

// Resolve a safe base:
// - Prod: absolute from env (strip trailing / and /api)
// - If env is empty or relative ("/api"), and we are on a Vercel domain, force absolute Render base
// - Dev (localhost): allow same-origin by returning ""
function resolveBase() {
  let base = (API_BASE_ENV || "").trim();

  const isAbsolute = /^https?:\/\//i.test(base);
  const isRelative = !!base && !isAbsolute;

  const onVercel =
    typeof window !== "undefined" && /\.vercel\.app$/i.test(window.location.hostname);

  if (!base || isRelative) {
    // If we're on Vercel and the base is missing/relative, force absolute Render origin
    return onVercel ? RENDER_BACKEND : "";
  }

  // Absolute: normalize trailing slashes and trailing /api
  return base.replace(/\/+$/, "").replace(/\/api$/i, "");
}

const BASE = resolveBase();

// Optional: debug
if (typeof window !== "undefined") {
  window.__API_BASE = BASE;
  // eslint-disable-next-line no-console
  console.log("[fileUrls] BASE =", BASE);
}

export function toBackendUrl(url) {
  if (!url) return "";
  const raw = String(url).trim();

  // Already absolute? Return as-is.
  if (/^https?:\/\//i.test(raw)) return raw;

  // Normalize path
  let path = raw.startsWith("/") ? raw : `/${raw}`;

  // Rewrite legacy paths to the public route
  if (path.startsWith("/api/uploads/")) {
    path = "/api/files/" + path.slice("/api/uploads/".length);
  } else if (path.startsWith("/uploads/")) {
    path = "/api/files/" + path.slice("/uploads/".length);
  } else if (path.startsWith("/api/upload")) {
    path = path.replace("/api/upload", "/api/files");
  }

  // If we have an absolute base, join and guard against /api/api
  if (BASE) {
    return (BASE + path).replace(/\/api\/api(\/|$)/, "/api$1");
  }

  // Same-origin fallback (dev)
  return path;
}
