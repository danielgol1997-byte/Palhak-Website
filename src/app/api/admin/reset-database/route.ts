import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Admin-only API endpoint to reset database:
 * - Deletes all assignments
 * - Deletes all requests (cascades to request items)
 * - Restores inventory from assignments
 * - Preserves all users and their roles
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
    console.log("🚀 Starting database reset...");

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

    // Get all active assignments before deleting
    const assignments = await prisma.assignment.findMany({
      where: { active: true },
      select: {
        equipmentItemId: true,
        quantity: true,
      },
    });

    // Group by equipment item and sum quantities
    const inventoryMap = new Map<string, number>();
    for (const assignment of assignments) {
      const current = inventoryMap.get(assignment.equipmentItemId) || 0;
      inventoryMap.set(assignment.equipmentItemId, current + assignment.quantity);
    }

    // Perform reset in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Restore inventory from assignments
      let restoredItems = 0;
      for (const [equipmentItemId, quantity] of inventoryMap.entries()) {
        const existingInventory = await tx.storageInventory.findUnique({
          where: {
            locationId_equipmentItemId: {
              locationId: yamah.id,
              equipmentItemId: equipmentItemId,
            },
          },
        });

        if (existingInventory) {
          await tx.storageInventory.update({
            where: {
              locationId_equipmentItemId: {
                locationId: yamah.id,
                equipmentItemId: equipmentItemId,
              },
            },
            data: {
              quantity: existingInventory.quantity + quantity,
            },
          });
        } else {
          await tx.storageInventory.create({
            data: {
              locationId: yamah.id,
              equipmentItemId: equipmentItemId,
              quantity: quantity,
            },
          });
        }
        restoredItems += quantity;
      }

      // Delete all request items first (foreign key constraint)
      const requestItems = await tx.requestItem.deleteMany({});

      // Delete all requests
      const requests = await tx.request.deleteMany({});

      // Delete all assignments
      const deletedAssignments = await tx.assignment.deleteMany({});

      // Delete all transfers (old model if it exists)
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

      return {
        requestItems: requestItems.count,
        requests: requests.count,
        assignments: deletedAssignments.count,
        transfers: deletedTransfers,
        auditLogs: auditLogs.count,
        restoredItems,
      };
    });

    console.log("✅ Database reset completed successfully!");
    console.log("📊 Summary:", result);

    return NextResponse.json({
      success: true,
      message: "איפוס מסד הנתונים הושלם בהצלחה",
      summary: {
        restoredItems: result.restoredItems,
        deletedRequestItems: result.requestItems,
        deletedRequests: result.requests,
        deletedAssignments: result.assignments,
        deletedTransfers: result.transfers,
        deletedAuditLogs: result.auditLogs,
      },
    });
  } catch (error) {
    console.error("❌ Error during database reset:", error);
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

