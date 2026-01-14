import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { Role } from "@prisma/client";

export async function requireAdminExportSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false as const, response: NextResponse.json({ message: "לא מחובר." }, { status: 401 }) };
  }
  if (session.user.role === Role.USER) {
    return { ok: false as const, response: NextResponse.json({ message: "אין הרשאה." }, { status: 403 }) };
  }
  return { ok: true as const, session };
}


