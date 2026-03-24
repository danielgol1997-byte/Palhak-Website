import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { BoxList } from "./BoxList";

export const dynamic = "force-dynamic";

export default async function BoxesPage() {
  await requireRole(Role.ADMIN);

  const boxTemplate = await prisma.boxTemplate.findFirst({
    select: {
      id: true,
      items: {
        select: {
          equipmentItemId: true,
          quantity: true,
          equipmentItem: {
            select: {
              id: true,
              name: true,
              category: { select: { division: true, name: true } },
            },
          },
          alternatives: {
            select: {
              equipmentItemId: true,
              equipmentItem: {
                select: { id: true, name: true },
              },
            },
          },
        },
      },
    },
  });

  if (!boxTemplate || boxTemplate.items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-zinc-50">קרטונים</h1>
          <p className="mt-2 text-sm text-zinc-400">ניהול קרטוני ציוד לחיילים.</p>
        </section>
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <div className="py-10 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-3xl border border-zinc-800 border-dashed">
            יש להגדיר תבנית קרטון תחילה.
            <a href="/admin/inventory/box-template" className="text-amber-400 hover:underline mr-1">הגדר תבנית</a>
          </div>
        </section>
      </div>
    );
  }

  const totalTemplateQuantity = boxTemplate.items.reduce((s, i) => s + i.quantity, 0);

  const boxes = await prisma.box.findMany({
    select: {
      id: true,
      userId: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          personalNumber: true,
          active: true,
          userDepartments: {
            select: { department: { select: { name: true } } },
          },
        },
      },
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
      },
    },
    orderBy: { user: { name: "asc" } },
  });

  const userIds = boxes.map((b) => b.userId);
  const assignments = await prisma.assignment.findMany({
    where: { userId: { in: userIds }, active: true },
    select: {
      userId: true,
      equipmentItemId: true,
      quantity: true,
      status: true,
      serialNumber: true,
    },
  });

  const allActiveUsers = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, personalNumber: true },
    orderBy: { name: "asc" },
  });

  const YAMAH_NAME = "ימ״ח";
  const yamah = await prisma.storageLocation.findUnique({ where: { name: YAMAH_NAME } });
  let storageMap: Record<string, number> = {};
  if (yamah) {
    const storageRows = await prisma.storageInventory.findMany({
      where: { locationId: yamah.id },
      select: { equipmentItemId: true, quantity: true },
    });
    storageMap = Object.fromEntries(storageRows.map((r) => [r.equipmentItemId, r.quantity]));
  }

  const assignmentsByUser: Record<string, typeof assignments> = {};
  for (const a of assignments) {
    if (!assignmentsByUser[a.userId]) assignmentsByUser[a.userId] = [];
    assignmentsByUser[a.userId].push(a);
  }

  const boxRows = boxes.map((box) => {
    const inBoxTotal = box.items.reduce((s, i) => s + i.quantity, 0);
    const userAssignments = assignmentsByUser[box.userId] ?? [];

    const templateStatus = boxTemplate.items.map((tplItem) => {
      const groupIds = [
        tplItem.equipmentItemId,
        ...tplItem.alternatives.map((a) => a.equipmentItemId),
      ];
      const groupIdSet = new Set(groupIds);

      const boxItems = box.items.filter((bi) => groupIdSet.has(bi.equipmentItemId));
      const inBox = boxItems.reduce((s, bi) => s + bi.quantity, 0);
      const missing = Math.max(0, tplItem.quantity - inBox);

      const altNames = tplItem.alternatives.map((a) => a.equipmentItem.name);
      const displayName = altNames.length > 0
        ? `${tplItem.equipmentItem.name} (+ ${altNames.length} חלופות)`
        : tplItem.equipmentItem.name;

      let missingReason: string | null = null;
      if (missing > 0) {
        const userItemAssignments = userAssignments.filter(
          (a) => groupIdSet.has(a.equipmentItemId)
        );
        const assigned = userItemAssignments
          .filter((a) => a.status === "ASSIGNED")
          .reduce((s, a) => s + a.quantity, 0);
        const stolen = userItemAssignments
          .filter((a) => a.status === "STOLEN" || a.status === "MISSING")
          .reduce((s, a) => s + a.quantity, 0);
        const damaged = userItemAssignments
          .filter((a) => a.status === "DAMAGED")
          .reduce((s, a) => s + a.quantity, 0);
        const used = userItemAssignments
          .filter((a) => a.status === "USED")
          .reduce((s, a) => s + a.quantity, 0);

        if (assigned > 0) missingReason = "אצל החייל";
        else if (stolen > 0) missingReason = "אבד/נגנב";
        else if (damaged > 0) missingReason = "בלאי";
        else if (used > 0) missingReason = "שומש";
        else missingReason = "לא הוקצה";
      }

      const groupStorageTotal = groupIds.reduce((s, id) => s + (storageMap[id] ?? 0), 0);

      return {
        equipmentItemId: tplItem.equipmentItemId,
        name: displayName,
        required: tplItem.quantity,
        inBox,
        missing,
        missingReason,
        inStorage: groupStorageTotal,
      };
    });

    return {
      id: box.id,
      userId: box.userId,
      userName: box.user.name,
      personalNumber: box.user.personalNumber,
      department: box.user.userDepartments[0]?.department.name ?? null,
      userActive: box.user.active,
      createdAt: box.createdAt,
      inBoxTotal,
      totalRequired: totalTemplateQuantity,
      templateStatus,
      items: box.items.map((i) => ({
        id: i.id,
        equipmentItemId: i.equipmentItemId,
        quantity: i.quantity,
        serialNumber: i.serialNumber,
        movedAt: i.movedAt,
        equipmentItem: { id: i.equipmentItem.id, name: i.equipmentItem.name },
      })),
    };
  });

  const templateItemsForAdd = boxTemplate.items.map((tplItem) => ({
    equipmentItemId: tplItem.equipmentItemId,
    equipmentItemName: tplItem.equipmentItem.name,
    quantity: tplItem.quantity,
    alternatives: tplItem.alternatives.map((a) => ({
      equipmentItemId: a.equipmentItemId,
      equipmentItemName: a.equipmentItem.name,
    })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">קרטונים</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {boxRows.length} קרטונים | תבנית: {boxTemplate.items.length} סוגי פריטים ({totalTemplateQuantity} יחידות)
        </p>
      </section>
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <BoxList rows={boxRows} allUsers={allActiveUsers} templateItemsForAdd={templateItemsForAdd} yamahStockByItemId={storageMap} />
      </section>
    </div>
  );
}
