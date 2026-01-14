"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FilterOp, TableFilter } from "@/lib/tableQuery";
import { stringifyFilters } from "@/lib/tableQuery";

export type ColumnDef = {
  id: string;
  label: string;
  kind: "text" | "enum" | "date" | "number";
};

export function FilterBuilder({ columns }: { columns: ColumnDef[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters = useMemo<TableFilter[]>(() => {
    const raw = params.get("filters") ?? "[]";
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as TableFilter[]) : [];
    } catch {
      return [];
    }
  }, [params]);

  const [colId, setColId] = useState(columns[0]?.id ?? "");
  const [op, setOp] = useState<FilterOp>("eq");
  const [value, setValue] = useState("");

  const col = columns.find((c) => c.id === colId);
  const inputType = col?.kind === "number" ? "number" : col?.kind === "date" ? "date" : "text";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
      <div className="text-sm font-bold text-zinc-400 mb-4 uppercase tracking-wider">מסננים לפי עמודה</div>
      <div className="grid gap-3 sm:grid-cols-4">
        <select
          className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
          value={colId}
          onChange={(e) => setColId(e.target.value)}
        >
          {columns.map((c) => (
            <option key={c.id} value={c.id} className="bg-zinc-900">
              {c.label}
            </option>
          ))}
        </select>

        <select
          className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
          value={op}
          onChange={(e) => setOp(e.target.value as FilterOp)}
        >
          <option value="eq" className="bg-zinc-900">שווה</option>
          {col?.kind !== "number" && col?.kind !== "date" ? (
            <option value="contains" className="bg-zinc-900">מכיל</option>
          ) : null}
          {col?.kind === "number" || col?.kind === "date" ? (
            <>
              <option value="gte" className="bg-zinc-900">מ-</option>
              <option value="lte" className="bg-zinc-900">עד</option>
            </>
          ) : null}
        </select>

        <input
          type={inputType}
          className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={col?.kind === "date" ? "YYYY-MM-DD" : col?.kind === "number" ? "מספר" : "ערך"}
          dir={col?.kind === "date" ? "ltr" : "rtl"}
        />

        <button
          type="button"
          className="inline-flex h-12 items-center justify-center rounded-xl bg-zinc-50 px-6 text-sm font-bold text-zinc-950 shadow-lg shadow-zinc-100/5 transition-all hover:bg-zinc-200 hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
          disabled={!colId || !value.trim()}
          onClick={() => {
            const next: TableFilter[] = [
              ...filters,
              { id: colId, op, value: value.trim() },
            ];
            const usp = new URLSearchParams(params.toString());
            usp.set("filters", stringifyFilters(next));
            usp.set("page", "1");
            router.push(`${pathname}?${usp.toString()}`);
            setValue("");
          }}
        >
          הוסף מסנן
        </button>
      </div>
    </div>
  );
}


