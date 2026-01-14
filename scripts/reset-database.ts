/**
 * Database Reset Script
 * Deletes all requests, assignments, and users except super admin
 * Usage: npx tsx scripts/reset-database.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log("🚀 Starting database reset...\n");

  try {
    // Find super admin (user with SUPER_ADMIN role)
    const superAdmin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" },
      select: { id: true, email: true, name: true },
    });

    if (!superAdmin) {
      console.error("❌ No super admin found! Aborting.");
      process.exit(1);
    }

    console.log(`✅ Found super admin: ${superAdmin.name} (${superAdmin.email})`);
    console.log("   This user will NOT be deleted.\n");

    // Delete all data in transaction
    const result = await prisma.$transaction(async (tx) => {
      // First, restore inventory from assignments before deleting them
      const allAssignments = await tx.assignment.findMany({
        where: { active: true },
        select: {
          equipmentItemId: true,
          quantity: true,
        },
      });

      // Find Yamach storage location
      const yamah = await tx.storageLocation.findFirst({
        where: { name: "ימ״ח", active: true },
      });

      if (yamah && allAssignments.length > 0) {
        // Group assignments by equipment item
        const itemQuantities = allAssignments.reduce((acc, assignment) => {
          acc[assignment.equipmentItemId] = (acc[assignment.equipmentItemId] || 0) + assignment.quantity;
          return acc;
        }, {} as Record<string, number>);

        // Restore each item to inventory
        let restoredItems = 0;
        for (const [equipmentItemId, quantity] of Object.entries(itemQuantities)) {
          const existing = await tx.storageInventory.findUnique({
            where: {
              locationId_equipmentItemId: {
                locationId: yamah.id,
                equipmentItemId,
              },
            },
          });

          if (existing) {
            await tx.storageInventory.update({
              where: {
                locationId_equipmentItemId: {
                  locationId: yamah.id,
                  equipmentItemId,
                },
              },
              data: {
                quantity: existing.quantity + quantity,
              },
            });
          } else {
            await tx.storageInventory.create({
              data: {
                locationId: yamah.id,
                equipmentItemId,
                quantity,
              },
            });
          }
          restoredItems += quantity;
        }
        console.log(`📦 Restored ${restoredItems} items to Yamach inventory`);
      }

      // Delete request items first (foreign key constraint)
      const requestItems = await tx.requestItem.deleteMany({});
      console.log(`🗑️  Deleted ${requestItems.count} request items`);

      // Delete requests
      const requests = await tx.request.deleteMany({});
      console.log(`🗑️  Deleted ${requests.count} requests`);

      // Delete assignments
      const assignments = await tx.assignment.deleteMany({});
      console.log(`🗑️  Deleted ${assignments.count} assignments`);

      // Delete all users except super admin
      const users = await tx.user.deleteMany({
        where: {
          id: { not: superAdmin.id },
        },
      });
      console.log(`🗑️  Deleted ${users.count} users (kept super admin)`);

      // Also delete audit logs for cleaner state (optional)
      const auditLogs = await tx.auditLog.deleteMany({
        where: {
          OR: [
            { entity: "REQUEST" },
            { entity: "REQUEST_ITEM" },
            { entity: "ASSIGNMENT" },
          ],
        },
      });
      console.log(`🗑️  Deleted ${auditLogs.count} related audit logs`);

      // Calculate restored items for summary
      const restoredItems = allAssignments.reduce((sum, a) => sum + a.quantity, 0);

      return {
        requestItems: requestItems.count,
        requests: requests.count,
        assignments: assignments.count,
        users: users.count,
        auditLogs: auditLogs.count,
        restoredItems,
      };
    });

    console.log("\n✅ Database reset completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   - Items restored to inventory: ${result.restoredItems}`);
    console.log(`   - Request items deleted: ${result.requestItems}`);
    console.log(`   - Requests deleted: ${result.requests}`);
    console.log(`   - Assignments deleted: ${result.assignments}`);
    console.log(`   - Users deleted: ${result.users}`);
    console.log(`   - Audit logs deleted: ${result.auditLogs}`);
    console.log(`\n🔒 Super admin preserved: ${superAdmin.name}\n`);
  } catch (error) {
    console.error("❌ Error during database reset:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
resetDatabase();

