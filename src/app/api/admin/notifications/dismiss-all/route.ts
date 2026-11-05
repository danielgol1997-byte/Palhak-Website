import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function POST() {
  try {
    const session = await requireWriteRole(Role.ADMIN);
    const userId = session.user.id;
    const res = await prisma.adminNotification.updateMany({
      where: { NOT: { dismissedBy: { has: userId } } },
      data: { dismissedBy: { push: userId } },
    });
    return NextResponse.json({ success: true, updated: res.count });
  } catch (error) {
    console.error("Failed to dismiss all notifications:", error);
    return NextResponse.json({ error: "Failed to dismiss notifications" }, { status: 500 });
  }
}
