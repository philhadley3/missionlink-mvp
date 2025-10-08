// src/pages/GlobeView.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import Globe from "react-globe.gl";
import { feature as topoFeature } from "topojson-client";
import countriesLib from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api";
import { toBackendUrl, toPublicUploadUrl } from "../lib/fileUrls";

countriesLib.registerLocale(enLocale);

// AnchorsForLife palette
const AFL_WATER = "#3673B7";
const AFL_LIGHT = "#F4F4F4";
const AFL_STROKE = "#808080";
const AFL_SKY = "#6699CC";

export default function GlobeView() {
  const globeEl = useRef();
  const { token } = useAuth();

  const [countries, setCountries] = useState([]);
  const [active, setActive] = useState(null); // { name, iso2, loading, error, missionaries, reports }
  const [hovered, setHovered] = useState(null);
  const [activeId, setActiveId] = useState(null);

  // Auth-aware token handling (refresh + retry once)
  const [authToken, setAuthToken] = useState(token);
  useEffect(() => setAuthToken(token), [token]);
  const refreshInFlight = useRef(null);

  async function refreshSessionOnce() {
    if (!refreshInFlight.current) {
      refreshInFlight.current = (async () => {
        const resp = await api("/api/auth/refresh", { method: "POST" });
        const newToken =
          resp && typeof resp === "object" && (resp.access_token || resp.token)
            ? (resp.access_token || resp.token)
            : null;
        if (newToken) setAuthToken(newToken);
        return newToken;
      })().finally(() => {
        refreshInFlight.current = null;
      });
    }
    return refreshInFlight.current;
  }

  async function callApi(path, opts = {}) {
    try {
      return await api(path, { ...opts, token: authToken });
    } catch (err) {
      if (err && [401, 403, 419].includes(err.status)) {
        const newTok = await refreshSessionOnce();
        return await api(path, { ...opts, token: newTok || authToken });
      }
      throw err;
    }
  }

  // Load lightweight TopoJSON and convert to GeoJSON
  useEffect(() => {
    fetch("/data/countries-110m.json")
      .then((r) => r.json())
      .then((topo) => {
        const geo = topoFeature(topo, topo.objects.countries);
        const feats = (geo.features || []).filter((f) => f && f.geometry);
        setCountries(feats);
      })
      .catch((e) => console.error("[Globe] TopoJSON load FAILED:", e));
  }, []);

  const polygonsData = useMemo(() => countries, [countries]);

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "default";
    return () => { document.body.style.cursor = "default"; };
  }, [hovered]);

  // Resolve ISO2 from TopoJSON feature id (numeric -> alpha-2)
  function getIso2FromFeature(feat) {
    const numeric = String(feat?.id ?? "").padStart(3, "0");
    const iso2 = countriesLib.numericToAlpha2(numeric) || null;
    if (!iso2) return null;
    const code = String(iso2).toUpperCase();
    if (code === "-99" || code === "XX" || code.length !== 2) return null;
    return code;
  }

  // ---------- Contact helpers ----------
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  function cleanUrl(u) {
    if (!u) return null;
    const s = String(u).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    return "https://" + s.replace(/^\/+/, "");
  }
  function urlLabel(u) {
    try {
      const parsed = new URL(cleanUrl(u));
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      return String(u || "")
        .replace(/^https?:\/\//i, "")
        .replace(/^www\./, "")
        .replace(/\/+$/, "");
    }
  }
  function deepFindEmail(obj, maxDepth = 6) {
    const seen = new WeakSet();
    let best = null;
    function visit(node, depth, keyHint = "") {
      if (node == null || depth > maxDepth) return;
      if (typeof node === "string") {
        const s = node.trim();
        if (EMAIL_RE.test(s)) {
          if (!best || keyHint.toLowerCase().includes("email")) best = s;
        }
        return;
      }
      if (typeof node !== "object") return;
      if (seen.has(node)) return;
      seen.add(node);
      if (Array.isArray(node)) return void node.forEach((v) => visit(v, depth + 1, keyHint));
      for (const k of Object.keys(node)) visit(node[k], depth + 1, k);
    }
    visit(obj, 0);
    return best;
  }
  function extractEmail(m) {
    const candidates = [
      m?.email, m?.contact_email, m?.preferred_email, m?.primary_email,
      m?.user?.email, m?.profile?.email, m?.missionary?.email,
      ...(Array.isArray(m?.emails) ? m.emails.map(e => (typeof e === "string" ? e : e?.address || e?.email)) : []),
    ];
    for (const v of candidates) if (typeof v === "string" && EMAIL_RE.test(v.trim())) return v.trim();
    return deepFindEmail(m);
  }
  function extractWebsite(m) {
    const candidates = [m?.website, m?.url, m?.link, m?.profile?.website, m?.missionary?.website];
    for (const v of candidates) if (typeof v === "string" && v.trim()) return cleanUrl(v);
    const stack = [m], seen = new WeakSet();
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
      seen.add(cur);
      for (const [k, v] of Object.entries(cur)) {
        if (typeof v === "string" && v.trim() && /site|url|link|web/i.test(k)) return cleanUrl(v);
        if (v && typeof v === "object") stack.push(v);
      }
    }
    return null;
  }
  // ------------------------------------

  // (Optional) detail hydration cache
  const [hydrating, setHydrating] = useState(false);
  const detailCacheRef = useRef(new Map());
  function getIds(m) {
    const missionaryId = m?.missionary_id ?? m?.id ?? m?.missionary?.id ?? null;
    const userId = m?.user_id ?? m?.user?.id ?? null;
    return { missionaryId: missionaryId != null ? String(missionaryId) : null, userId: userId != null ? String(userId) : null };
  }
  async function fetchContactDetail(m) {
    const { missionaryId, userId } = getIds(m);
    const cacheKey = missionaryId ? `m:${missionaryId}` : userId ? `u:${userId}` : null;
    if (cacheKey && detailCacheRef.current.has(cacheKey)) return detailCacheRef.current.get(cacheKey);
    let detail = null;
    try {
      if (missionaryId) detail = await callApi(`/api/missionaries/${missionaryId}`);
      else if (userId) detail = await callApi(`/api/users/${userId}`);
    } catch { /* ignore */ }
    if (cacheKey) detailCacheRef.current.set(cacheKey, detail);
    return detail;
  }

  const handleCountryClick = async (feat) => {
    const iso2 = getIso2FromFeature(feat);
    const name = iso2 ? countriesLib.getName(iso2, "en") : "Unknown";
    setActiveId(feat?.id ?? null);
    setActive({ name, iso2, loading: true, error: null, missionaries: [], reports: [] });

    if (!iso2) {
      setActive({ name, iso2: null, loading: false, error: "Unknown country code for this polygon.", missionaries: [], reports: [] });
      return;
    }

    try {
      const [missionsRes, reportsRes] = await Promise.allSettled([
        callApi(`/api/countries/${iso2}/missionaries`),
        callApi(`/api/countries/${iso2}/reports`)
      ]);

      let missionaries = [];
      if (missionsRes.status === "fulfilled") {
        const data = missionsRes.value;
        missionaries = Array.isArray(data) ? data : (data?.missionaries || []);
      }

      let reports = [];
      if (reportsRes.status === "fulfilled") {
        const data = reportsRes.value;
        reports = Array.isArray(data) ? data : (data?.reports || []);
      }

      setActive({ name, iso2, loading: false, error: null, missionaries, reports });
    } catch (e) {
      let msg = "Request failed.";
      if (e instanceof TypeError) {
        msg = "Network/CORS error. Verify API URL (VITE_API_URL), HTTPS, and CORS policy.";
      } else if (e?.status) {
        const body = (e.body || "").slice(0, 500);
        msg = `${e.status} ${e.message}${body ? ` — ${body}` : ""}`;
      } else if (e?.message) {
        msg = e.message;
      }
      setActive({ name, iso2, loading: false, error: msg, missionaries: [], reports: [] });
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 380px",
        gap: 0,
        height: "calc(100vh - 64px)",
        minHeight: 400
      }}
    >
      {/* Globe */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          zIndex: 1,
          position: "relative"
        }}
      >
        <Globe
          ref={globeEl}
          globeImageUrl="/textures/blue.png"
          backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
          rendererConfig={{ antialias: true, alpha: true }}
          width={undefined}
          height={undefined}
          polygonsData={polygonsData}
          polygonsTransitionDuration={0}
          polygonAltitude={(d) => (d === hovered || d?.id === activeId ? 0.02 : 0.01)}
          polygonCapColor={(d) =>
            d === hovered || d?.id === activeId
              ? "rgb(182, 152, 98)"
              : "rgba(244,244,244,0.80)"
          }
          polygonSideColor={() => "rgba(0,0,0,0.15)"}
          polygonStrokeColor={(d) => (d === hovered || d?.id === activeId ? AFL_STROKE : "#FFFFFF")}
          polygonStrokeWidth={2.0}
          onPolygonHover={setHovered}
          onPolygonClick={handleCountryClick}
        />
      </div>

      {/* Sidebar */}
      <aside
        className="card"
        style={{
          borderLeft: "1px solid var(--border)",
          borderRadius: 0,
          overflowY: "auto",
          background: "#fff",
          color: "#222",
          minWidth: 380,
          zIndex: 50,
          position: "relative",
          boxShadow: "-8px 0 24px rgba(0,0,0,.08)"
        }}
      >
        {!active && (
          <div>
            <h3 style={{ marginTop: 0 }}>Select a country</h3>
            <p className="muted">Click a country to view assigned missionaries.</p>
          </div>
        )}

        {active && (
          <div>
            <h3 style={{ marginTop: 0 }}>
              {active.name}{active.iso2 ? ` (${active.iso2})` : ""}
            </h3>

            {active.loading && <p className="muted">Loading missionaries…</p>}
            {active.error && <p style={{ color: "salmon" }}>{active.error}</p>}

            {!active.loading && !active.error && (
              <div style={{ display: "grid", gap: 8 }}>
                {hydrating && <p className="muted">Fetching contact details…</p>}

                {active.missionaries.length === 0 && (
                  <p className="muted">No missionaries found for this country.</p>
                )}

                {active.missionaries.map((m, idx) => {
                  const email = extractEmail(m);
                  const website = extractWebsite(m);
                  return (
                    <div
                      key={idx}
                      style={{ padding: 8, border: "1px solid var(--brand-border, var(--border))", borderRadius: "8px" }}
                    >
                      <div style={{ fontWeight: 600 }}>
                        {m.name || m.full_name || m.display_name || email || "Unnamed"}
                      </div>

                      <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
                        {email && (
                          <div className="text-sm">
                            <span className="muted">Email: </span>
                            <a href={`mailto:${email}`} style={{ color: "var(--brand-primary, #3673B6)" }}>
                              {email}
                            </a>
                          </div>
                        )}
                        {website && (
                          <div className="text-sm">
                            <span className="muted">Website: </span>
                            <a
                              href={website}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "var(--brand-primary, #3673B6)" }}
                            >
                              {urlLabel(website)}
                            </a>
                          </div>
                        )}
                        {m.organization && <div className="muted text-sm">{m.organization}</div>}
                      </div>
                    </div>
                  );
                })}

                {/* -------- Recent reports -------- */}
                <hr style={{ margin: "12px 0", borderColor: "var(--border)" }} />
                <h4 style={{ margin: "4px 0 8px", fontWeight: 600 }}>Recent reports</h4>

                {(!active.reports || active.reports.length === 0) ? (
                  <p className="muted">No reports found for this country.</p>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {(active.reports || []).slice(0, 6).map((r, idx) => {
                      const created = r.created_at ? new Date(r.created_at).toLocaleString() : "";
                      return (
                        <div
                          key={r.id || idx}
                          style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              justifyContent: "space-between",
                              gap: 8,
                            }}
                          >
                            <div style={{ fontWeight: 600, lineHeight: 1.2 }}>
                              {r.title || "Report"}
                            </div>
                            {created && <div className="muted" style={{ fontSize: 12 }}>{created}</div>}
                          </div>

                          {r.missionary && (
                            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                              by {r.missionary}
                            </div>
                          )}

                          {r.content && (
                            <div style={{ fontSize: 13, marginTop: 6 }} className="muted">
                              {r.content.length > 180 ? r.content.slice(0, 180) + "…" : r.content}
                            </div>
                          )}

                          {/* PDF attachment — PUBLIC link (never /api) */}
                          {(() => {
                            const pdfCandidate =
                              r.file_url ||
                              r.file_path ||
                              r.file ||
                              r.pdf_path ||
                              r.pdf;
                            const href = toPublicUploadUrl(pdfCandidate);
                            return href ? (
                              <div style={{ marginTop: 8 }}>
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm"
                                  style={{ color: "var(--brand-primary, #3673B6)", textDecoration: "underline" }}
                                >
                                  {r.file_name || r.title || "Open PDF"}
                                </a>
                                {r.file_mime && (
                                  <div className="muted" style={{ fontSize: 12 }}>{r.file_mime}</div>
                                )}
                              </div>
                            ) : null;
                          })()}

                          {/* Thumbnails — also public */}
                          {Array.isArray(r.images) && r.images.length > 0 && (
                            <div style={{ display: "flex", gap: 6, marginTop: 8, overflowX: "auto" }}>
                              {r.images.slice(0, 4).map((img, i) => {
                                const imgHref = toPublicUploadUrl(
                                  img?.url || img?.path || img?.src || img?.file
                                );
                                return (
                                  <img
                                    key={img.id || i}
                                    src={imgHref}
                                    alt="report"
                                    style={{
                                      width: 72,
                                      height: 56,
                                      objectFit: "cover",
                                      borderRadius: 6,
                                      border: "1px solid var(--border)",
                                    }}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
