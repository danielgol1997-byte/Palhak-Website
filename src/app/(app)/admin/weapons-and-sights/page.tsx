import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { WeaponsAndSightsTabs } from "./WeaponsAndSightsTabs";

export const dynamic = "force-dynamic";

export default async function WeaponsAndSightsPage() {
  await requireRole(Role.ADMIN);

  // Fetch all weapons and sights assignments
  const [weaponAssignments, sightAssignments] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        active: true,
        status: "ASSIGNED",
        equipmentItem: {
          isWeapon: true,
        },
      },
      orderBy: [{ assignedAt: "desc" }],
      select: {
        id: true,
        quantity: true,
        serialNumber: true,
        assignedAt: true,
        status: true,
        user: {
          select: {
            id: true,
            name: true,
            personalNumber: true,
          },
        },
        equipmentItem: {
          select: {
            id: true,
            name: true,
            category: {
              select: {
                division: true,
              },
            },
          },
        },
        assignedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.assignment.findMany({
      where: {
        active: true,
        status: "ASSIGNED",
        equipmentItem: {
          isSight: true,
        },
      },
      orderBy: [{ assignedAt: "desc" }],
      select: {
        id: true,
        quantity: true,
        serialNumber: true,
        assignedAt: true,
        status: true,
        user: {
          select: {
            id: true,
            name: true,
            personalNumber: true,
          },
        },
        equipmentItem: {
          select: {
            id: true,
            name: true,
            category: {
              select: {
                division: true,
              },
            },
          },
        },
        assignedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">נשקים וצלמים</h1>
        <p className="mt-2 text-sm text-zinc-400">מעקב אחר נשקים וצלמים מוקצים</p>
      </section>

      <WeaponsAndSightsTabs
        weaponAssignments={weaponAssignments}
        sightAssignments={sightAssignments}
      />
    </div>
  );
}

