// src/lib/fileUrls.js
import { API_BASE as API_BASE_ENV } from "./api";

// Where your Flask backend lives (Render)
const RENDER_BACKEND = "https://missionlink-mvp.onrender.com";

/**
 * Resolve a safe "origin" base (no trailing slash, no trailing /api).
 * - Prod: take absolute from env and normalize.
 * - Vercel + missing/relative env: use absolute Render origin.
 * - Dev (localhost): return "" to use same-origin.
 */
function resolveBase() {
  let base = (API_BASE_ENV || "").trim();

  const isAbsolute = /^https?:\/\//i.test(base);
  const onVercel =
    typeof window !== "undefined" && /\.vercel\.app$/i.test(window.location.hostname);

  if (!base || (base && !isAbsolute)) {
    // If env missing/relative, prefer absolute Render in prod; same-origin in dev.
    return onVercel ? RENDER_BACKEND : "";
  }

  // Normalize: strip trailing slashes and trailing /api
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
 * - Passes through `/uploads/...` untouched (so you don't accidentally API-ify public files).
 */
export function toBackendUrl(urlOrPath) {
  if (!urlOrPath) return "";
  const raw = String(urlOrPath).trim();

  // Already absolute? Return as-is.
  if (/^https?:\/\//i.test(raw)) return raw;

  // If the caller passes a public path, don't rewrite it into /api
  if (/^\/?uploads\//i.test(raw) || /^\/?files\//i.test(raw)) {
    const path = `/${raw.replace(/^\/+/, "")}`;
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
 * - Never prefixes `/api`.
 * - Accepts:
 *    - absolute URLs → returned as-is
 *    - "filename.pdf" → /uploads/filename.pdf
 *    - "uploads/filename.pdf" → /uploads/filename.pdf
 *    - "/api/uploads/filename.pdf" or "/api/files/..." →*
