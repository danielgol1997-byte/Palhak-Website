import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireRole(Role.ADMIN);
    const userId = session.user.id;

    // Fetch notifications that this admin hasn't dismissed
    const notifications = await prisma.adminNotification.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    // Filter out notifications this admin has dismissed
    const filteredNotifications = notifications.filter(
      (n) => !n.dismissedBy.includes(userId)
    );

    // Count unviewed notifications (not in viewedBy array)
    const unviewedCount = filteredNotifications.filter(
      (n) => !n.viewedBy.includes(userId)
    ).length;

    return NextResponse.json({ 
      notifications: filteredNotifications,
      unviewedCount 
    });
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json({ notifications: [], unviewedCount: 0 }, { status: 500 });
  }
}
