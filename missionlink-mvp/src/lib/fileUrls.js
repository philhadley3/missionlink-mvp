// src/lib/fileUrls.js
import { API_BASE as API_BASE_ENV } from "./api";

// If the env is missing but we're on Vercel, fall back to the Render backend.
const FALLBACK_BACKEND = "https://missionlink-mvp.onrender.com";

// Full backend origin for prod, or "" in dev
let API_BASE = (API_BASE_ENV || "").trim();
// Fallback if missing AND we’re clearly on a Vercel domain
if (!API_BASE && typeof window !== "undefined" && /\.vercel\.app$/i.test(window.location.hostname)) {
  API_BASE = FALLBACK_BACKEND;
}

export function toBackendUrl(url) {
  if (!url) return "";
  const raw = String(url).trim();

  // Already absolute? Return as-is.
  if (/^https?:\/\//i.test(raw)) return raw;

  // Normalize the path
  let path = raw.startsWith("/") ? raw : `/${raw}`;

  // Rewrite legacy paths to the new public route
  if (path.startsWith("/api/uploads/")) {
    path = "/api/files/" + path.slice("/api/uploads/".length);
  } else if (path.startsWith("/uploads/")) {
    path = "/api/files/" + path.slice("/uploads/".length);
  } else if (path.startsWith("/api/upload")) {
    path = path.replace("/api/upload", "/api/files");
  }

  // No base configured → same-origin
  if (!API_BASE) return path;

  // Absolute base: strip trailing "/" and any trailing "/api"
  if (/^https?:\/\//i.test(API_BASE)) {
    const origin = API_BASE.replace(/\/+$/, "").replace(/\/api$/i, "");
    // Final guard against accidental /api/api
    return (origin + path).replace(/\/api\/api(\/|$)/, "/api$1");
  }

  // Relative base (not recommended in prod)
  const basePath = API_BASE.startsWith("/") ? API_BASE : `/${API_BASE}`;
  if (path.startsWith(basePath + "/") || path === basePath) return path;
  if (basePath === "/api" && path.startsWith("/api/")) return path;
  return `${basePath}${path}`;
}
