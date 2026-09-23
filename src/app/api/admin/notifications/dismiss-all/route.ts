import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function POST() {
  try {
    const session = await requireWriteRole(Role.ADMIN);
    const userId = session.user.id;

    // Get all notifications not dismissed by this admin
    const notifications = await prisma.adminNotification.findMany();
    const notDismissedByUser = notifications.filter(
      (n) => !n.dismissedBy.includes(userId)
    );

    // Add this admin to dismissedBy for all notifications
    await Promise.all(
      notDismissedByUser.map((notification) =>
        prisma.adminNotification.update({
          where: { id: notification.id },
          data: {
            dismissedBy: {
              push: userId,
            },
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to dismiss all notifications:", error);
    return NextResponse.json({ error: "Failed to dismiss notifications" }, { status: 500 });
  }
}
