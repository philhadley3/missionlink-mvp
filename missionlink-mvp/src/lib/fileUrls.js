// src/lib/fileUrls.js
import { API_BASE as API_BASE_ENV } from "./api";

// Where your Flask backend lives (Render)
const RENDER_BACKEND = "https://missionlink-mvp.onrender.com";

/**
 * Resolve a safe "origin" base (no trailing slash, no trailing /api).
 * - Prefers SAME-ORIGIN calls so Vercel rewrites handle API proxying (avoids CORS).
 * - If an absolute env URL is given, normalize and use it.
 */
function resolveBase() {
  const base = (API_BASE_ENV || "").trim();
  const isAbsolute = /^https?:\/\//i.test(base);

  // ✅ Use same-origin when env is empty or relative
  if (!base || !isAbsolute) {
    return "";
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

/** Small helper: cleanly join parts with single slashes. */
function joinUrl(base, path) {
  if (!base) return path;
  return `${base.replace(/\/+$/, "")}/${String(path || "").replace(/^\/+/, "")}`;
}

/** Ensure a path starts with exactly one `/api/` prefix. */
function ensureApiPrefix(path) {
  const p = `/${String(path || "").replace(/^\/+/, "")}`; // leading slash
  // Strip any leading "api/" then add one canonical "/api/"
  const noApi = p.replace(/^\/?api\/+/i, "/");
  return `/api${noApi}`;
}

/**
 * Build URLs for BACKEND **API** calls.
 * - Absolute URLs are returned as-is.
 * - Guarantees a single `/api/...` (prevents `/api/api`).
 * - Treats `/api/uploads/...` and `/api/files/...` as **public** (returns non-API path).
 * - Passes through `/uploads/...` or `/files/...` untouched.
 */
export function toBackendUrl(urlOrPath) {
  if (!urlOrPath) return "";
  const raw = String(urlOrPath).trim();

  // Already absolute? Return as-is.
  if (/^https?:\/\//i.test(raw)) return raw;

  // Normalize once for checks
  const noLeadSlash = raw.replace(/^\/+/, "");

  // 🔧 Treat legacy /api/uploads or /api/files as PUBLIC, not API
  if (/^api\/(?:uploads|files)\//i.test(noLeadSlash)) {
    const publicish = noLeadSlash.replace(/^(?:api\/)+/i, ""); // drop ALL leading api/
    const path = `/${publicish}`;
    return BASE ? joinUrl(BASE, path) : path;
  }

  // If the caller passes a public path, don't rewrite it into /api
  if (/^(?:uploads|files)\//i.test(noLeadSlash)) {
    const path = `/${noLeadSlash}`;
    return BASE ? joinUrl(BASE, path) : path;
  }

  // Normal API flow
  const apiPath = ensureApiPrefix(raw);
  const full = BASE ? joinUrl(BASE, apiPath) : apiPath;

  // Safety: collapse any accidental /api/api
  return full.replace(/\/api\/api(\/|$)/i, "/api$1");
}

/**
 * Build URLs for **PUBLIC FILES** (PDFs, images) served from /uploads.
 * Behavior:
 *  - Never prefixes `/api`.
 *  - Accepts:
 *      • absolute URLs → returned as-is
 *      • "filename.pdf" → /uploads/filename.pdf
 *      • "uploads/filename.pdf" → /uploads/filename.pdf
 *      • "/api/uploads/filename.pdf" or "/api/files/..." → normalized to /uploads/...
 *      • "/api/api/uploads/..." → normalized as well (strip ALL leading api/)
 */
export function toPublicUploadUrl(serverPathOrFilename) {
  if (!serverPathOrFilename) return "";

  // Absolute? Return as-is.
  if (/^https?:\/\//i.test(serverPathOrFilename)) return serverPathOrFilename;

  let clean = String(serverPathOrFilename).trim();

  // Remove any leading slashes for normalization
  clean = clean.replace(/^\/+/, "");

  // 🔧 Strip ALL leading "api/" prefixes (handles /api/uploads, /api/api/uploads, etc.)
  clean = clean.replace(/^(?:api\/)+/i, "");

  // Map "files/..." to "uploads/..." if backend used that alias previously
  if (/^files\//i.test(clean)) {
    clean = clean.replace(/^files\//i, "uploads/");
  }

  // If it already starts with uploads/, keep it; otherwise prepend
  if (!/^uploads\//i.test(clean)) {
    clean = `uploads/${clean}`;
  }

  const path = `/${clean}`;
  return BASE ? joinUrl(BASE, path) : path;
}

// (Optional) export BASE if you need it elsewhere
export { BASE };
