// src/components/CountrySearch.jsx
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * countries: [{ id, name, iso2, iso3?, altNames?: string[] }]
 * onSelect: (countryObj) => void
 * valueName?: string   // optional controlled value to show (country name)
 * placeholder?: string
 */
export default function CountrySearch({
  countries = [],
  onSelect,
  valueName = "",
  placeholder = "Search country…",
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const listId = "country-search-listbox";

  // Normalize once
  const indexed = useMemo(() => {
    const norm = (s) => (s || "").toLowerCase().normalize("NFKD").replace(/\p{Diacritic}/gu, "");
    return countries.map((c) => ({
      ...c,
      _n: norm(c.name),
      _iso2: (c.iso2 || "").toLowerCase(),
      _iso3: (c.iso3 || "").toLowerCase(),
      _alts: (c.altNames || []).map((a) => norm(a)),
    }));
  }, [countries]);

  const norm = (s) => (s || "").toLowerCase().normalize("NFKD").replace(/\p{Diacritic}/gu, "");
  const q = norm(query);

  // Score/rank “logical choices”
  const results = useMemo(() => {
    if (!q) return [];
    const starts = [], includes = [];
    for (const c of indexed) {
      const inNameStart = c._n.startsWith(q);
      const inName = inNameStart || c._n.includes(q);
      const inAltStart = c._alts.some((a) => a.startsWith(q));
      const inAlt = inAltStart || c._alts.some((a) => a.includes(q));
      const inIso = c._iso2 === q || c._iso3 === q;

      if (!(inName || inAlt || inIso)) continue;

      const score =
        (inIso ? 0 : 10) + // iso exact is strongest
        (inNameStart || inAltStart ? 1 : 2); // starts better than contains

      (inNameStart || inAltStart || inIso ? starts : includes).push({ c, score });
    }
    const ranked = [...starts, ...includes]
      .sort((a, b) => a.score - b.score || a.c.name.localeCompare(b.c.name))
      .map((x) => x.c);
    return ranked.slice(0, 8);
  }, [indexed, q]);

  // Close when clicking outside
  useEffect(() => {
    const onDocClick = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Reset active when results change
  useEffect(() => setActive(0), [q]);

  const handleKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!results.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = results[active];
      if (picked) {
        onSelect?.(picked);
        setQuery("");
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          className="w-full rounded-lg border border-gray-300 pl-3 pr-8 py-2 outline-none focus:ring-2 focus:ring-blue-400"
          placeholder={placeholder}
          value={query || valueName}
          onChange={(e) => {
           setQuery(e.target.value);
           setOpen(true);
          }}
         onFocus={() => q && setOpen(true)}
         onKeyDown={handleKeyDown}
         aria-autocomplete="list"
         aria-controls={listId}
         aria-expanded={open}
        />

        {query && (
          <button
  type="button"
  aria-label="Clear search"
  title="Clear"
  className="absolute right-2 top-1/2 -translate-y-1/2
             h-6 w-6 flex items-center justify-center
             rounded-full leading-none
             text-black-500 hover:text-white-700
             focus:outline-none focus-visible:outline-none"
  onMouseDown={(e) => {
    // prevent input from losing focus (so outside-click logic doesn't run first)
    e.preventDefault();
    setQuery("");
    setOpen(false);
  }}
>
  ×
</button>

        )}
      </div>


      {open && q && results.length > 0 && (
        <div
          role="listbox"
          id={listId}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {results.map((c, idx) => {
            const activeItem = idx === active;
            return (
              <div
                id={`${listId}-${c.iso2}`}
                role="option"
                aria-selected={activeItem}
                key={c.id ?? c.iso2 ?? c.name}
                className={`cursor-pointer px-3 py-2 ${activeItem ? "bg-gray-100" : "bg-white"} hover:bg-gray-50`}
                onMouseEnter={() => setActive(idx)}
                onMouseDown={(e) => {
                  // prevent input blur before click
                  e.preventDefault();
                }}
                onClick={() => {
                  onSelect?.(c);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{c.name}</span>
                  <span className="text-xs text-gray-500">{c.iso2 || c.iso3}</span>
                </div>
                {c.altNames?.length ? (
                  <div className="mt-0.5 text-xs text-gray-400 truncate">
                    {c.altNames.slice(0, 3).join(" • ")}
                    {c.altNames.length > 3 ? " …" : ""}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Optional: empty state */}
      {open && q && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow">
          No matches
        </div>
      )}
    </div>
  );
}
