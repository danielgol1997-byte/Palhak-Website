import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(Role.ADMIN);
    const userId = session.user.id;

    const body = await request.json();
    const { notificationId } = body;

    if (!notificationId) {
      return NextResponse.json({ error: "Missing notificationId" }, { status: 400 });
    }

    // Add this admin to the dismissedBy array
    const notification = await prisma.adminNotification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    // If not already dismissed by this user, add them
    if (!notification.dismissedBy.includes(userId)) {
      await prisma.adminNotification.update({
        where: { id: notificationId },
        data: {
          dismissedBy: {
            push: userId,
          },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to dismiss notification:", error);
    return NextResponse.json({ error: "Failed to dismiss notification" }, { status: 500 });
  }
}
