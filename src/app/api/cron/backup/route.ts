import { NextResponse, type NextRequest } from "next/server";
import { createBackup, hoursSinceLastAutomaticBackup, kindForDate, pruneBackups } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily automatic backup, scheduled in vercel.json.
 *
 * Authorization:
 *  - If CRON_SECRET is set, the request must carry `Authorization: Bearer <CRON_SECRET>`
 *    (Vercel adds this header automatically to cron invocations).
 *  - Otherwise we accept only Vercel's cron user agent and refuse to run more than
 *    once per 20 hours, so an unauthenticated hit cannot spam backups.
 */
function authorized(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret) {
    return auth === `Bearer ${secret}` ? { ok: true } : { ok: false, reason: "bad secret" };
  }
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua.startsWith("vercel-cron")) return { ok: false, reason: "not a cron request" };
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const auth = authorized(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: 401 });

  const force = req.nextUrl.searchParams.get("force") === "1" && Boolean(process.env.CRON_SECRET);
  const hours = await hoursSinceLastAutomaticBackup();
  if (!force && hours < 20) {
    return NextResponse.json({ ok: true, skipped: true, reason: `last automatic backup ${hours.toFixed(1)}h ago` });
  }

  const started = Date.now();
  const result = await createBackup({ kind: kindForDate(), trigger: "cron" });
  const pruned = await pruneBackups();

  return NextResponse.json({
    ok: true,
    backupId: result.id,
    kind: result.kind,
    sizeBytes: result.sizeBytes,
    totalRows: result.totalRows,
    mirrored: Boolean(result.blobUrl),
    mirrorError: result.mirrorError,
    pruned: pruned.length,
    ms: Date.now() - started,
  });
}
