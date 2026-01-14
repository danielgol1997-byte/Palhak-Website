import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Admin-only API endpoint to perform fresh reset:
 * - Deletes all assignments
 * - Deletes all requests (cascades to request items)
 * - Deletes all transfers
 * - Sets all inventory to 100
 * - Deletes related audit logs
 * - Preserves all users, roles, items, and units
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ message: "לא מחובר." }, { status: 401 });
  }

  if (session.user.role === Role.USER) {
    return NextResponse.json({ message: "אין הרשאה." }, { status: 403 });
  }

  try {
    console.log("🚀 Starting fresh database reset...");

    // Find Yamach storage location
    const yamah = await prisma.storageLocation.findFirst({
      where: { name: "ימ״ח", active: true },
    });

    if (!yamah) {
      return NextResponse.json(
        { message: "מיקום אחסון ימ״ח לא נמצא." },
        { status: 500 }
      );
    }

    // Perform reset in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete all request items first (foreign key constraint)
      const requestItems = await tx.requestItem.deleteMany({});

      // Delete all requests
      const requests = await tx.request.deleteMany({});

      // Delete all assignments
      const assignments = await tx.assignment.deleteMany({});

      // Delete all transfers
      let deletedTransfers = 0;
      try {
        const transfers = await tx.transfer.deleteMany({});
        deletedTransfers = transfers.count;
      } catch (error) {
        // Transfer model might not exist or have issues, ignore
        console.log("No transfers to delete or transfer model not found");
      }

      // Delete related audit logs
      const auditLogs = await tx.auditLog.deleteMany({
        where: {
          OR: [
            { entity: "REQUEST" },
            { entity: "REQUEST_ITEM" },
            { entity: "ASSIGNMENT" },
            { entity: "TRANSFER" },
          ],
        },
      });

      // Get all active equipment items
      const allItems = await tx.equipmentItem.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
        },
      });

      // Set all inventory to 100
      let processed = 0;
      for (const item of allItems) {
        await tx.storageInventory.upsert({
          where: {
            locationId_equipmentItemId: {
              locationId: yamah.id,
              equipmentItemId: item.id,
            },
          },
          create: {
            locationId: yamah.id,
            equipmentItemId: item.id,
            quantity: 100,
          },
          update: {
            quantity: 100,
          },
        });
        processed++;
      }

      return {
        requestItems: requestItems.count,
        requests: requests.count,
        assignments: assignments.count,
        transfers: deletedTransfers,
        auditLogs: auditLogs.count,
        inventoryItems: processed,
      };
    });

    console.log("✅ Fresh reset completed successfully!");
    console.log("📊 Summary:", result);

    return NextResponse.json({
      success: true,
      message: "איפוס מסד הנתונים הושלם בהצלחה",
      summary: {
        deletedRequestItems: result.requestItems,
        deletedRequests: result.requests,
        deletedAssignments: result.assignments,
        deletedTransfers: result.transfers,
        deletedAuditLogs: result.auditLogs,
        inventoryItemsSetTo100: result.inventoryItems,
      },
    });
  } catch (error) {
    console.error("❌ Error during fresh reset:", error);
    return NextResponse.json(
      {
        success: false,
        message: "שגיאה באיפוס מסד הנתונים",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

