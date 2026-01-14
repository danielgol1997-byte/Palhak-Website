/**
 * Fresh Reset Script
 * Deletes all assignments and requests, sets all inventory to 100
 * Preserves users, roles, items, and units
 * Usage: npx tsx scripts/fresh-reset.ts
 */

import { prisma } from "../src/lib/prisma";

async function freshReset() {
  console.log("🚀 Starting fresh database reset...\n");

  try {
    // Find Yamach storage location
    const yamah = await prisma.storageLocation.findFirst({
      where: { name: "ימ״ח", active: true },
    });

    if (!yamah) {
      throw new Error("Storage location ימ״ח not found");
    }

    console.log(`✅ Found Yamach storage location: ${yamah.name}\n`);

    // First transaction: Delete all data
    const deleteResult = await prisma.$transaction(async (tx) => {
      // Delete all request items first (foreign key constraint)
      const requestItems = await tx.requestItem.deleteMany({});
      console.log(`🗑️  Deleted ${requestItems.count} request items`);

      // Delete all requests
      const requests = await tx.request.deleteMany({});
      console.log(`🗑️  Deleted ${requests.count} requests`);

      // Delete all assignments
      const assignments = await tx.assignment.deleteMany({});
      console.log(`🗑️  Deleted ${assignments.count} assignments`);

      // Delete all transfers
      let deletedTransfers = 0;
      try {
        const transfers = await tx.transfer.deleteMany({});
        deletedTransfers = transfers.count;
        console.log(`🗑️  Deleted ${deletedTransfers} transfers`);
      } catch (error) {
        console.log("   (No transfers to delete or transfer model not found)");
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
      console.log(`🗑️  Deleted ${auditLogs.count} related audit logs`);

      return {
        requestItems: requestItems.count,
        requests: requests.count,
        assignments: assignments.count,
        transfers: deletedTransfers,
        auditLogs: auditLogs.count,
      };
    }, {
      timeout: 30000, // 30 second timeout
    });

    // Get all active equipment items
    const allItems = await prisma.equipmentItem.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
      },
    });

    console.log(`\n📦 Setting inventory to 100 for ${allItems.length} items...`);

    // Second operation: Set all inventory to 100 (outside transaction to avoid timeout)
    let processed = 0;
    for (const item of allItems) {
      await prisma.storageInventory.upsert({
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
      if (processed % 20 === 0) {
        console.log(`   Processed ${processed}/${allItems.length} items...`);
      }
    }

    console.log(`✅ Set inventory to 100 for ${processed} items`);

    const result = {
      ...deleteResult,
      inventoryItems: processed,
    };

    console.log("\n✅ Fresh reset completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   - Request items deleted: ${result.requestItems}`);
    console.log(`   - Requests deleted: ${result.requests}`);
    console.log(`   - Assignments deleted: ${result.assignments}`);
    console.log(`   - Transfers deleted: ${result.transfers}`);
    console.log(`   - Audit logs deleted: ${result.auditLogs}`);
    console.log(`   - Inventory items set to 100: ${result.inventoryItems}`);
    console.log("\n✅ Users, roles, items, and units preserved\n");
  } catch (error) {
    console.error("❌ Error during fresh reset:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
freshReset();

