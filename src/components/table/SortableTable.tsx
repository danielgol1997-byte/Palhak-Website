"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { TableFilter } from "@/lib/tableQuery";
import { parseSort, stringifyFilters } from "@/lib/tableQuery";

export type SortableColumn<Row> = {
  id: string;
  label: string;
  render: (row: Row) => React.ReactNode;
  filterValue?: (row: Row) => unknown;
};

export function SortableTable<Row extends { id: string }>({
  columns,
  rows,
}: {
  columns: Array<SortableColumn<Row>>;
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
                      const nextDir =
                        active && dir === "asc" ? "desc" : "asc";
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
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-200">
              {columns.map((c) => {
                const fv = c.filterValue ? c.filterValue(r) : null;
                return (
                  <td key={c.id} className="px-3 py-3 align-top">
                    {c.filterValue ? (
                      <button
                        type="button"
                        className="w-full text-right"
                        onClick={() => {
                          if (fv === null || fv === undefined || fv === "") return;
                          const next: TableFilter[] = [
                            ...filters,
                            { id: c.id, op: "eq", value: fv },
                          ];
                          const usp = new URLSearchParams(params.toString());
                          usp.set("filters", stringifyFilters(next));
                          usp.set("page", "1");
                          router.push(`${pathname}?${usp.toString()}`);
                        }}
                        aria-label="הוסף מסנן"
                      >
                        {c.render(r)}
                      </button>
                    ) : (
                      <div className="text-right">{c.render(r)}</div>
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


