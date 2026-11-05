import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function POST() {
  try {
    const session = await requireWriteRole(Role.ADMIN);
    const userId = session.user.id;
    // One statement instead of N updates
    const res = await prisma.adminNotification.updateMany({
      where: {
        NOT: { viewedBy: { has: userId } },
        AND: { NOT: { dismissedBy: { has: userId } } },
      },
      data: { viewedBy: { push: userId } },
    });
    return NextResponse.json({ success: true, updated: res.count });
  } catch (error) {
    console.error("Failed to mark notifications as viewed:", error);
    return NextResponse.json({ error: "Failed to mark as viewed" }, { status: 500 });
  }
}
