// src/pages/GlobeView.jsx
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Globe from "react-globe.gl";
import { feature as topoFeature } from "topojson-client";
import countriesLib from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { geoCentroid } from "d3-geo";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api";
import { toPublicUploadUrl } from "../lib/fileUrls";
import * as THREE from "three";

countriesLib.registerLocale(enLocale);

const AFL_STROKE = "#808080";
const EARTH_BUMP = "https://unpkg.com/three-globe/example/img/earth-topology.png";

export default function GlobeView() {
  const globeEl = useRef();
  const { token } = useAuth();

  // Polygons (110m for perf)
  const [allPolygons, setAllPolygons] = useState([]);
  // Backend authoritative list
  const [backendCountries, setBackendCountries] = useState([]);
  // Filtered polygons we render (backend ∩ available)
  const [countries, setCountries] = useState([]);
  // Territories/microstates rendered as POINTS (for ones missing in 110m)
  const [territoryPoints, setTerritoryPoints] = useState([]);

  const [active, setActive] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState("");

  // Auth helper
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
      })().finally(() => (refreshInFlight.current = null));
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

  // ---------- LOAD DATA ----------

  // Fast 110m polygons (Natural Earth via world-atlas 110m)
  useEffect(() => {
    fetch("/data/countries-110m.json")
      .then((r) => r.json())
      .then((topo) => {
        const geo = topoFeature(topo, topo.objects.countries);
        const feats = (geo.features || []).filter((f) => f && f.geometry);
        setAllPolygons(patchSomalia(feats));
      })
      .catch((e) => console.error("[Globe] TopoJSON (110m) load FAILED:", e));
  }, []);

  // Backend list
  useEffect(() => {
    (async () => {
      try {
        const data = await callApi("/api/countries");
        const list = Array.isArray(data) ? data : (data?.countries || []);
        setBackendCountries(list.filter(Boolean));
      } catch (e) {
        console.error("[Globe] Failed to load backend countries:", e);
        setBackendCountries([]);
      }
    })();
  }, []);

  // ISO helpers
  function getIso2FromFeature(feat) {
    // honor forced overrides first
    const forced = feat?.properties?.__forceISO2;
    if (forced && /^[A-Z]{2}$/.test(forced)) return forced;

    const numeric = String(feat?.id ?? "").padStart(3, "0");
    const iso2 = countriesLib.numericToAlpha2(numeric) || null;
    if (!iso2) return null;
    const code = String(iso2).toUpperCase();
    if (code === "-99" || code === "XX" || code.length !== 2) return null;
    return code;
  }

  // ---------- RECONCILE + POINTS FOR MISSING ----------

  // Small static lat/lng for territories/microstates commonly missing in 110m
  const TERRITORY_LATLNG = useMemo(
    () => ({
      AX: [60.2, 20.0], AS: [-14.3, -170.7], AI: [18.22, -63.05], AG: [17.05, -61.8],
      AW: [12.52, -69.98], BB: [13.19, -59.54], BM: [32.30, -64.78], BQ: [12.2, -68.26],
      BV: [-54.42, 3.36], IO: [-7.3, 72.4], KY: [19.31, -81.25], CX: [-10.5, 105.67],
      CC: [-12.17, 96.83], KM: [-11.7, 43.26], CK: [-21.21, -159.78], CW: [12.17, -69.0],
      DM: [15.41, -61.37], FO: [62.0, -6.8], GF: [3.93, -53.12], PF: [-17.68, -149.4],
      GI: [36.14, -5.35], GD: [12.11, -61.68], GP: [16.27, -61.55], GU: [13.44, 144.79],
      GG: [49.46, -2.58], HM: [-53.1, 73.5], VA: [41.90, 12.45], HK: [22.32, 114.17],
      IM: [54.23, -4.55], JE: [49.21, -2.13], KI: [1.87, -157.36], LI: [47.17, 9.55],
      MO: [22.20, 113.54], MV: [3.2, 73.22], MT: [35.89, 14.5], MH: [7.13, 171.06],
      MQ: [14.64, -61.02], MU: [-20.16, 57.50], YT: [-12.83, 45.17], FM: [6.9, 158.18],
      MC: [43.74, 7.42], MS: [16.75, -62.2], NR: [-0.52, 166.93], NU: [-19.05, -169.87],
      NF: [-29.03, 167.95], MP: [15.2, 145.75], PW: [7.5, 134.62], PN: [-24.7, -127.4],
      RE: [-21.12, 55.53], BL: [17.90, -62.83], SH: [-15.96, -5.71], KN: [17.35, -62.78],
      LC: [13.91, -60.98], MF: [18.08, -63.06], PM: [46.95, -56.33], VC: [13.25, -61.20],
      WS: [-13.76, -172.10], SM: [43.94, 12.46], ST: [0.20, 6.73], SC: [-4.66, 55.45],
      SG: [1.29, 103.85], SX: [18.04, -63.11], GS: [-54.5, -37.0], SJ: [78.0, 20.0],
      TK: [-9.2, -171.85], TO: [-21.14, -175.2], TC: [21.75, -71.58], TV: [-7.11, 177.65],
      VG: [18.42, -64.62], VI: [18.34, -64.93], WF: [-13.3, -176.2],
      CV: [15.11, -23.62] // Cabo Verde (if missing in your tileset)
    }),
    []
  );

  useEffect(() => {
    if (!allPolygons.length) return;

    const availableIso = new Set(
      allPolygons.map((f) => getIso2FromFeature(f)).filter(Boolean)
    );

    const backendIso = backendCountries
      .map((c) =>
        (c?.iso2 || c?.ISO2 || c?.code || c?.iso || "")
          .toString()
          .trim()
          .toUpperCase()
      )
      .filter((c) => /^[A-Z]{2}$/.test(c));

    // Polygons we can render
    const isoSet = new Set(backendIso.filter((c) => availableIso.has(c)));
    const filtered = allPolygons.filter((f) => {
      const iso2 = getIso2FromFeature(f);
      return iso2 && isoSet.has(iso2);
    });
    setCountries(filtered);

    // Territories to cover as points
    const missing = backendIso.filter((c) => !availableIso.has(c) && TERRITORY_LATLNG[c]);
    const pts = missing.map((iso2) => {
      const [lat, lng] = TERRITORY_LATLNG[iso2];
      return {
        lat,
        lng,
        iso2,
        name: countriesLib.getName(iso2, "en") || iso2
      };
    });
    setTerritoryPoints(pts);
  }, [allPolygons, backendCountries, TERRITORY_LATLNG]);

  const polygonsData = useMemo(() => countries, [countries]);

  // Cursor
  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "default";
    return () => (document.body.style.cursor = "default");
  }, [hovered]);

  // Subtle terrain depth
  useEffect(() => {
    if (!globeEl.current) return;
    const material = globeEl.current.globeMaterial && globeEl.current.globeMaterial();
    if (material) material.bumpScale = 10;
  }, []);

  // ---------- Search helpers ----------

  const idToFeature = useMemo(() => {
    const m = new Map();
    for (const f of polygonsData || []) {
      const id = String(f?.id ?? "").padStart(3, "0");
      if (id && id !== "-99") m.set(id, f);
    }
    return m;
  }, [polygonsData]);

  const nameToIso2 = useMemo(() => {
    const map = new Map();
    // prefer backend names
    for (const c of backendCountries) {
      const iso = (c?.iso2 || c?.ISO2 || c?.code || c?.iso || "").toString().trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(iso)) continue;
      const names = [
        c?.name, c?.official_name, c?.short_name, c?.common_name,
        ...(Array.isArray(c?.aliases) ? c.aliases : []),
      ].filter(Boolean).map((s) => s.toString().trim()).filter((s) => s.length > 0);
      names.forEach((n) => map.set(n.toLowerCase(), iso));
    }
    // fallback to lib names for visible polygons
    const libNames = countriesLib.getNames("en", { select: "official" }) || {};
    const visibleIso = new Set((countries || []).map((f) => getIso2FromFeature(f)).filter(Boolean));
    for (const [iso, n] of Object.entries(libNames)) {
      const ISO = iso.toUpperCase();
      if (visibleIso.has(ISO)) map.set(n.toLowerCase(), ISO);
    }
    // Add all point-territories to search too
    for (const p of territoryPoints) map.set(p.name.toLowerCase(), p.iso2);
    return map;
  }, [backendCountries, countries, territoryPoints]);

  const countryNames = useMemo(() => {
    const names = new Set();
    for (const [n] of nameToIso2) names.add(n);
    return [...names].map((n) => n.replace(/\b\w/g, (c) => c.toUpperCase()));
  }, [nameToIso2]);

  // ---------- UI interactions ----------

  const lastHoverTsRef = useRef(0);
  const onHover = useCallback((d) => {
    const now = performance.now();
    if (now - lastHoverTsRef.current < 50) return;
    lastHoverTsRef.current = now;
    setHovered((prev) => (prev === d ? prev : d || null));
  }, []);

  const hoveredId = hovered?.id ?? null;
  const polyAltitude = useCallback(
    (d) => (d?.id === hoveredId || d?.id === activeId ? 0.03 : 0.01),
    [hoveredId, activeId]
  );
  const polyCapColor = useCallback(
    (d) => (d?.id === hoveredId || d?.id === activeId ? "rgb(182, 152, 98)" : "rgba(227,221,211,1)"),
    [hoveredId, activeId]
  );
  const polyStrokeColor = useCallback(
    (d) => (d?.id === hoveredId || d?.id === activeId ? AFL_STROKE : "#000000"),
    [hoveredId, activeId]
  );

  const flyToFeature = useCallback((feature) => {
    if (!feature) return;
    try {
      const [lng, lat] = geoCentroid(feature);
      globeEl.current?.pointOfView({ lat, lng, altitude: 1.5 }, 800);
    } catch {}
  }, []);

  const handlePolygonClick = useCallback((f) => {
    flyToFeature(f);
    handleCountryClick(f);
  }, [flyToFeature]);

  const selectByName = useCallback((raw) => {
    if (!raw) return;
    const name = raw.trim().toLowerCase();
    let iso2 = nameToIso2.get(name) || null;
    if (!iso2) {
      for (const [n, i] of nameToIso2.entries()) {
        if (n.includes(name)) { iso2 = i; break; }
      }
    }
    if (!iso2 && raw.length <= 3) {
      const maybeIso = raw.toUpperCase();
      if (/^[A-Z]{2}$/.test(maybeIso)) iso2 = maybeIso;
    }

    // Try polygon first
    if (iso2) {
      const numeric = countriesLib.alpha2ToNumeric(iso2);
      const id = String(numeric || "").padStart(3, "0");
      const feat = idToFeature.get(id) || null;
      if (feat) {
        flyToFeature(feat);
        handleCountryClick(feat);
        return;
      }
      // Fallback to point territory
      const pt = territoryPoints.find((p) => p.iso2 === iso2);
      if (pt) {
        globeEl.current?.pointOfView({ lat: pt.lat, lng: pt.lng, altitude: 1.5 }, 800);
        handlePointClick(pt);
      }
    }
  }, [nameToIso2, idToFeature, territoryPoints, flyToFeature]);

  async function handleCountryClick(feat) {
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
      const missionaries = missionsRes.status === "fulfilled"
        ? (Array.isArray(missionsRes.value) ? missionsRes.value : (missionsRes.value?.missionaries || [])) : [];
      const reports = reportsRes.status === "fulfilled"
        ? (Array.isArray(reportsRes.value) ? reportsRes.value : (reportsRes.value?.reports || [])) : [];
      setActive({ name, iso2, loading: false, error: null, missionaries, reports });
    } catch (e) {
      setActive({ name, iso2, loading: false, error: e?.message || "Request failed.", missionaries: [], reports: [] });
    }
  }

  async function handlePointClick(pt) {
    const iso2 = pt.iso2;
    const name = pt.name || iso2;
    setActiveId(null);
    setActive({ name, iso2, loading: true, error: null, missionaries: [], reports: [] });
    try {
      const [missionsRes, reportsRes] = await Promise.allSettled([
        callApi(`/api/countries/${iso2}/missionaries`),
        callApi(`/api/countries/${iso2}/reports`)
      ]);
      const missionaries = missionsRes.status === "fulfilled"
        ? (Array.isArray(missionsRes.value) ? missionsRes.value : (missionsRes.value?.missionaries || [])) : [];
      const reports = reportsRes.status === "fulfilled"
        ? (Array.isArray(reportsRes.value) ? reportsRes.value : (reportsRes.value?.reports || [])) : [];
      setActive({ name, iso2, loading: false, error: null, missionaries, reports });
    } catch (e) {
      setActive({ name, iso2, loading: false, error: e?.message || "Request failed.", missionaries: [], reports: [] });
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-white">
      {/* Search overlay */}
      <div className="pointer-events-none absolute top-4 left-0 right-0 md:right-[380px] z-50">
        <div className="flex justify-center">
          <form
            className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 shadow-md backdrop-blur"
            onSubmit={(e) => { e.preventDefault(); selectByName(query); }}
          >
            <input
              type="text"
              list="country-list"
              inputMode="search"
              placeholder="Search country…"
              className="w-72 bg-transparent outline-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") selectByName(query); }}
              aria-label="Search country by name"
            />
            <button type="submit" className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50">Go</button>
            <datalist id="country-list">
              {countryNames.map((n, idx) => (<option key={`${idx}-${n}`} value={n} />))}
            </datalist>
          </form>
        </div>
      </div>

      {/* Globe */}
      <div className="h-[calc(100vh-4rem)] md:pr-[380px] overflow-hidden">
        <div className="w-full h-full flex items-center justify-center relative z-10">
          <Globe
            ref={globeEl}
            globeImageUrl={null}
            bumpImageUrl={EARTH_BUMP}
            backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
            globeMaterial={new THREE.MeshPhongMaterial({
                            color: 0x3672b7,      // adjust color
                            transparent: false,
                            opacity: 1.0,
                            depthWrite: true,
                          })}
            rendererConfig={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            width={undefined}
            height={undefined}
            polygonsData={polygonsData}
            polygonGeoJsonGeometry="geometry"
            polygonsTransitionDuration={0}
            animateIn={false}
            showAtmosphere={false}
            polygonAltitude={polyAltitude}
            polygonCapColor={polyCapColor}
            polygonSideColor={() => "rgba(0,0,0,0.25)"}  // slightly cheaper
            polygonStrokeColor={polyStrokeColor}
            polygonStrokeWidth={0.2}
            onPolygonHover={onHover}
            onPolygonClick={handlePolygonClick}
            // ---- POINT LAYER for territories ----
            pointsData={territoryPoints}
            pointLat={(p) => p.lat}
            pointLng={(p) => p.lng}
            pointAltitude={() => 0.02}
            pointRadius={() => 0.12}
            pointLabel={(p) => `${p.name} (${p.iso2})`}
            pointColor={() => "rgb(182, 152, 98)"} // gold-ish like hovered caps
            onPointClick={handlePointClick}
          />
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className="
          fixed top-16 right-0 z-20
          w-full md:w-[380px]
          h-[calc(100vh-4rem)]
          overflow-y-auto bg-white
          shadow-lg
        "
        style={{ borderLeft: "1px solid var(--border)", color: "#222", boxShadow: "-8px 0 24px rgba(0,0,0,.08)" }}
      >
        <div className="p-4 md:p-5">
          {!active && (
            <div>
              <h3 style={{ marginTop: 0 }}>Select a country</h3>
              <p className="muted">Click a country or use the search to view assigned missionaries.</p>
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
                  {active.missionaries.length === 0 && (
                    <p className="muted">No missionaries found for this country.</p>
                  )}

                  {active.missionaries.map((m, idx) => {
                    const email = extractEmail(m);
                    const website = (() => {
                      const candidates = [
                        m?.website, m?.site, m?.url, m?.homepage, m?.home_page, m?.web,
                        m?.organization_website, m?.org?.website, m?.profile?.website,
                        ...(Array.isArray(m?.links) ? m.links : []),
                        ...(Array.isArray(m?.websites) ? m.websites : []),
                      ];
                      for (const v of candidates) {
                        if (!v) continue;
                        const s = typeof v === "string" ? v : (v?.url || v?.href || v?.link);
                        if (!s) continue;
                        const u = cleanUrl(s);
                        try { if (u && new URL(u).hostname) return u; } catch {}
                      }
                      return null;
                    })();
                    return (
                      <div key={idx} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: "8px" }}>
                        <div style={{ fontWeight: 600 }}>
                          {m.name || m.full_name || m.display_name || email || "Unnamed"}
                        </div>
                        <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
                          {email && (
                            <div className="text-sm">
                              <span className="muted">Email: </span>
                              <a href={`mailto:${email}`} style={{ color: "var(--brand-primary, #3673B6)" }}>{email}</a>
                            </div>
                          )}
                          {!!website && (
                            <div className="text-sm">
                              <span className="muted">Website: </span>
                              <a href={website} target="_blank" rel="noreferrer" style={{ color: "var(--brand-primary, #3673B6)" }}>
                                {urlLabel(website)}
                              </a>
                            </div>
                          )}
                          {m.organization && <div className="muted text-sm">{m.organization}</div>}
                        </div>
                      </div>
                    );
                  })}

                  <hr style={{ margin: "12px 0", borderColor: "var(--border)" }} />
                  <h4 style={{ margin: "4px 0 8px", fontWeight: 600 }}>Recent reports</h4>

                  {(!active.reports || active.reports.length === 0) ? (
                    <p className="muted">No reports found for this country.</p>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {(active.reports || []).slice(0, 6).map((r, idx) => {
                        const created = r.created_at ? new Date(r.created_at).toLocaleString() : "";
                        return (
                          <div key={r.id || idx} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }}>
                            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                              <div style={{ fontWeight: 600, lineHeight: 1.2 }}>{r.title || "Report"}</div>
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
                            {r.file_url && (
                              <div style={{ marginTop: 8 }}>
                                <a
                                  href={toPublicUploadUrl(r.file_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm"
                                  style={{ color: "var(--brand-primary, #3673B6)", textDecoration: "underline" }}
                                >
                                  {r.file_name || r.title || "Open PDF"}
                                </a>
                                {r.file_mime && <div className="muted" style={{ fontSize: 12 }}>{r.file_mime}</div>}
                              </div>
                            )}
                            {Array.isArray(r.images) && r.images.length > 0 && (
                              <div style={{ display: "flex", gap: 6, marginTop: 8, overflowX: "auto" }}>
                                {r.images.slice(0, 4).map((img, i) => {
                                  const imgHref = toPublicUploadUrl(img?.url || img?.path || img?.src || img?.file);
                                  return (
                                    <img
                                      key={img.id || i}
                                      src={imgHref}
                                      alt="report"
                                      style={{ width: 72, height: 56, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }}
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
        </div>
      </aside>
    </div>
  );

  // -------- helpers (email/website) --------
  function extractEmail(m) {
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
    const candidates = [
      m?.email, m?.contact_email, m?.preferred_email, m?.primary_email,
      m?.user?.email, m?.profile?.email, m?.missionary?.email,
      ...(Array.isArray(m?.emails) ? m.emails.map(e => (typeof e === "string" ? e : e?.address || e?.email)) : []),
    ];
    for (const v of candidates) if (typeof v === "string" && EMAIL_RE.test(v.trim())) return v.trim();
    return null;
  }
  function cleanUrl(u) {
    if (!u) return null;
    const s = String(u).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    return "https://" + s.replace(/^\/+/, "");
  }
  function urlLabel(u) {
    try { return new URL(cleanUrl(u)).hostname.replace(/^www\./, ""); }
    catch { return String(u || "").replace(/^https?:\/\//i, "").replace(/^www\./, "").replace(/\/+$/, ""); }
  }

  // --------- SOMALIA PATCH ----------
  // Some 110m builds split Somaliland as an ISO-less polygon. We tag those as SO.
  function patchSomalia(features) {
    // Rough bbox for Somaliland: lat 8..12.5 N, lng 42..49.8 E
    const LAT_MIN = 8.0, LAT_MAX = 12.5, LNG_MIN = 42.0, LNG_MAX = 49.8;

    return features.map((f) => {
      const iso2 = (() => {
        const numeric = String(f?.id ?? "").padStart(3, "0");
        const alpha2 = countriesLib.numericToAlpha2(numeric) || null;
        return alpha2 ? alpha2.toUpperCase() : null;
      })();

      // Already Somalia — leave as is
      if (iso2 === "SO") return f;

      // Only consider features with no ISO2 and centroid inside bbox
      if (!iso2) {
        try {
          const [lng, lat] = geoCentroid(f);
          if (
            lat >= LAT_MIN && lat <= LAT_MAX &&
            lng >= LNG_MIN && lng <= LNG_MAX
          ) {
            const props = { ...(f.properties || {}), __forceISO2: "SO" };
            return { ...f, properties: props };
          }
        } catch { /* ignore */ }
      }
      return f;
    });
  }
}

  function extractWebsite(m) {
    const candidates = [
      m?.website, m?.site, m?.url, m?.homepage, m?.home_page, m?.web,
      m?.organization_website, m?.org?.website, m?.profile?.website,
      ...(Array.isArray(m?.links) ? m.links : []),
      ...(Array.isArray(m?.websites) ? m.websites : []),
    ];
    for (const v of candidates) {
      if (!v) continue;
      const u = cleanUrl(typeof v === "string" ? v : (v?.url || v?.href || v?.link));
      try {
        if (u && new URL(u).hostname) return u;
      } catch { /* ignore */ }
    }
    return null;
  }

