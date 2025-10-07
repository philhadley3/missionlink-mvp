// src/lib/fileUrls.js
import { API_BASE as API_BASE_ENV } from "./api";

// Full backend origin for prod (e.g., https://missionlink-mvp.onrender.com) or "" in dev
const API_BASE = (API_BASE_ENV || "").trim();

export function toBackendUrl(url) {
  if (!url) return "";
  const raw = String(url).trim();

  // If it's already absolute, just return it
  if (/^https?:\/\//i.test(raw)) return raw;

  // Normalize path
  let path = raw.startsWith("/") ? raw : `/${raw}`;

  // Rewrite legacy paths to the new public route
  if (path.startsWith("/api/uploads/")) {
    path = "/api/files/" + path.slice("/api/uploads/".length);
  } else if (path.startsWith("/uploads/")) {
    path = "/api/files/" + path.slice("/uploads/".length);
  } else if (path.startsWith("/api/upload")) {
    path = path.replace("/api/upload", "/api/files");
  }

  // No API base configured → same-origin relative path is fine
  if (!API_BASE) return path;

  // Absolute base (recommended on Vercel). Strip trailing "/" and any trailing "/api"
  if (/^https?:\/\//i.test(API_BASE)) {
    const origin = API_BASE.replace(/\/+$/, "").replace(/\/api$/i, "");
    // Final guard against accidental double "/api"
    return (origin + path).replace(/\/api\/api(\/|$)/, "/api$1");
  }

  // Relative base (e.g., "/api"). Avoid double "/api"
  const basePath = API_BASE.startsWith("/") ? API_BASE : `/${API_BASE}`;
  if (path.startsWith(basePath + "/") || path === basePath) return path;
  if (basePath === "/api" && path.startsWith("/api/")) return path;
  return `${basePath}${path}`;
}
