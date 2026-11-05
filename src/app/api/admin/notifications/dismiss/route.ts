import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const session = await requireWriteRole(Role.ADMIN);
    const userId = session.user.id;
    const body = (await request.json()) as { notificationId?: string };
    if (!body.notificationId) {
      return NextResponse.json({ error: "Missing notificationId" }, { status: 400 });
    }
    const res = await prisma.adminNotification.updateMany({
      where: { id: body.notificationId, NOT: { dismissedBy: { has: userId } } },
      data: { dismissedBy: { push: userId } },
    });
    return NextResponse.json({ success: true, updated: res.count });
  } catch (error) {
    console.error("Failed to dismiss notification:", error);
    return NextResponse.json({ error: "Failed to dismiss notification" }, { status: 500 });
  }
}
