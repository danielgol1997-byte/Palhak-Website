import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { isPrivilegedOperator } from "@/lib/rbac";
import { verifyBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "לא מחובר." }, { status: 401 });
  if (!isPrivilegedOperator(session.user.role)) {
    return NextResponse.json({ message: "אין הרשאה." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const result = await verifyBackup(id);
  return NextResponse.json(result);
}
