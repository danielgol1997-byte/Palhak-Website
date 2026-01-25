import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    await requireRole(Role.ADMIN);

    const body = await request.json();
    const { notificationIds } = body;

    if (!Array.isArray(notificationIds)) {
      return NextResponse.json({ error: "Missing notificationIds array" }, { status: 400 });
    }

    await prisma.adminNotification.updateMany({
      where: {
        id: {
          in: notificationIds,
        },
      },
      data: { dismissed: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to dismiss all notifications:", error);
    return NextResponse.json({ error: "Failed to dismiss notifications" }, { status: 500 });
  }
}
