import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Starting to reset requests and assignments...");

  // First, restore inventory from assignments
  console.log("Restoring inventory from assignments...");
  
  const yamah = await prisma.storageLocation.findFirst({
    where: { name: "ימ״ח", active: true },
  });

  if (!yamah) {
    throw new Error("Storage location ימ״ח not found");
  }

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

  // Update storage inventory
  for (const [equipmentItemId, quantity] of inventoryMap.entries()) {
    const existingInventory = await prisma.storageInventory.findUnique({
      where: {
        locationId_equipmentItemId: {
          locationId: yamah.id,
          equipmentItemId: equipmentItemId,
        },
      },
    });

    if (existingInventory) {
      await prisma.storageInventory.update({
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
      console.log(`Restored ${quantity} units of item ${equipmentItemId} to storage`);
    } else {
      await prisma.storageInventory.create({
        data: {
          locationId: yamah.id,
          equipmentItemId: equipmentItemId,
          quantity: quantity,
        },
      });
      console.log(`Created new inventory record with ${quantity} units of item ${equipmentItemId}`);
    }
  }

  // Delete all assignments
  console.log("Deleting all assignments...");
  const deletedAssignments = await prisma.assignment.deleteMany({});
  console.log(`Deleted ${deletedAssignments.count} assignments`);

  // Delete all requests (this will cascade to request items)
  console.log("Deleting all requests...");
  const deletedRequests = await prisma.request.deleteMany({});
  console.log(`Deleted ${deletedRequests.count} requests`);

  // Delete all transfers (old model if it exists)
  try {
    const deletedTransfers = await prisma.transfer.deleteMany({});
    console.log(`Deleted ${deletedTransfers.count} transfers`);
  } catch (error) {
    console.log("No transfers to delete or transfer model not found");
  }

  console.log("✅ Reset complete!");
  console.log("- All assignments deleted and inventory restored");
  console.log("- All requests deleted");
  console.log("- Users preserved");
}

main()
  .catch((e) => {
    console.error("Error during reset:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

