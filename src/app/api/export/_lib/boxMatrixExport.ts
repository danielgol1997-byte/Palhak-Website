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

/** Per template slot: aggregate across all soldiers who have a box record */
export type BoxMatrixTotalsRow = {
  header: string;
  requiredPerBox: number;
  /** Sum of quantities observed in boxes for this slot */
  totalInBoxes: number;
  /** Required total minus in boxes, floored at 0 */
  missing: number;
  /** requiredPerBox × number of soldiers included in the export */
  totalRequiredAllBoxes: number;
};

export type BoxMatrixExportData = {
  slots: BoxSlotColumn[];
  users: BoxMatrixUserRow[];
  totals: BoxMatrixTotalsRow[];
  /** Soldiers with a Box row (shown on sheet & included in totals) */
  usersWithBoxCount: number;
  /** Active soldiers with no box at all — excluded from sheet & totals */
  excludedWithoutBoxCount: number;
};

export const BOX_MATRIX_SUMMARY_NOTE =
  "הסיכום מחושב רק עבור חיילים שיש להם רשומת קרטון במערכת — גם אם הקרטון ריק (למשל 0 מתוך כל הפריטים הנדרשים). חיילים שאין להם קרטון בכלל לא מוצגים בגליון ולא נספרים בסיכום.";

export async function fetchBoxMatrixExport(): Promise<BoxMatrixExportData | null> {
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

  const [usersRaw, excludedWithoutBoxCount] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, box: { isNot: null } },
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
    }),
    prisma.user.count({ where: { active: true, box: null } }),
  ]);

  const users: BoxMatrixUserRow[] = usersRaw.map((u) => {
    const items = u.box!.items;
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

  const n = users.length;
  const totals: BoxMatrixTotalsRow[] = slots.map((slot, slotIndex) => {
    const totalInBoxes = users.reduce((s, u) => s + u.slotQty[slotIndex], 0);
    const totalRequiredAllBoxes = slot.requiredQty * n;
    const missing = Math.max(0, totalRequiredAllBoxes - totalInBoxes);
    return {
      header: slot.header,
      requiredPerBox: slot.requiredQty,
      totalInBoxes,
      missing,
      totalRequiredAllBoxes,
    };
  });

  return {
    slots,
    users,
    totals,
    usersWithBoxCount: n,
    excludedWithoutBoxCount,
  };
}

/** Row background ARGB matching admin boxes UI: red → amber → emerald */
export function boxFillRatioToArgb(ratio: number): string {
  if (ratio >= 1) return "FFD1FAE5"; // emerald-100
  if (ratio >= 0.5) return "FFFEF3C7"; // amber-100
  return "FFFEE2E2"; // red-100
}
