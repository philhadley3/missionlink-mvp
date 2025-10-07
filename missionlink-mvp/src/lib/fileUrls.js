// src/lib/fileUrls.js
import { API_BASE as API_BASE_ENV } from "./api";
const API_BASE = API_BASE_ENV || "";

export function toBackendUrl(url) {
  if (!url) return "";
  const s = String(url);
  if (/^https?:\/\//i.test(s)) return s;
  let path = s.startsWith("/") ? s : `/${s}`;
  if (path.startsWith("/api/uploads/")) {
    path = "/api/files/" + path.slice("/api/uploads/".length);
  } else if (path.startsWith("/uploads/")) {
    path = "/api/files/" + path.slice("/uploads/".length);
  } else if (path.startsWith("/api/upload")) {
    path = path.replace("/api/upload", "/api/files");
  }
  return API_BASE ? `${API_BASE}${path}` : path;
}
