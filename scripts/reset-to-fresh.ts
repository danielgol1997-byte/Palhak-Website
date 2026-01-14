import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Starting fresh system reset...\n");

  // 1. Delete all request items first (due to foreign key)
  console.log("Deleting all request items...");
  const deletedRequestItems = await prisma.requestItem.deleteMany({});
  console.log(`✓ Deleted ${deletedRequestItems.count} request items`);

  // 2. Delete all requests
  console.log("Deleting all requests...");
  const deletedRequests = await prisma.request.deleteMany({});
  console.log(`✓ Deleted ${deletedRequests.count} requests`);

  // 3. Delete all assignments
  console.log("Deleting all assignments...");
  const deletedAssignments = await prisma.assignment.deleteMany({});
  console.log(`✓ Deleted ${deletedAssignments.count} assignments`);

  // 4. Get YAMAH location
  console.log("\nSetting up storage inventory...");
  const YAMAH_NAME = "ימ״ח";
  let yamah = await prisma.storageLocation.findUnique({
    where: { name: YAMAH_NAME },
  });

  if (!yamah) {
    yamah = await prisma.storageLocation.create({
      data: { name: YAMAH_NAME, active: true },
    });
    console.log(`✓ Created ${YAMAH_NAME} storage location`);
  } else {
    console.log(`✓ Found ${YAMAH_NAME} storage location`);
  }

  // 5. Get all active equipment items
  const allItems = await prisma.equipmentItem.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });
  console.log(`✓ Found ${allItems.length} active equipment items`);

  // 6. Update or create storage inventory for each item
  console.log("\nSetting all items to quantity 100...");
  let updated = 0;
  let created = 0;

  for (const item of allItems) {
    const existing = await prisma.storageInventory.findUnique({
      where: {
        locationId_equipmentItemId: {
          locationId: yamah.id,
          equipmentItemId: item.id,
        },
      },
    });

    if (existing) {
      await prisma.storageInventory.update({
        where: { id: existing.id },
        data: { quantity: 100 },
      });
      updated++;
    } else {
      await prisma.storageInventory.create({
        data: {
          locationId: yamah.id,
          equipmentItemId: item.id,
          quantity: 100,
        },
      });
      created++;
    }
  }

  console.log(`✓ Updated ${updated} existing storage records`);
  console.log(`✓ Created ${created} new storage records`);

  console.log("\n✅ Fresh system reset complete!");
  console.log("\nSummary:");
  console.log(`  - 0 assignments`);
  console.log(`  - 0 requests`);
  console.log(`  - ${allItems.length} items @ 100 units each in storage`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


