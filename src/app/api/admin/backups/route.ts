import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { BackupKind } from "@prisma/client";
import { authOptions } from "@/auth";
import { isPrivilegedOperator } from "@/lib/rbac";
import { blobConfigured, createBackup, listBackups, pruneBackups, RETENTION } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function requirePrivileged() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: NextResponse.json({ message: "לא מחובר." }, { status: 401 }) };
  if (!isPrivilegedOperator(session.user.role)) {
    return { error: NextResponse.json({ message: "אין הרשאה." }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const { error } = await requirePrivileged();
  if (error) return error;
  let backups: Awaited<ReturnType<typeof listBackups>> = [];
  try {
    backups = await listBackups(200);
  } catch (e) {
    return NextResponse.json(
      { message: "טבלת הגיבויים לא קיימת – יש להריץ npx prisma migrate deploy", error: e instanceof Error ? e.message : String(e) },
      { status: 503 }
    );
  }
  return NextResponse.json({
    backups,
    blobConfigured: blobConfigured(),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    retentionDays: Object.fromEntries(Object.entries(RETENTION).map(([k, v]) => [k, v.days])),
  });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requirePrivileged();
  if (error) return error;
  let label: string | null = null;
  try {
    const body = (await req.json()) as { label?: string };
    if (typeof body.label === "string") label = body.label.trim().slice(0, 120) || null;
  } catch {
    /* no body */
  }
  const result = await createBackup({
    kind: BackupKind.MANUAL,
    trigger: "manual",
    actorId: session!.user.id,
    label,
  });
  await pruneBackups();
  return NextResponse.json({ ok: true, ...result });
}
