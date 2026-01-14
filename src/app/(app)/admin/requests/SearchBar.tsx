"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

export function SearchBar({ initialSearch }: { initialSearch: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  // Debounce the search with useCallback to prevent recreation on every render
  const debouncedSearch = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set("search", value.trim());
    } else {
      params.delete("search");
    }
    router.push(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== initialSearch) {
        debouncedSearch(search);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [search, initialSearch, debouncedSearch]);

  const handleClear = () => {
    setSearch("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-sm">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש בקשות (שם חייל, פריט, מספר סידורי, הערות...)"
          className="w-full h-12 rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-50 placeholder-zinc-500 outline-none focus:ring-2 focus:ring-zinc-600 transition-all"
        />
        {search && (
          <button
            onClick={handleClear}
            className="absolute left-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-colors flex items-center justify-center text-sm"
            title="נקה חיפוש"
          >
            ✕
          </button>
        )}
      </div>
      {search && (
        <p className="mt-2 text-xs text-zinc-400">
          מחפש: <span className="text-zinc-50 font-bold">{search}</span>
        </p>
      )}
    </div>
  );
}

