"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { TableFilter } from "@/lib/tableQuery";
import { parseSort, stringifyFilters } from "@/lib/tableQuery";

// Serializable column definition - no functions allowed
export type SimpleColumn = {
  id: string;
  label: string;
  clickToFilter?: boolean; // Enable click-to-filter for this column
};

export function SimpleTable<Row extends Record<string, any>>({
  columns,
  rows,
}: {
  columns: Array<SimpleColumn>;
  rows: Row[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const sort = useMemo(() => parseSort(params.get("sort") ?? ""), [params]);

  const filters = useMemo<TableFilter[]>(() => {
    const raw = params.get("filters") ?? "[]";
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as TableFilter[]) : [];
    } catch {
      return [];
    }
  }, [params]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-50">
          <tr>
            {columns.map((c) => {
              const active = sort?.field === c.id;
              const dir = active ? sort?.dir : null;
              return (
                <th key={c.id} className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2"
                    onClick={() => {
                      const usp = new URLSearchParams(params.toString());
                      const nextDir = active && dir === "asc" ? "desc" : "asc";
                      usp.set("sort", `${c.id}:${nextDir}`);
                      usp.set("page", "1");
                      router.push(`${pathname}?${usp.toString()}`);
                    }}
                  >
                    <span>{c.label}</span>
                    {active ? <span className="text-zinc-500">{dir === "asc" ? "▲" : "▼"}</span> : null}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.id ?? idx} className="border-t border-zinc-200">
              {columns.map((c) => {
                const value = r[c.id];
                const displayValue = value === null || value === undefined ? "" : String(value);
                
                return (
                  <td key={c.id} className="px-3 py-3 align-top">
                    {c.clickToFilter ? (
                      <button
                        type="button"
                        className="w-full text-right hover:underline"
                        onClick={() => {
                          if (value === null || value === undefined || value === "") return;
                          const next: TableFilter[] = [
                            ...filters,
                            { id: c.id, op: "eq", value },
                          ];
                          const usp = new URLSearchParams(params.toString());
                          usp.set("filters", stringifyFilters(next));
                          usp.set("page", "1");
                          router.push(`${pathname}?${usp.toString()}`);
                        }}
                        aria-label="הוסף מסנן"
                      >
                        {displayValue}
                      </button>
                    ) : (
                      <div className="text-right">{displayValue}</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-zinc-600" colSpan={columns.length}>
                אין נתונים.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}




