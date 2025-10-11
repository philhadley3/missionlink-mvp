// src/lib/api.js
export class HttpError extends Error {
  constructor(status, statusText, bodyText) {
    super(`${status} ${statusText}`);
    this.status = status;
    this.statusText = statusText;
    this.bodyText = bodyText;
  }
}

export const API_BASE = (import.meta.env.VITE_API_URL || "").trim();

// --- Diagnostics: force log in any build and expose a global ---------------
if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.log(
    "[env] MODE=", import.meta.env.MODE,
    "DEV=", import.meta.env.DEV,
    "VITE_API_URL=", import.meta.env.VITE_API_URL,
    "API_BASE=", API_BASE
  );
  window.__API_BASE = API_BASE;
}
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 🔹 Country helpers
// ---------------------------------------------------------------------------

function countryCodeToFlag(alpha2) {
  if (!alpha2 || alpha2.length !== 2) return "";
  const up = alpha2.toUpperCase();
  // Regional Indicator Symbols: A -> U+1F1E6
  return [...up].map(c => String.fromCodePoint(0x1f1e6 + (c.charCodeAt(0) - 65))).join("");
}

function normalizeCountry(c = {}) {
  const alpha2 =
    (c.alpha2 || c.iso2 || c.code || "").toString().trim().toUpperCase();
  const alpha3 =
    (c.alpha3 || c.iso3 || "").toString().trim().toUpperCase();
  const numeric =
    (c.numeric ?? c.numeric_code ?? "").toString().trim() || null;

  return {
    id: c.id ?? null,
    name: c.name || c.common_name || c.official_name || "",
    official_name: c.official_name || c.name || "",
    alpha2,
    alpha3,
    numeric,
    flag: c.flag || (alpha2 ? countryCodeToFlag(alpha2) : ""),
    alt_names: Array.isArray(c.alt_names) ? c.alt_names : [],
    // keep any extra fields if present
    ...(c.population !== undefined ? { population: c.population } : {}),
    ...(c.christian_percentage !== undefined
      ? { christian_percentage: c.christian_percentage }
      : {}),
  };
}

/**
 * Fetch list of all countries from the backend.
 * Always returns a normalized shape:
 *   { id, name, official_name, alpha2, alpha3, numeric, flag, alt_names? }
 */
export async function fetchCountries() {
  const raw = await api("/api/countries");
  return Array.isArray(raw) ? raw.map(normalizeCountry) : [];
}

// Expose in dev console for quick testing (keep at the BOTTOM)
if (typeof window !== "undefined") {
  window.__API_BASE = API_BASE;          // ensure present even if earlier block changes
  window.fetchCountries = fetchCountries; // expose helper globally
  // version ping so you can confirm the right bundle is live
  console.log("[api] fetchCountries exposed v2025-10-11d", { API_BASE });
}
