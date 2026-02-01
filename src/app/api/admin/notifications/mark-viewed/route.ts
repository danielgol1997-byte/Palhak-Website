import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function POST() {
  try {
    const session = await requireRole(Role.ADMIN);
    const userId = session.user.id;

    // Get all notifications that this admin hasn't viewed yet
    const notifications = await prisma.adminNotification.findMany();
    
    const notViewedByUser = notifications.filter(
      (n) => !n.viewedBy.includes(userId) && !n.dismissedBy.includes(userId)
    );

    // Mark all as viewed by this admin
    await Promise.all(
      notViewedByUser.map((notification) =>
        prisma.adminNotification.update({
          where: { id: notification.id },
          data: {
            viewedBy: {
              push: userId,
            },
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to mark notifications as viewed:", error);
    return NextResponse.json({ error: "Failed to mark as viewed" }, { status: 500 });
  }
}
