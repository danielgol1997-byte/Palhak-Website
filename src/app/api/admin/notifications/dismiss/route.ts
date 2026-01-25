import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    await requireRole(Role.ADMIN);

    const body = await request.json();
    const { notificationId } = body;

    if (!notificationId) {
      return NextResponse.json({ error: "Missing notificationId" }, { status: 400 });
    }

    await prisma.adminNotification.update({
      where: { id: notificationId },
      data: { dismissed: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to dismiss notification:", error);
    return NextResponse.json({ error: "Failed to dismiss notification" }, { status: 500 });
  }
}
