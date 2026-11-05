import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/notifications            -> list (not dismissed by me) + unviewed count
 * GET /api/admin/notifications?count=1    -> unviewed count only (cheap poll)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireRole(Role.ADMIN);
    const userId = session.user.id;
    const countOnly = req.nextUrl.searchParams.get("count") === "1";

    const unviewedCount = await prisma.adminNotification.count({
      where: {
        NOT: { dismissedBy: { has: userId } },
        AND: { NOT: { viewedBy: { has: userId } } },
      },
    });

    if (countOnly) {
      return NextResponse.json({ unviewedCount }, { headers: { "Cache-Control": "no-store" } });
    }

    const notifications = await prisma.adminNotification.findMany({
      where: { NOT: { dismissedBy: { has: userId } } },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        requestId: true,
        requestType: true,
        requesterName: true,
        itemsSummary: true,
        createdAt: true,
        viewedBy: true,
      },
    });

    return NextResponse.json(
      {
        notifications: notifications.map((n) => ({
          id: n.id,
          requestId: n.requestId,
          requestType: n.requestType,
          requesterName: n.requesterName,
          itemsSummary: n.itemsSummary,
          createdAt: n.createdAt,
          viewed: n.viewedBy.includes(userId),
        })),
        unviewedCount,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json({ notifications: [], unviewedCount: 0 }, { status: 500 });
  }
}
