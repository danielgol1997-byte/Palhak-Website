import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { UserDetailTabs } from "./UserDetailTabs";

export const dynamic = "force-dynamic";

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  await requireRole(Role.ADMIN);

  const [user, departments, positions, activeEquipmentItems, unitTemplates, boxTemplate, userBox, transferTargets] =
    await Promise.all([
    prisma.user.findUnique({
      where: { id: resolvedParams.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        personalNumber: true,
        phoneNumber: true,
        firstName: true,
        lastName: true,
        shirtSize: true,
        pantsSize: true,
        shoeSize: true,
        weaponItemId: true,
        onboardedAt: true,
        createdAt: true,
        userDepartments: { 
          select: { 
            departmentId: true,
            department: {
              select: { name: true }
            }
          } 
        },
        userPositions: { 
          select: { 
            positionId: true,
            position: {
              select: { name: true }
            }
          } 
        },
        assignments: {
          where: { active: true, status: "ASSIGNED" },
          select: {
            id: true,
            quantity: true,
            serialNumber: true,
            assignedAt: true,
            equipmentItem: {
              select: {
                id: true,
                name: true,
                isWeapon: true,
                isSight: true,
                isClothing: true,
                isShoe: true,
                category: {
                  select: { division: true, name: true },
                },
              },
            },
          },
          orderBy: { assignedAt: "desc" },
        },
      },
    }),
    prisma.department.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.position.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, departmentId: true },
    }),
    prisma.equipmentItem.findMany({
      where: { active: true, discontinued: false },
      select: {
        id: true,
        name: true,
        isWeapon: true,
        isSight: true,
        isClothing: true,
        isShoe: true,
        category: {
          select: { division: true, name: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.unitTemplate.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        items: {
          select: {
            equipmentItemId: true,
            quantityRequired: true,
            equipmentItem: {
              select: {
                id: true,
                name: true,
                isWeapon: true,
                isSight: true,
                isClothing: true,
                isShoe: true,
                category: {
                  select: { division: true, name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.boxTemplate.findFirst({
      select: {
        id: true,
        items: {
          select: {
            equipmentItemId: true,
            quantity: true,
            equipmentItem: {
              select: { id: true, name: true },
            },
            alternatives: {
              select: {
                equipmentItemId: true,
                equipmentItem: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.box.findUnique({
      where: { userId: resolvedParams.id },
      select: {
        id: true,
        items: {
          select: {
            id: true,
            equipmentItemId: true,
            quantity: true,
            serialNumber: true,
            movedAt: true,
            equipmentItem: {
              select: {
                id: true,
                name: true,
                category: { select: { division: true, name: true } },
              },
            },
          },
          orderBy: { movedAt: "desc" },
        },
      },
    }),
    prisma.user.findMany({
      where: { active: true, id: { not: resolvedParams.id } },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, personalNumber: true },
    }),
  ]);

  const yamahLoc = await prisma.storageLocation.findFirst({
    where: { name: "ימ״ח", active: true },
    select: { id: true },
  });
  const yamahStockRows = yamahLoc
    ? await prisma.storageInventory.findMany({
        where: { locationId: yamahLoc.id },
        select: { equipmentItemId: true, quantity: true },
      })
    : [];
  const yamahStockByItemId: Record<string, number> = Object.fromEntries(
    yamahStockRows.map((r) => [r.equipmentItemId, r.quantity]),
  );

  if (!user) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">משתמש לא נמצא</h1>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <a
          href="/admin/users"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-800 px-4 text-sm font-bold text-zinc-100 transition-all hover:bg-zinc-700 cursor-pointer mb-4"
        >
          ← חזרה למשתמשים
        </a>
        <h1 className="text-2xl font-bold text-zinc-50">{user.name}</h1>
        <div className="mt-1 text-sm text-zinc-400">{user.email}</div>
        <div className="mt-2 text-sm text-zinc-400">
          {user.personalNumber ? `מ״א: ${user.personalNumber}` : "אין מספר אישי"}
        </div>
      </section>

      <UserDetailTabs
        user={user}
        departments={departments}
        positions={positions}
        availableEquipment={activeEquipmentItems}
        unitTemplates={unitTemplates}
        boxTemplate={boxTemplate}
        userBox={userBox}
        transferTargets={transferTargets}
        yamahStockByItemId={yamahStockByItemId}
      />
    </div>
  );
}

