import { prisma } from "@/lib/prisma";

export async function getYamahRowsWithTotals() {
  const YAMAH_NAME = "ימ״ח";
  const yamah = await prisma.storageLocation.findUnique({ where: { name: YAMAH_NAME } });
  if (!yamah) throw new Error("ימ״ח לא נמצא במערכת.");

  const rows = await prisma.storageInventory.findMany({
    where: {
      locationId: yamah.id,
      equipmentItem: { active: true },
    },
    orderBy: { equipmentItem: { name: "asc" } },
    select: {
      id: true,
      quantity: true,
      equipmentItem: {
        select: {
          id: true,
          name: true,
          category: { select: { division: true } },
          assignments: {
            where: { active: true },
            select: { quantity: true, status: true },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const assignedHealthy = row.equipmentItem.assignments
      .filter((a) => a.status === "ASSIGNED")
      .reduce((sum, a) => sum + a.quantity, 0);
    const damaged = row.equipmentItem.assignments
      .filter((a) => a.status === "DAMAGED")
      .reduce((sum, a) => sum + a.quantity, 0);
    const used = row.equipmentItem.assignments
      .filter((a) => a.status === "USED")
      .reduce((sum, a) => sum + a.quantity, 0);
    const stolenOrLost = row.equipmentItem.assignments
      .filter((a) => a.status === "STOLEN" || a.status === "MISSING")
      .reduce((sum, a) => sum + a.quantity, 0);

    const inStorage = row.quantity;
    const total = assignedHealthy + damaged + used + stolenOrLost + inStorage;

    return {
      equipmentItemId: row.equipmentItem.id,
      equipmentItemName: row.equipmentItem.name,
      division: row.equipmentItem.category.division,
      inStorage,
      assignedHealthy,
      damaged,
      used,
      stolenOrLost,
      total,
    };
  });
}


