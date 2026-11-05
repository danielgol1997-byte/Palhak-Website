"use client";

import { useState, useTransition } from "react";
import type { BackupSummary } from "@/lib/backup/types";

const KIND_LABEL: Record<string, string> = {
  DAILY: "יומי",
  WEEKLY: "שבועי",
  MONTHLY: "חודשי",
  MANUAL: "ידני",
  PRE_RESET: "לפני איפוס",
  PRE_RESTORE: "לפני שחזור",
};

const KIND_COLOR: Record<string, string> = {
  DAILY: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  WEEKLY: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  MONTHLY: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  MANUAL: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  PRE_RESET: "bg-red-500/15 text-red-300 border-red-500/30",
  PRE_RESTORE: "bg-red-500/15 text-red-300 border-red-500/30",
};

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BackupsPanel({
  initialBackups,
  blobConfigured,
  cronSecretConfigured,
  retentionDays,
}: {
  initialBackups: BackupSummary[];
  blobConfigured: boolean;
  cronSecretConfigured: boolean;
  retentionDays: Record<string, number | null>;
}) {
  const [backups, setBackups] = useState(initialBackups);
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const latest = backups[0];
  const latestAgeHours = latest ? (Date.now() - new Date(latest.createdAt).getTime()) / 3_600_000 : null;
  const automatic = backups.filter((b) => b.trigger === "cron");
  const totalInline = backups.filter((b) => b.hasInlineData).reduce((s, b) => s + b.sizeBytes, 0);

  async function refresh() {
    const res = await fetch("/api/admin/backups", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { backups: BackupSummary[] };
      setBackups(data.backups);
    }
  }

  function createNow() {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/backups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "שגיאה");
        setLabel("");
        setMessage({
          kind: "ok",
          text: `הגיבוי נוצר: ${data.totalRows} שורות, ${fmtBytes(data.sizeBytes)}${data.blobUrl ? " · הועתק גם לאחסון חיצוני" : ""}${data.mirrorError ? ` · העתקה חיצונית נכשלה: ${data.mirrorError}` : ""}`,
        });
        await refresh();
      } catch (e) {
        setMessage({ kind: "err", text: e instanceof Error ? e.message : "שגיאה ביצירת גיבוי" });
      }
    });
  }

  async function verify(id: string) {
    setVerifying(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/backups/${id}/verify`, { method: "POST" });
      const data = (await res.json()) as { ok: boolean; problems: string[] };
      setMessage(
        data.ok
          ? { kind: "ok", text: "הגיבוי תקין: הסיכום, הפענוח וספירות השורות תואמים." }
          : { kind: "err", text: `בעיה בגיבוי: ${data.problems.join("; ")}` }
      );
      await refresh();
    } catch {
      setMessage({ kind: "err", text: "בדיקת הגיבוי נכשלה" });
    } finally {
      setVerifying(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Status cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="גיבוי אחרון"
          value={latest ? fmtDate(latest.createdAt) : "אין עדיין"}
          hint={latestAgeHours === null ? "" : latestAgeHours < 1 ? "לפני פחות משעה" : `לפני ${Math.round(latestAgeHours)} שעות`}
          tone={latestAgeHours === null || latestAgeHours > 30 ? "warn" : "ok"}
        />
        <StatCard
          title="גיבויים אוטומטיים"
          value={String(automatic.length)}
          hint="נוצרים כל לילה בשעה 02:30 UTC"
          tone={automatic.length > 0 ? "ok" : "warn"}
        />
        <StatCard
          title="עותק חיצוני (Vercel Blob)"
          value={blobConfigured ? "פעיל" : "לא מוגדר"}
          hint={blobConfigured ? "כל גיבוי מועתק גם מחוץ למסד הנתונים" : "ראה BACKUPS.md להפעלה"}
          tone={blobConfigured ? "ok" : "warn"}
        />
        <StatCard
          title="נפח גיבויים במסד"
          value={fmtBytes(totalInline)}
          hint={`${backups.length} גיבויים · מפתח cron ${cronSecretConfigured ? "מוגדר" : "לא מוגדר"}`}
          tone="neutral"
        />
      </div>

      {/* Create */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-50">גיבוי ידני עכשיו</h2>
        <p className="mt-1 text-sm text-zinc-400">מומלץ לפני שינויים גדולים. הגיבוי נשמר שנה.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="תיאור (אופציונלי), למשל: לפני עדכון מלאי"
            className="h-12 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-base text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500"
            maxLength={120}
          />
          <button
            type="button"
            data-write="true"
            onClick={createNow}
            disabled={isPending}
            className="h-12 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {isPending ? "מגבה…" : "צור גיבוי"}
          </button>
        </div>
        {message && (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              message.kind === "ok"
                ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-200"
                : "border-red-700/50 bg-red-950/30 text-red-200"
            }`}
          >
            {message.text}
          </div>
        )}
      </section>

      {/* Policy */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-50">מדיניות שמירה</h2>
        <ul className="mt-3 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
          <li>• יומי — נשמר {retentionDays.DAILY} ימים</li>
          <li>• שבועי (יום ראשון) — נשמר {retentionDays.WEEKLY} ימים</li>
          <li>• חודשי (1 בחודש) — נשמר {retentionDays.MONTHLY} ימים</li>
          <li>• ידני — נשמר {retentionDays.MANUAL} ימים</li>
          <li>• לפני איפוס / לפני שחזור — נשמר לצמיתות</li>
          <li>• בנוסף: Neon שומר היסטוריה של 6 שעות לשחזור נקודתי</li>
        </ul>
        <p className="mt-3 text-xs text-zinc-500">
          שחזור מתבצע מהמחשב בלבד עם <code className="rounded bg-zinc-800 px-1">npm run backup:restore</code> (ראה BACKUPS.md). אין כפתור שחזור באתר בכוונה.
        </p>
      </section>

      {/* List */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-zinc-50">כל הגיבויים ({backups.length})</h2>
          <button type="button" data-view-ok="true" onClick={refresh} className="text-xs font-bold text-zinc-400 hover:text-zinc-100">
            רענון
          </button>
        </div>
        {backups.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/50 py-10 text-center text-sm text-zinc-500">
            עדיין אין גיבויים. צור גיבוי ידני עכשיו, או חכה לריצה הלילית.
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {backups.map((b) => {
              const open = expanded === b.id;
              return (
                <li key={b.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60">
                  <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${KIND_COLOR[b.kind] ?? ""}`}>
                      {KIND_LABEL[b.kind] ?? b.kind}
                    </span>
                    <span className="text-sm font-bold text-zinc-100">{fmtDate(b.createdAt)}</span>
                    {b.label && <span className="text-xs text-zinc-400 truncate max-w-full">· {b.label}</span>}
                    <span className="ms-auto text-xs text-zinc-500 whitespace-nowrap">
                      {b.totalRows.toLocaleString("he-IL")} שורות · {fmtBytes(b.sizeBytes)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/70 px-3 py-2 sm:px-4">
                    <span className={`text-xs ${b.verifiedAt ? "text-emerald-400" : "text-zinc-500"}`}>
                      {b.verifiedAt ? `✓ נבדק ${fmtDate(b.verifiedAt)}` : "לא נבדק"}
                    </span>
                    <span className="text-xs text-zinc-600">·</span>
                    <span className="text-xs text-zinc-500">{b.storage === "db+blob" ? "מסד + חיצוני" : b.storage === "db" ? "מסד" : b.storage}</span>
                    <div className="ms-auto flex flex-wrap gap-2">
                      <button
                        type="button"
                        data-view-ok="true"
                        onClick={() => setExpanded(open ? null : b.id)}
                        className="h-9 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
                      >
                        {open ? "הסתר פירוט" : "פירוט"}
                      </button>
                      <button
                        type="button"
                        data-view-ok="true"
                        onClick={() => verify(b.id)}
                        disabled={verifying === b.id || (!b.hasInlineData && !b.blobUrl)}
                        className="h-9 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-xs font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                      >
                        {verifying === b.id ? "בודק…" : "בדוק תקינות"}
                      </button>
                      <a
                        href={`/api/admin/backups/${b.id}/download`}
                        data-view-ok="true"
                        className={`inline-flex h-9 items-center rounded-lg bg-zinc-100 px-3 text-xs font-bold text-zinc-900 hover:bg-white ${
                          !b.hasInlineData && !b.blobUrl ? "pointer-events-none opacity-40" : ""
                        }`}
                      >
                        הורדה
                      </a>
                    </div>
                  </div>
                  {open && (
                    <div className="border-t border-zinc-800/70 px-3 py-3 sm:px-4">
                      <div className="grid gap-1 text-xs text-zinc-400 sm:grid-cols-2">
                        <div>מזהה: <span className="font-mono text-zinc-300">{b.id}</span></div>
                        <div>סכמה: <span className="font-mono text-zinc-300">{b.schemaVersion ?? "?"}</span></div>
                        <div>קומיט: <span className="font-mono text-zinc-300">{b.appCommit?.slice(0, 10) ?? "—"}</span></div>
                        <div>גודל גולמי: {fmtBytes(b.rawBytes)}</div>
                        <div className="sm:col-span-2 break-all">SHA-256: <span className="font-mono text-zinc-300">{b.checksum}</span></div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {Object.entries(b.tableCounts)
                          .sort((a, z) => z[1] - a[1])
                          .map(([t, n]) => (
                            <span key={t} className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300">
                              {t} <span className="text-zinc-500">{n}</span>
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  tone: "ok" | "warn" | "neutral";
}) {
  const ring =
    tone === "ok"
      ? "border-emerald-700/40"
      : tone === "warn"
        ? "border-amber-700/50"
        : "border-zinc-800";
  const dot = tone === "ok" ? "bg-emerald-400" : tone === "warn" ? "bg-amber-400" : "bg-zinc-500";
  return (
    <div className={`rounded-2xl border bg-zinc-900 p-4 ${ring}`}>
      <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {title}
      </div>
      <div className="mt-2 text-lg font-black text-zinc-50 break-words">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}
