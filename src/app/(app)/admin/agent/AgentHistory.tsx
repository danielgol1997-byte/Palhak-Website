"use client";

import { useState } from "react";
import type { RunView } from "@/lib/agent/runs";
import { RunCard } from "@/components/agent/RunCard";

const FILTERS: { key: "all" | "executed" | "not"; label: string }[] = [
  { key: "all", label: "הכול" },
  { key: "executed", label: "בוצעו" },
  { key: "not", label: "לא בוצעו" },
];

const EXECUTED: RunView["status"][] = ["DONE", "PARTIAL", "INTERRUPTED", "EXECUTING"];

/** Read-only list of the agent's plans and receipts. Plans are confirmed in the chat, not here. */
export function AgentHistory({ runs }: { runs: RunView[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  // Rendered once per visit; a waiting plan shows its real state after a refresh.
  const [now] = useState(() => Date.now());

  const shown = runs.filter((r) =>
    filter === "all" ? true : filter === "executed" ? EXECUTED.includes(r.status) : !EXECUTED.includes(r.status),
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-zinc-50">היסטוריית הסוכן</h2>
        <div className="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1" role="tablist" aria-label="סינון">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`min-h-9 rounded-lg px-3 text-sm font-bold transition ${
                filter === f.key ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
          {runs.length === 0 ? "עדיין לא הוכנו תוכניות. פתח את הסוכן מהסרגל העליון ובקש פעולה." : "אין תוכניות בסינון הזה."}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((run) => (
            <RunCard key={run.id} run={run} now={now} showMeta />
          ))}
        </div>
      )}
    </section>
  );
}
