/**
 * Set Inventory Script
 * Sets all items in Yamach storage to quantity 100
 * Usage: npx tsx scripts/set-inventory.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function setInventory() {
  console.log("🚀 Setting all inventory items to 100...\n");

  try {
    // Find Yamach storage location
    const yamah = await prisma.storageLocation.findFirst({
      where: { name: "ימ״ח", active: true },
    });

    if (!yamah) {
      console.error("❌ Yamach storage location not found!");
      process.exit(1);
    }

    console.log(`✅ Found Yamach storage location: ${yamah.name}\n`);

    // Get all equipment items
    const allItems = await prisma.equipmentItem.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
      },
    });

    console.log(`📦 Found ${allItems.length} active equipment items\n`);

    // Update or create inventory for each item using upsert (more efficient)
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

      console.log(`   ✅ Set: ${item.name} → 100`);
      processed++;
    }

    const result = { processed, total: allItems.length };

    console.log("\n✅ Inventory update completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   - Total items processed: ${result.processed}`);
    console.log(`   - All items now have quantity: 100\n`);
  } catch (error) {
    console.error("❌ Error during inventory update:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
setInventory();

