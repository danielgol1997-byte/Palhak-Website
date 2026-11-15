"use client";

import type { RunView } from "@/lib/agent/runs";

/**
 * A plan drafted by the AI agent, in whatever state it is in:
 * waiting for confirmation (with the buttons), running, or finished (the receipt).
 * Every line shown here was produced by the server from database values.
 */

const STATUS_BADGE: Record<RunView["status"], { label: string; className: string }> = {
  PROPOSED: { label: "ממתין לאישור שלך", className: "border-amber-700 bg-amber-950 text-amber-200" },
  EXECUTING: { label: "מתבצע…", className: "border-sky-700 bg-sky-950 text-sky-200" },
  DONE: { label: "בוצע", className: "border-emerald-700 bg-emerald-950 text-emerald-200" },
  PARTIAL: { label: "בוצע חלקית", className: "border-orange-700 bg-orange-950 text-orange-200" },
  FAILED: { label: "נכשל · דבר לא בוצע", className: "border-red-700 bg-red-950 text-red-200" },
  CANCELLED: { label: "בוטל · דבר לא בוצע", className: "border-zinc-700 bg-zinc-800 text-zinc-300" },
  EXPIRED: { label: "פג תוקף · דבר לא בוצע", className: "border-zinc-700 bg-zinc-800 text-zinc-300" },
  INTERRUPTED: { label: "הביצוע נקטע · יש לבדוק", className: "border-red-700 bg-red-950 text-red-200" },
};

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function StepIcon({ state }: { state: "pending" | "done" | "failed" | "skipped" }) {
  if (state === "done") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white" aria-label="בוצע">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-white" aria-label="נכשל">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </span>
    );
  }
  if (state === "skipped") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400" aria-label="לא בוצע">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
          <path d="M6 12h12" />
        </svg>
      </span>
    );
  }
  return <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-zinc-700" aria-hidden="true" />;
}

export function RunCard({
  run,
  now,
  busy = false,
  notice,
  showMeta = false,
  onConfirm,
  onCancel,
}: {
  run: RunView;
  /** Current time in ms, so an unconfirmed plan visibly expires without a reload. */
  now: number;
  busy?: boolean;
  /** A message from the server about this plan (e.g. "already executed"). */
  notice?: string;
  /** History page: show who asked and what they typed. */
  showMeta?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  const expired = run.status === "PROPOSED" && new Date(run.expiresAt).getTime() <= now;
  const status: RunView["status"] = expired ? "EXPIRED" : run.status;
  const badge = STATUS_BADGE[status];
  const awaiting = status === "PROPOSED";
  const hasReceipt = Boolean(run.receipt?.length);

  // After execution show what actually happened; before it, what will happen.
  const rows = hasReceipt
    ? run.receipt!.map((r) => ({ title: r.title, details: r.details, state: r.status, error: r.error }))
    : run.steps.map((s) => ({ title: s.title, details: s.details, state: "pending" as const, error: undefined }));

  return (
    <div
      data-testid="agent-run-card"
      data-run-status={status}
      className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-3.5 py-2.5">
        <div className="text-sm font-bold text-zinc-100">{hasReceipt ? "קבלה" : "תוכנית פעולה"}</div>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${badge.className}`}>{busy && awaiting ? "מבצע…" : badge.label}</span>
      </div>

      {showMeta && (
        <div className="border-b border-zinc-800 px-3.5 py-2.5 text-xs leading-5 text-zinc-400">
          <div>
            <span className="font-bold text-zinc-200">{run.actorName ?? "מנהל"}</span> · {new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(run.createdAt))}
          </div>
          <div className="mt-0.5 whitespace-pre-wrap break-words" dir="auto">
            ביקש: {run.userPrompt}
          </div>
        </div>
      )}

      <ol className="flex flex-col">
        {rows.map((row, i) => (
          <li key={i} className={`flex gap-2.5 px-3.5 py-2.5 ${i > 0 ? "border-t border-zinc-800" : ""}`}>
            <StepIcon state={row.state} />
            <div className="min-w-0 flex-1">
              <div className="break-words text-sm font-semibold text-zinc-50" dir="auto">
                {rows.length > 1 && <span className="text-zinc-500">{i + 1}. </span>}
                {row.title}
              </div>
              {row.details.map((d, j) => (
                <div key={j} className="break-words text-[13px] leading-5 text-zinc-400" dir="auto">
                  {d}
                </div>
              ))}
              {row.error && (
                <div className="mt-1 break-words rounded-lg bg-red-950 px-2 py-1 text-[13px] leading-5 text-red-100" dir="auto">
                  {row.error}
                </div>
              )}
              {row.state === "skipped" && <div className="text-[13px] text-zinc-500">לא בוצע, כי צעד קודם נכשל.</div>}
            </div>
          </li>
        ))}
      </ol>

      {notice && <div className="border-t border-zinc-800 bg-amber-950 px-3.5 py-2 text-[13px] text-amber-100">{notice}</div>}

      {awaiting && onConfirm && onCancel && (
        <div className="flex flex-col gap-2 border-t border-zinc-800 p-3 sm:flex-row-reverse">
          <button
            type="button"
            data-testid="agent-confirm"
            onClick={onConfirm}
            disabled={busy}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-60"
          >
            {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
            {busy ? "מבצע…" : "אשר ובצע"}
          </button>
          <button
            type="button"
            data-testid="agent-cancel"
            onClick={onCancel}
            disabled={busy}
            className="flex min-h-11 items-center justify-center rounded-xl border border-zinc-700 px-5 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-60 sm:flex-none"
          >
            בטל
          </button>
        </div>
      )}

      {awaiting && (
        <div className="border-t border-zinc-800 px-3.5 py-2 text-xs text-zinc-500">
          שום דבר לא ישתנה עד שתאשר. האישור בתוקף עד {timeLabel(run.expiresAt)}.
        </div>
      )}
      {status === "PARTIAL" && (
        <div className="border-t border-zinc-800 px-3.5 py-2 text-xs text-zinc-400">
          הצעדים המסומנים ב-✓ בוצעו ונשמרו. הצעד שנכשל והצעדים שאחריו לא בוצעו.
        </div>
      )}
      {status === "INTERRUPTED" && (
        <div className="border-t border-zinc-800 px-3.5 py-2 text-xs text-zinc-400">
          הביצוע נקטע באמצע. הצעדים המסומנים ב-✓ בוצעו; את השאר יש לבדוק במסכי המערכת.
        </div>
      )}
    </div>
  );
}
