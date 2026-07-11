import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { ICD10_CODES } from "../../data/icd10Codes";

const MAX_RESULTS = 8;

// ICD-10 diagnosis picker — click to browse common diagnoses, type to
// filter by code or name, select one or more. Selected codes show as
// removable chips. Backed by a curated subset of the Philippine DOH
// ICD-10 Modifications Handbook (src/data/icd10Codes.js) — the practical
// "common diagnoses" table, not the full WHO code set.
export default function Icd10Autocomplete({ value = [], onChange, placeholder = "Search a diagnosis or ICD-10 code…" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCodes = useMemo(() => new Set(value.map((v) => v.code)), [value]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? ICD10_CODES.filter(
          (r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
        )
      : ICD10_CODES;
    return pool.filter((r) => !selectedCodes.has(r.code)).slice(0, MAX_RESULTS);
  }, [query, selectedCodes]);

  function addCode(entry) {
    onChange([...value, entry]);
    setQuery("");
  }

  function removeCode(code) {
    onChange(value.filter((v) => v.code !== code));
  }

  return (
    <div ref={containerRef} className="relative">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((v) => (
            <span
              key={v.code}
              className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-medium pl-2.5 pr-1.5 py-1"
            >
              <span className="font-bold">{v.code}</span>
              <span className="text-teal-700">{v.name}</span>
              <button
                type="button"
                onClick={() => removeCode(v.code)}
                className="text-teal-400 hover:text-red-600 shrink-0"
                aria-label={`Remove ${v.code}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 pl-7 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {matches.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-slate-400">
              {query.trim() ? "No matching diagnosis found." : "Start typing to search, or browse below."}
            </div>
          ) : (
            matches.map((entry) => (
              <button
                key={entry.code}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addCode(entry)}
                className="flex w-full items-center gap-2 text-left px-3 py-2 text-sm hover:bg-teal-50 transition-colors"
              >
                <span className="shrink-0 font-mono text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5">
                  {entry.code}
                </span>
                <span className="text-slate-700 truncate">{entry.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
