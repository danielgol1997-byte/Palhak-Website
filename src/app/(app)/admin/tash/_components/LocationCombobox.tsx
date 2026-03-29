"use client";

import { useState, useRef, useEffect } from "react";
import { deleteTashLocationAction } from "../actions";

export type SavedLocation = { id: string; name: string };

const YAMAH = "ימ״ח";

interface LocationComboboxProps {
  name: string;
  value: string;
  onChange: (val: string) => void;
  locations: SavedLocation[];
  onLocationsChange: (updated: SavedLocation[]) => void;
  placeholder?: string;
  required?: boolean;
  excludeLocation?: string; // hide this from the list (e.g. the "from" location when moving)
}

export function LocationCombobox({
  name,
  value,
  onChange,
  locations,
  onLocationsChange,
  placeholder = "הקלד מיקום...",
  required,
  excludeLocation,
}: LocationComboboxProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = locations.filter(
    (l) =>
      l.name !== excludeLocation &&
      (value.trim() === "" || l.name.toLowerCase().includes(value.trim().toLowerCase()))
  );

  const exactMatch = locations.some(
    (l) => l.name.toLowerCase() === value.trim().toLowerCase()
  );

  const showAddNew = value.trim().length > 0 && !exactMatch;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function removeFromSavedList(loc: SavedLocation) {
    if (loc.name === YAMAH) return;
    const fd = new FormData();
    fd.set("id", loc.id);
    try {
      await deleteTashLocationAction(fd);
      onLocationsChange(locations.filter((l) => l.id !== loc.id));
      if (value === loc.name) onChange("");
    } catch {
      // silently ignore
    }
  }

  function handleDeleteChip(loc: SavedLocation, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    void removeFromSavedList(loc);
  }

  function handleContextRemove(loc: SavedLocation, e: React.MouseEvent) {
    if (loc.name === YAMAH) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof window !== "undefined" && !window.confirm(`להסיר את „${loc.name}” מהרשימה השמורה? (לא משנה מלאי)`)) {
      return;
    }
    void removeFromSavedList(loc);
  }

  function selectLocation(locName: string) {
    onChange(locName);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={value} />

      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
      />

      {/* Saved locations — always visible chips; ✕ or right-click to remove (not ימ״ח) */}
      {locations.filter((l) => l.name !== excludeLocation).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {locations
            .filter((l) => l.name !== excludeLocation)
            .map((loc) => (
              <span
                key={loc.id}
                onContextMenu={(e) => handleContextRemove(loc, e)}
                title={loc.name === YAMAH ? YAMAH : `${loc.name} — לחיצה ימנית להסרה מהרשימה`}
                className={`inline-flex max-w-full items-center gap-0.5 rounded-lg border pl-2 pr-0.5 py-0.5 text-xs ${
                  loc.name === YAMAH
                    ? "border-teal-800 bg-teal-950/40 text-teal-200"
                    : "border-zinc-700 bg-zinc-800/80 text-zinc-200"
                }`}
              >
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-1 truncate text-right hover:opacity-90"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectLocation(loc.name)}
                >
                  <span className="shrink-0">{loc.name === YAMAH ? "🏭" : "📍"}</span>
                  <span className="truncate">{loc.name}</span>
                </button>
                {loc.name !== YAMAH && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteChip(loc, e)}
                    className="shrink-0 rounded p-1 text-zinc-500 hover:bg-red-950/50 hover:text-red-400"
                    title="הסר מהרשימה"
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
        </div>
      )}

      {open && (filtered.length > 0 || showAddNew) && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
          {/* Existing locations */}
          {filtered.map((loc) => (
            <div
              key={loc.id}
              className="flex items-center justify-between px-3 py-2 hover:bg-zinc-800 cursor-pointer group"
              onContextMenu={(e) => loc.name !== YAMAH && handleContextRemove(loc, e)}
              onMouseDown={(e) => {
                e.preventDefault();
                selectLocation(loc.name);
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {loc.name === YAMAH ? (
                  <span className="text-xs">🏭</span>
                ) : (
                  <span className="text-xs text-zinc-500">📍</span>
                )}
                <span className="text-sm text-zinc-100 truncate">{loc.name}</span>
              </div>
              {loc.name !== YAMAH && (
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => handleDeleteChip(loc, e)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 text-xs px-1 transition-opacity shrink-0"
                  title="הסר מהרשימה"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {/* Add new option */}
          {showAddNew && (
            <div
              className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 cursor-pointer border-t border-zinc-800"
              onMouseDown={(e) => {
                e.preventDefault();
                // The typed value becomes selected; it will be saved to DB when the form submits
                selectLocation(value.trim());
              }}
            >
              <span className="text-xs text-emerald-400">＋</span>
              <span className="text-sm text-emerald-400">
                הוסף מיקום: <span className="font-bold">{value.trim()}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
