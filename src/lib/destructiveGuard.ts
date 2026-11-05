import { NextResponse } from "next/server";
import { BackupKind, type Role } from "@prisma/client";
import { isPrivilegedOperator } from "@/lib/rbac";
import { createBackup } from "@/lib/backup";

/**
 * Shared gate for endpoints that wipe data (reset-database, fresh-reset).
 *
 * 1. Only SUPER_ADMIN / THEME_MASTER (privileged operators), never plain admins.
 * 2. Disabled unless ALLOW_DB_RESET=true is set in the environment. In production
 *    this variable should normally NOT exist, so the endpoints are inert.
 * 3. The request body must contain {"confirm":"RESET"} so a stray POST cannot fire it.
 * 4. A PRE_RESET backup of the whole database is written before anything is deleted.
 */
export async function guardDestructiveReset(
  req: Request,
  actorId: string,
  role: Role,
  label: string
): Promise<{ ok: true; backupId: string } | { ok: false; response: NextResponse }> {
  if (!isPrivilegedOperator(role)) {
    return { ok: false, response: NextResponse.json({ message: "אין הרשאה." }, { status: 403 }) };
  }
  if (process.env.ALLOW_DB_RESET !== "true") {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "איפוס מסד הנתונים מושבת. יש להגדיר ALLOW_DB_RESET=true בסביבה כדי לאפשר זאת." },
        { status: 403 }
      ),
    };
  }
  let confirm: unknown = null;
  try {
    const body = (await req.json()) as { confirm?: unknown };
    confirm = body?.confirm;
  } catch {
    /* no body */
  }
  if (confirm !== "RESET") {
    return {
      ok: false,
      response: NextResponse.json({ message: 'נדרש אישור מפורש: {"confirm":"RESET"}' }, { status: 400 }),
    };
  }
  const backup = await createBackup({
    kind: BackupKind.PRE_RESET,
    trigger: "pre-reset",
    actorId,
    label: `before ${label}`,
  });
  return { ok: true, backupId: backup.id };
}
