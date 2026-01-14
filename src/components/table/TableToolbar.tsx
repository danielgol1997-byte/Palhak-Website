"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Division } from "@prisma/client";

export function TableToolbar({
  placeholder = "חיפוש",
  showDivisionFilter = false,
  divisionLabels,
}: {
  placeholder?: string;
  showDivisionFilter?: boolean;
  divisionLabels?: Record<Division, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const initialQ = useMemo(() => params.get("q") ?? "", [params]);
  const initialDivision = useMemo(() => params.get("division") ?? "ALL", [params]);
  
  const [q, setQ] = useState(initialQ);
  const [division, setDivision] = useState(initialDivision);

  useEffect(() => {
    setQ(initialQ);
  }, [initialQ]);

  useEffect(() => {
    setDivision(initialDivision);
  }, [initialDivision]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const usp = new URLSearchParams(params.toString());
      
      if (q.trim()) {
        usp.set("q", q.trim());
      } else {
        usp.delete("q");
      }

      if (division !== "ALL") {
        usp.set("division", division);
      } else {
        usp.delete("division");
      }

      usp.set("page", "1");
      router.push(`${pathname}?${usp.toString()}`);
    }, 300);

    return () => clearTimeout(handler);
  }, [q, division, pathname, router, params]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <input
          className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-950 pr-12 pl-4 text-base text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all placeholder:text-zinc-600"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
        />
      </div>

      {showDivisionFilter && (
        <select
          value={division}
          onChange={(e) => setDivision(e.target.value)}
          className="h-14 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-base text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all cursor-pointer min-w-[140px]"
      >
          <option value="ALL">כל החלוקות</option>
          {Object.values(Division).map((d) => (
            <option key={d} value={d}>
              {divisionLabels ? divisionLabels[d] : d}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
