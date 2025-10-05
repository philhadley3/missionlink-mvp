import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Upload, X, Image as ImageIcon, FileText, Globe2, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext.jsx";
import countriesLib from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
countriesLib.registerLocale(enLocale);

/**
 * Missionary Dashboard – API-backed version
 */

// --- Utilities ---------------------------------------------------------------
const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Angola","Argentina","Armenia","Australia","Austria","Azerbaijan",
  "Bangladesh","Belarus","Belgium","Benin","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Bulgaria",
  "Cambodia","Cameroon","Canada","Chile","China","Colombia","Congo","Costa Rica","Croatia","Cuba","Cyprus","Czechia",
  "Denmark","Dominican Republic","Ecuador","Egypt","El Salvador","Estonia","Ethiopia",
  "Finland","France","Gabon","Georgia","Germany","Ghana","Greece","Guatemala",
  "Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy",
  "Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kuwait","Kyrgyzstan",
  "Laos","Latvia","Lebanon","Liberia","Libya","Lithuania","Luxembourg",
  "Madagascar","Malawi","Malaysia","Mali","Mexico","Moldova","Mongolia","Montenegro","Morocco","Mozambique",
  "Namibia","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Macedonia","Norway",
  "Pakistan","Panama","Paraguay","Peru","Philippines","Poland","Portugal","Qatar",
  "Romania","Russia","Rwanda","Saudi Arabia","Senegal","Serbia","Sierra Leone","Singapore","Slovakia","Slovenia","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Sweden","Switzerland","Syria",
  "Taiwan","Tajikistan","Tanzania","Thailand","Togo","Tunisia","Turkey","Turkmenistan","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Venezuela","Vietnam","Zambia","Zimbabwe",
];

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl) {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

class HttpError extends Error {
  constructor(status, statusText, bodyText) {
    super(`${status} ${statusText}`);
    this.status = status;
    this.body = bodyText;
  }
}

async function api(path, { method = "GET", body, token, isForm = false } = {}) {
  const base = import.meta.env.VITE_API_URL || "";
  const headers = isForm ? {} : { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(base + path, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  const ct = res.headers.get("content-type") || "";
  const isJSON = ct.includes("application/json");

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new HttpError(res.status, res.statusText, txt);
  }

  return isJSON ? res.json() : res.text();
}

// --- UI bits -----------------------------------------------------------------
function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-xl bg-muted">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="text-lg font-semibold leading-tight">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

function ProfileCard({ profile, onChange, onSave, saving, canSave }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(profile.avatarUrl || "");
  useEffect(() => setPreview(profile.avatarUrl || ""), [profile.avatarUrl]);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SectionHeader icon={User} title="Personal Information" description="Update your public profile details." />
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-20 w-20 ring-2 ring-muted">
              {preview ? <AvatarImage src={preview} alt="avatar" /> : <AvatarFallback>YOU</AvatarFallback>}
            </Avatar>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" /> Upload
              </Button>
              {preview && (
                <Button variant="ghost" size="sm" onClick={() => { onChange({ ...profile, avatarUrl: "" }); setPreview(""); }}>
                  <X className="w-4 h-4 mr-2" /> Remove
                </Button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const dataUrl = await fileToDataUrl(file);
                onChange({ ...profile, avatarUrl: dataUrl });
                setPreview(dataUrl);
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Jane Missionary"
                value={profile.name}
                onChange={(e) => onChange({ ...profile, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="jane@example.org"
                value={profile.email}
                onChange={(e) => onChange({ ...profile, email: e.target.value })}
              />
            </div>

            {/* Website (optional) */}
            <div className="sm:col-span-2">
              <Label htmlFor="website">
                Website <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="website"
                type="url"
                placeholder="https://example.org"
                value={profile.website || ""}
                onChange={(e) => onChange({ ...profile, website: e.target.value })}
              />
            </div>

            {/* Bio (optional) */}
            <div className="sm:col-span-2">
              <Label htmlFor="bio">
                Bio <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="bio"
                rows={5}
                placeholder="A short bio to help supporters know you better…"
                value={profile.bio || ""}
                onChange={(e) => onChange({ ...profile, bio: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Button
            type="button"
            className="btn"
            disabled={!canSave || saving}
            aria-disabled={!canSave || saving}
            onClick={() => {
              if (!canSave || saving) return;
              console.log("[Profile] save");
              onSave();
            }}
          >
            {saving ? "Saving…" : "Save Profile"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CountriesCard({ countries, onChange, onSave, saving, canSave }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => COUNTRIES.filter(c => c.toLowerCase().includes(query.toLowerCase())).slice(0, 12),
    [query]
  );

  function addCountry(name) {
    if (!countries.includes(name)) onChange([...countries, name]);
    setQuery("");
  }

  function removeCountry(name) {
    onChange(countries.filter(c => c !== name));
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Countries Served</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SectionHeader icon={Globe2} title="Select countries" description="Choose one or more countries where you serve." />
        <div className="space-y-3">
          <div className="relative">
            <Input
              placeholder="Search countries to add…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <div className="absolute z-20 mt-1 w-full rounded-xl border bg-popover p-2 shadow">
                {filtered.length === 0 && (
                  <div className="px-2 py-1 text-sm text-muted-foreground">No matches</div>
                )}
                {filtered.map((name) => (
                  <Button key={name} variant="ghost" className="w-full justify-start" onClick={() => addCountry(name)}>
                    <Plus className="w-4 h-4 mr-2" /> {name}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {countries.length === 0 && (
              <p className="text-sm text-muted-foreground">No countries selected yet.</p>
            )}
            {countries.map((name) => (
              <Badge key={name} variant="secondary" className="px-3 py-1 text-sm flex items-center gap-2">
                {name}
                <button className="inline-flex" onClick={() => removeCountry(name)}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <Button
            type="button"
            className="btn"
            disabled={!canSave || saving}
            aria-disabled={!canSave || saving}
            onClick={() => {
              if (!canSave || saving) return;
              console.log("[Countries] save");
              onSave();
            }}
          >
            {saving ? "Saving…" : "Save Countries"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportsCard({ countries, reports, onAddReport, onDeleteReport, creating }) {
  const [form, setForm] = useState({ country: "", title: "", content: "", images: [], pdf: null });
  const imgInput = useRef(null);
  const pdfInput = useRef(null);

  const myReports = useMemo(
    () => reports.slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [reports]
  );

  async function handleImages(files) {
    const arr = Array.from(files || []);
    const dataUrls = await Promise.all(arr.map(fileToDataUrl));
    setForm((f) => ({ ...f, images: [...f.images, ...dataUrls] }));
  }

  function reset() {
    setForm({ country: "", title: "", content: "", images: [], pdf: null });
  }

  const canSaveReport = !!form.country && !!form.title?.trim();

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Reports</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <SectionHeader icon={FileText} title="Create a report" description="Attach updates and photos for a specific country." />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-3">
            <Label>Country</Label>
            <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {countries.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div>
              <Label className="mt-2 block">Title</Label>
              <Input placeholder="Quarterly update" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>

            <div>
              <Label className="mt-2 block">
                Content <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea rows={6} placeholder="Share stories, prayer requests, outcomes…" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </div>

            {/* Attachments */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Images */}
              <Button type="button" variant="secondary" onClick={() => imgInput.current?.click()}>
                <ImageIcon className="w-4 h-4 mr-2" /> Add Photos
              </Button>
              <input
                ref={imgInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleImages(e.target.files)}
              />
              {form.images.length > 0 && (
                <span className="text-sm text-muted-foreground">{form.images.length} image(s) attached</span>
              )}

              {/* PDF */}
              <Button type="button" variant="secondary" onClick={() => pdfInput.current?.click()}>
                <FileText className="w-4 h-4 mr-2" /> Attach PDF
              </Button>
              <input
                ref={pdfInput}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.type !== "application/pdf") {
                    toast.error("Please select a PDF file.");
                    return;
                  }
                  const MAX_MB = 15;
                  if (file.size > MAX_MB * 1024 * 1024) {
                    toast.error(`PDF is too large. Max ${MAX_MB}MB.`);
                    return;
                  }
                  setForm((f) => ({ ...f, pdf: file }));
                }}
              />
              {form.pdf && (
                <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                  {form.pdf.name}
                  <button
                    className="inline-flex"
                    onClick={() => setForm((f) => ({ ...f, pdf: null }))}
                    title="Remove PDF"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                className="btn"
                disabled={!canSaveReport || creating}
                aria-disabled={!canSaveReport || creating}
                onClick={() => {
                  if (!canSaveReport || creating) return;
                  console.log("[Reports] save");
                  if (!form.country) return toast.error("Select a country.");
                  if (!form.title.trim()) return toast.error("Title is required.");
                  const iso2 = countriesLib.getAlpha2Code(form.country, "en");
                  if (!iso2) return toast.error("Could not resolve country code.");
                  onAddReport({ ...form, country: iso2.toUpperCase() }); // backend expects ISO2; 'pdf' stays on the object
                  reset();
                }}
              >
                {creating ? "Saving…" : "Save Report"}
              </Button>

              <Button variant="ghost" onClick={reset}>Reset</Button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <SectionHeader icon={FileText} title="Recent reports" />
            <div className="space-y-4">
              {myReports.length === 0 && (
                <p className="text-sm text-muted-foreground">No reports yet. Create your first one!</p>
              )}
              {myReports.map((r) => (
                <div key={r.id || r.tempId} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "(pending)"}
                      </div>

                      <h4 className="font-semibold text-base">
                        {r.title}
                        {r.file_url && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs align-middle">
                            <FileText className="w-3 h-3" />
                            PDF
                          </span>
                        )}
                      </h4>

                      <div className="text-sm text-muted-foreground">{r.country_iso2 || ""}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="secondary" size="sm">View</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>{r.title}</DialogTitle>
                            <DialogDescription>
                              {r.country} {" • "}
                              {r.created_at ? new Date(r.created_at).toLocaleString() : "(pending)"}
                            </DialogDescription>
                          </DialogHeader>

                          <div className="prose prose-sm max-w-none">
                            <p className="whitespace-pre-wrap">{r.content || "(no content)"}</p>
                          </div>

                          {r.images?.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                              {r.images.map((src, i) => (
                                <img key={i} src={src} alt="report" className="w-full h-32 object-cover rounded-xl border" />
                              ))}
                            </div>
                          )}

                          {r.file_url && (
                            <div className="mt-4">
                              <a
                                href={r.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 underline"
                              >
                                <FileText className="w-4 h-4" />
                                {r.file_name || "Download attachment"}
                              </a>
                              {r.file_mime && (
                                <div className="text-xs text-muted-foreground">{r.file_mime}</div>
                              )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>

                      {r.id && (
                        <Button variant="ghost" size="sm" onClick={() => onDeleteReport(r.id)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>

                  {r.content && (
                    <p className="text-sm mt-2 line-clamp-3 whitespace-pre-wrap">{r.content}</p>
                  )}

                  {r.images?.length > 0 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto">
                      {r.images.slice(0, 6).map((src, i) => (
                        <img key={i} src={src} alt="thumb" className="w-20 h-16 object-cover rounded-lg border" />
                      ))}
                      {r.images.length > 6 && (
                        <div className="w-20 h-16 grid place-items-center border rounded-lg text-xs text-muted-foreground">
                          +{r.images.length - 6} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


/** Danger confirm component */
function DangerConfirm({ onConfirm, deleting }) {
  const [typed, setTyped] = useState("");
  const [ack, setAck] = useState(false);
  const canDelete = ack && typed === "DELETE";

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="confirm-text">Type DELETE to confirm</Label>
        <Input
          id="confirm-text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="DELETE"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
        />
        I understand this will permanently delete my account and data.
      </label>

      <div className="flex justify-end gap-2">
        <Button
          variant="destructive"
          disabled={!canDelete || deleting}
          onClick={() => {
            if (!canDelete || deleting) return;
            onConfirm();
          }}
        >
          {deleting ? "Deleting…" : "Delete account"}
        </Button>
      </div>
    </div>
  );
}

export default function MissionaryDashboard() {
  const { token, logout } = useAuth(); // added logout if available

  // Keep a local token that we can update after refresh
  const [authToken, setAuthToken] = useState(token);
  useEffect(() => setAuthToken(token), [token]);

  // Track if a refresh is already running, to de-duplicate refresh calls
  const refreshInFlight = useRef(null);
  const [sessionExpired, setSessionExpired] = useState(false);

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
      })()
        .catch((e) => {
          setSessionExpired(true);
          throw e;
        })
        .finally(() => {
          refreshInFlight.current = null;
        });
    }
    return refreshInFlight.current;
  }

  // Auth-aware API that retries once on 401 after refreshing
  async function callApi(path, opts = {}) {
    try {
      return await api(path, { ...opts, token: authToken });
    } catch (err) {
      const needsRefresh = err && [401, 403, 419].includes(err.status);
      if (needsRefresh) {
        try {
          const newTok = await refreshSessionOnce();
          return await api(path, { ...opts, token: newTok || authToken });
        } catch (retryErr) {
          throw retryErr;
        }
      }
      throw err;
    }
  }

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCountries, setSavingCountries] = useState(false);
  const [creatingReport, setCreatingReport] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false); // NEW

  const [profile, setProfile] = useState({ name: "", email: "", avatarUrl: "", bio: "", website: "" });
  const [countries, setCountries] = useState([]);
  const [reports, setReports] = useState([]);

  // NEW: snapshots used for "can save?" comparisons
  const [originalProfile, setOriginalProfile] = useState(null);
  const [originalCountries, setOriginalCountries] = useState(null);

  const norm = (v) => (v ?? "").toString().trim();

  // Initial load
  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      try {
        const [me, assignments, reps] = await Promise.all([
          callApi("/api/me"),
          callApi("/api/me/assignments"),
          callApi("/api/me/reports"),
        ]);
        if (cancelled) return;

        const loadedProfile = me?.missionary
          ? {
              name: me.missionary.display_name || "",
              email: me.email || "",
              avatarUrl: me.missionary.avatar_url || "",
              bio: me.missionary.bio || "",
              website: me.missionary.website || "",
            }
          : { name: "", email: me?.email || "", avatarUrl: "", bio: "", website: "" };

        const loadedCountriesRaw = Array.isArray(assignments) ? assignments : [];
        // Normalize: if server returned ISO2 codes, show names in UI
        const loadedCountries = loadedCountriesRaw.map((v) => {
          if (typeof v === "string" && v.length === 2) {
            const name = countriesLib.getName(v.toUpperCase(), "en");
            return name || v;
          }
          return v;
        });
        const loadedReports = Array.isArray(reps) ? reps : [];

        setProfile(loadedProfile);
        setCountries(loadedCountries);
        setReports(loadedReports);

        // take initial snapshots for ghosting logic
        setOriginalProfile(loadedProfile);
        setOriginalCountries(loadedCountries);
      } catch (err) {
        console.error(err);
        toast.error(`Load failed: ${err.message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (token) loadAll();
    return () => { cancelled = true; };
  }, [token]);

  // "Can save?" booleans
  const canSaveProfile =
    !!originalProfile &&
    (
      norm(profile.name)      !== norm(originalProfile.name)      ||
      norm(profile.email)     !== norm(originalProfile.email)     ||
      norm(profile.avatarUrl) !== norm(originalProfile.avatarUrl) ||
      norm(profile.bio)       !== norm(originalProfile.bio)       ||
      norm(profile.website)   !== norm(originalProfile.website)
    );

  const canSaveCountries =
    !!originalCountries &&
    JSON.stringify([...(countries || [])].sort()) !==
    JSON.stringify([...(originalCountries || [])].sort());

  async function saveProfile() {
    try {
      setSavingProfile(true);
      const payload = {
        display_name: profile.name || "",
        email: profile.email || "",
        avatar_url: profile.avatarUrl || "",
        bio: profile.bio || "",
        website: profile.website || "",
      };

      await callApi("/api/me/profile", { method: "PUT", body: payload });
      setOriginalProfile({ ...profile });
      toast.success("Profile saved");
    } catch (err) {
      console.error(err);
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveCountries() {
    try {
      setSavingCountries(true);

      // Convert UI names -> ISO2 codes (upper-case)
      const isoList = (countries || [])
        .map((name) => countriesLib.getAlpha2Code(name, "en"))
        .filter(Boolean)
        .map((c) => c.toUpperCase());

      const saved = await callApi("/api/me/assignments", {
        method: "PUT",
        body: { countries: isoList },
      });

      // Convert any returned ISO2 codes back to names for UI
      const returned = saved?.countries || isoList;
      const nextNames = returned.map((v) =>
        typeof v === "string" && v.length === 2
          ? (countriesLib.getName(v.toUpperCase(), "en") || v)
          : v
      );

      setCountries(nextNames);
      setOriginalCountries(nextNames);
      toast.success("Countries saved");
    } catch (err) {
      console.error(err);
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSavingCountries(false);
    }
  }

  async function addReport({ country, title, content, images, pdf }) {
    try {
      setCreatingReport(true);

      // optimistic item
      const tempId = `temp_${Date.now()}`;
      const optimistic = {
        tempId,
        country_iso2: country,
        title,
        content,
        images,
        created_at: new Date().toISOString(),
      };
      setReports((prev) => [optimistic, ...prev]);

      // multipart form-data
      const fd = new FormData();
      fd.append("country_iso2", country);
      fd.append("title", title);
      fd.append("content", content || "");

      (images || []).forEach((d, i) => {
        try {
          const blob = dataUrlToBlob(d);
          fd.append("images", new File([blob], `photo_${i + 1}.png`, { type: blob.type || "image/png" }));
        } catch {}
      });

      if (pdf instanceof File) {
        // Flask expects 'file' field name in create_report
        fd.append("file", pdf, pdf.name);
      }

      await callApi("/api/me/reports", { method: "POST", isForm: true, body: fd });

      // Refresh list
      const fresh = await callApi("/api/me/reports");
      setReports(Array.isArray(fresh) ? fresh : []);
      toast.success("Report saved");
    } catch (err) {
      console.error(err);
      toast.error(`Create failed: ${err.message}`);
      setReports((prev) => prev.filter((x) => !x.tempId));
    } finally {
      setCreatingReport(false);
    }
  }

  async function deleteReport(id) {
    try {
      await callApi(`/api/me/reports/${id}`, { method: "DELETE" });
      setReports((prev) => prev.filter((x) => x.id !== id));
      toast.success("Report deleted");
    } catch (err) {
      console.error(err);
      toast.error(`Delete failed: ${err.message}`);
    }
  }

  async function deleteAccount() {
    try {
      setDeletingAccount(true);
      await callApi("/api/me", { method: "DELETE" });
      toast.success("Your account has been deleted.");

      if (typeof logout === "function") {
        logout();
      } else {
        try { localStorage.removeItem("token"); } catch {}
      }
      window.location.href = "/"; // or "/login"
    } catch (err) {
      console.error(err);
      toast.error(`Delete failed: ${err.message}`);
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <div className="min-h-[70vh] w-full p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Missionary Dashboard</h1>
          <p className="text-muted-foreground">Manage your profile, field of service, and field reports.</p>
        </div>

        {loading ? (
          <div className="rounded-2xl border p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            {sessionExpired && (
              <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                Your session has expired. Please sign in again.
              </div>
            )}

            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="grid grid-cols-3 max-w-md">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="countries">Countries</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-6">
                <ProfileCard
                  profile={profile}
                  onChange={setProfile}
                  onSave={saveProfile}
                  saving={savingProfile}
                  canSave={canSaveProfile}
                />

                {/* Danger Zone */}
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-red-600">Danger Zone</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Deleting your profile will permanently remove your account, assignments, reports, and uploaded files. This action cannot be undone.
                    </p>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="destructive">
                          Delete Profile
                        </Button>
                      </DialogTrigger>

                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Delete your account?</DialogTitle>
                          <DialogDescription>
                            This is permanent. Please type <code>DELETE</code> to confirm and check the box.
                          </DialogDescription>
                        </DialogHeader>

                        <DangerConfirm onConfirm={deleteAccount} deleting={deletingAccount} />
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="countries" className="space-y-6">
                <CountriesCard
                  countries={countries}
                  onChange={setCountries}
                  onSave={saveCountries}
                  saving={savingCountries}
                  canSave={canSaveCountries}
                />
              </TabsContent>

              <TabsContent value="reports" className="space-y-6">
                <ReportsCard
                  countries={countries}
                  reports={reports}
                  onAddReport={addReport}
                  onDeleteReport={deleteReport}
                  creating={creatingReport}
                />
              </TabsContent>
            </Tabs>
          </>
        )}

        <Separator className="my-8" />
        <footer className="text-xs text-muted-foreground">
          <p>
            <strong>Notes:</strong> Adjust API paths if your backend differs. Set <code>VITE_API_URL</code> in your env to point to your server when needed.
          </p>
        </footer>
      </div>
    </div>
  );
}
