"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { stringifyFilters, type TableFilter } from "@/lib/tableQuery";

export type FilterLabel = { id: string; label: string };

function opLabel(op: string): string {
  switch (op) {
    case "eq":
      return "שווה";
    case "contains":
      return "מכיל";
    case "in":
      return "ברשימה";
    case "gte":
      return "מ-";
    case "lte":
      return "עד";
    default:
      return "מסנן";
  }
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function FilterChips({
  labels,
}: {
  labels: FilterLabel[];
}) {
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

  if (!filters.length) return null;

  const labelMap = new Map(labels.map((l) => [l.id, l.label] as const));

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((f, idx) => (
        <button
          key={`${f.id}:${idx}`}
          type="button"
          onClick={() => {
            const next = filters.filter((_, i) => i !== idx);
            const usp = new URLSearchParams(params.toString());
            usp.set("filters", stringifyFilters(next));
            usp.set("page", "1");
            router.push(`${pathname}?${usp.toString()}`);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-sm text-zinc-100 transition-all hover:bg-zinc-800 hover:border-zinc-700 active:scale-95 cursor-pointer shadow-sm shadow-zinc-950/20"
          aria-label="הסר מסנן"
        >
          <span className="font-bold text-zinc-300">
            {labelMap.get(f.id) ?? "שדה"}
          </span>
          <span className="text-zinc-500">
            {opLabel(String(f.op))}: {formatValue(f.value)}
          </span>
          <span className="text-zinc-400 font-bold ml-1">×</span>
        </button>
      ))}
    </div>
  );
}


