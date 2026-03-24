import { prisma } from "@/lib/prisma";

export type BoxSlotColumn = {
  /** Stable id for column (template primary equipment id) */
  equipmentItemId: string;
  header: string;
  requiredQty: number;
  groupIds: string[];
};

export type BoxMatrixUserRow = {
  userId: string;
  name: string;
  personalNumber: string;
  inBoxTotal: number;
  totalRequired: number;
  fillRatio: number;
  /** Per slot: quantity in box for that template group */
  slotQty: number[];
};

export async function fetchBoxMatrixExport(): Promise<{
  slots: BoxSlotColumn[];
  users: BoxMatrixUserRow[];
} | null> {
  const tpl = await prisma.boxTemplate.findFirst({
    include: {
      items: {
        include: {
          equipmentItem: true,
          alternatives: { include: { equipmentItem: true } },
        },
      },
    },
  });

  if (!tpl?.items.length) return null;

  const slots: BoxSlotColumn[] = tpl.items.map((item) => {
    const groupIds = [
      item.equipmentItemId,
      ...item.alternatives.map((a) => a.equipmentItemId),
    ];
    const altNames = item.alternatives.map((a) => a.equipmentItem.name);
    const header =
      altNames.length > 0
        ? `${item.equipmentItem.name} (+ ${altNames.length} חלופות)`
        : item.equipmentItem.name;
    return {
      equipmentItemId: item.equipmentItemId,
      header,
      requiredQty: item.quantity,
      groupIds,
    };
  });

  const totalRequired = slots.reduce((s, sl) => s + sl.requiredQty, 0);

  const usersRaw = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      personalNumber: true,
      box: {
        select: {
          items: {
            select: { equipmentItemId: true, quantity: true },
          },
        },
      },
    },
  });

  const users: BoxMatrixUserRow[] = usersRaw.map((u) => {
    const items = u.box?.items ?? [];
    const slotQty = slots.map((slot) =>
      items
        .filter((bi) => slot.groupIds.includes(bi.equipmentItemId))
        .reduce((sum, bi) => sum + bi.quantity, 0),
    );
    const inBoxTotal = items.reduce((s, bi) => s + bi.quantity, 0);
    const fillRatio =
      totalRequired > 0 ? Math.min(1, inBoxTotal / totalRequired) : 0;
    return {
      userId: u.id,
      name: u.name,
      personalNumber: u.personalNumber ?? "",
      inBoxTotal,
      totalRequired,
      fillRatio,
      slotQty,
    };
  });

  users.sort((a, b) => {
    const cmp = a.fillRatio - b.fillRatio;
    if (cmp !== 0) return cmp;
    return a.name.localeCompare(b.name, "he");
  });

  return { slots, users };
}

/** Row background ARGB matching admin boxes UI: red → amber → emerald */
export function boxFillRatioToArgb(ratio: number): string {
  if (ratio >= 1) return "FFD1FAE5"; // emerald-100
  if (ratio >= 0.5) return "FFFEF3C7"; // amber-100
  return "FFFEE2E2"; // red-100
}
