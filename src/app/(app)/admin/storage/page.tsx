import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import StorageList from "./StorageList";

export const dynamic = "force-dynamic";

export default async function StoragePage() {
  await requireRole(Role.ADMIN);

  // We only care about YAMAH location
  const YAMAH_NAME = "ימ״ח";
  let yamah = await prisma.storageLocation.findUnique({
    where: { name: YAMAH_NAME },
  });

  if (!yamah) {
    yamah = await prisma.storageLocation.create({
      data: { name: YAMAH_NAME, active: true },
    });
  }

  const rows = await prisma.storageInventory.findMany({
    where: { 
      locationId: yamah.id,
      equipmentItem: { active: true }, // Only show active equipment items
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
            select: { 
              id: true,
              quantity: true,
              status: true,
              serialNumber: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  personalNumber: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Get box items with soldier details per equipment item
  const boxItems = await prisma.boxItem.findMany({
    select: {
      equipmentItemId: true,
      quantity: true,
      box: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
              personalNumber: true,
            },
          },
        },
      },
    },
  });

  const boxCountMap: Record<string, number> = {};
  const boxSoldiersMap: Record<string, Array<{ userId: string; name: string; personalNumber: string | null; quantity: number }>> = {};
  for (const bi of boxItems) {
    boxCountMap[bi.equipmentItemId] = (boxCountMap[bi.equipmentItemId] ?? 0) + bi.quantity;
    if (!boxSoldiersMap[bi.equipmentItemId]) {
      boxSoldiersMap[bi.equipmentItemId] = [];
    }
    boxSoldiersMap[bi.equipmentItemId].push({
      userId: bi.box.user.id,
      name: bi.box.user.name,
      personalNumber: bi.box.user.personalNumber,
      quantity: bi.quantity,
    });
  }

  // Calculate totals for each row
  const rowsWithTotals = rows.map((row) => {
    const assignedHealthy = row.equipmentItem.assignments
      .filter(a => a.status === "ASSIGNED")
      .reduce((sum, a) => sum + a.quantity, 0);
    
    const damaged = row.equipmentItem.assignments
      .filter(a => a.status === "DAMAGED")
      .reduce((sum, a) => sum + a.quantity, 0);
    
    const used = row.equipmentItem.assignments
      .filter(a => a.status === "USED")
      .reduce((sum, a) => sum + a.quantity, 0);
    
    const stolenOrLost = row.equipmentItem.assignments
      .filter(a => a.status === "STOLEN" || a.status === "MISSING")
      .reduce((sum, a) => sum + a.quantity, 0);

    const inStorage = row.quantity;
    const inBoxes = boxCountMap[row.equipmentItem.id] ?? 0;
    const total = assignedHealthy + damaged + used + stolenOrLost + inStorage + inBoxes;

    return {
      id: row.id,
      equipmentItem: {
        id: row.equipmentItem.id,
        name: row.equipmentItem.name,
        category: row.equipmentItem.category,
        assignments: row.equipmentItem.assignments,
      },
      inStorage,
      inBoxes,
      boxSoldiers: boxSoldiersMap[row.equipmentItem.id] ?? [],
      assignedHealthy,
      damaged,
      used,
      stolenOrLost,
      total,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">מלאי</h1>
        <p className="mt-2 text-sm text-zinc-400">סה״כ {rowsWithTotals.length} סוגי פריטים במחסן</p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <StorageList initialRows={rowsWithTotals} />
      </section>
    </div>
  );
}
