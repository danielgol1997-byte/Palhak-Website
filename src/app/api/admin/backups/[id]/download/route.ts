import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { isPrivilegedOperator } from "@/lib/rbac";
import { getBackupBytes } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "לא מחובר." }, { status: 401 });
  if (!isPrivilegedOperator(session.user.role)) {
    return NextResponse.json({ message: "אין הרשאה." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const bytes = await getBackupBytes(id);
  if (!bytes) return NextResponse.json({ message: "הגיבוי לא נמצא או שהנתונים שלו נמחקו." }, { status: 404 });

  const stamp = bytes.createdAt.toISOString().replace(/[:.]/g, "-");
  const filename = `palhak-backup-${bytes.kind.toLowerCase()}-${stamp}.json.gz`;
  return new NextResponse(new Uint8Array(bytes.gz), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.gz.length),
      "Cache-Control": "no-store",
      "X-Backup-Checksum": bytes.checksum,
    },
  });
}
