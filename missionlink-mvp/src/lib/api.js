// src/lib/api.js
export class HttpError extends Error {
  constructor(status, statusText, bodyText) {
    super(`${status} ${statusText}`);
    this.status = status;
    this.statusText = statusText;
    this.bodyText = bodyText;
  }
}

export const API_BASE = import.meta.env.VITE_API_URL || "";


// Join base + path safely; keep absolute URLs untouched
function joinUrl(base, path) {
  if (/^https?:\/\//i.test(path)) return path;
  const b = (base || "").replace(/\/+$/, "");
  const p = path || "";

  // If both end/start with /api, drop one to avoid /api/api/…
  if (b.endsWith("/api") && p.startsWith("/api")) {
    return b + p.replace(/^\/api/, "");
  }

  if (!b) return p; // relative path (same-origin)
  return p.startsWith("/") ? b + p : `${b}/${p}`;
}

// Usage: api("/api/me/profile", { method: "PUT", body: {...}, token });
export async function api(
  path,
  { method = "GET", body, token, isForm = false, headers = {}, credentials = "include" } = {}
) {
  const url = joinUrl(API_BASE, path);

  // Only set JSON header when not sending FormData
  const defaultHeaders = {};
  if (!isForm) defaultHeaders["Content-Type"] = "application/json";
  if (token) defaultHeaders["Authorization"] = `Bearer ${token}`;

  const init = {
    method,
    credentials,
    headers: { ...defaultHeaders, ...headers },
  };

  if (body !== undefined) {
    init.body = isForm
      ? body // FormData; let the browser set Content-Type boundary
      : typeof body === "string"
        ? body
        : JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const ct = res.headers.get("content-type") || "";
  const isJSON = ct.includes("application/json");
  const data = isJSON ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const txt = isJSON ? JSON.stringify(data) : (data || "");
    throw new HttpError(res.status, res.statusText, txt);
  }

  return data;
}
