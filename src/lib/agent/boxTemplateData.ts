import { prisma } from "@/lib/prisma";

/**
 * Read-only helpers about the box template (תבנית קרטון) and what soldiers'
 * boxes hold right now. Used to tell the operator what a template change will
 * do to existing boxes, and to build the clean-up steps when they want one.
 *
 * A template row is a "slot": a main item, optional alternative items that may
 * fill the same slot, and how many units each box should hold of that slot.
 */

export type TemplateSlot = {
  templateItemId: string;
  equipmentItemId: string;
  name: string;
  quantity: number;
  groupName: string | null;
  alternatives: { altId: string; equipmentItemId: string; name: string }[];
};

export type BoxRow = {
  boxItemId: string;
  userId: string;
  userName: string;
  equipmentItemId: string;
  itemName: string;
  quantity: number;
  serialNumber: string | null;
};

export async function loadTemplateSlots(): Promise<TemplateSlot[]> {
  const tpl = await prisma.boxTemplate.findFirst({
    select: {
      items: {
        orderBy: { equipmentItem: { name: "asc" } },
        select: {
          id: true,
          equipmentItemId: true,
          quantity: true,
          groupName: true,
          equipmentItem: { select: { name: true } },
          alternatives: { select: { id: true, equipmentItemId: true, equipmentItem: { select: { name: true } } } },
        },
      },
    },
  });
  return (tpl?.items ?? []).map((i) => ({
    templateItemId: i.id,
    equipmentItemId: i.equipmentItemId,
    name: i.equipmentItem.name,
    quantity: i.quantity,
    groupName: i.groupName,
    alternatives: i.alternatives.map((a) => ({ altId: a.id, equipmentItemId: a.equipmentItemId, name: a.equipmentItem.name })),
  }));
}

/** The name the operator knows the slot by. */
export function slotLabel(slot: TemplateSlot): string {
  return slot.groupName?.trim() || slot.name;
}

export function slotItemIds(slot: TemplateSlot): string[] {
  return [slot.equipmentItemId, ...slot.alternatives.map((a) => a.equipmentItemId)];
}

/** Which slot (if any) already accepts this item, as its main item or as an alternative. */
export function slotAccepting(slots: TemplateSlot[], equipmentItemId: string): TemplateSlot | undefined {
  return slots.find((s) => slotItemIds(s).includes(equipmentItemId));
}

/** Every box row holding one of these items, ordered so a clean-up plan reads soldier by soldier. */
export async function boxRowsFor(equipmentItemIds: string[]): Promise<BoxRow[]> {
  if (equipmentItemIds.length === 0) return [];
  const rows = await prisma.boxItem.findMany({
    where: { equipmentItemId: { in: equipmentItemIds } },
    orderBy: [{ box: { user: { name: "asc" } } }, { movedAt: "asc" }],
    select: {
      id: true,
      quantity: true,
      serialNumber: true,
      equipmentItemId: true,
      equipmentItem: { select: { name: true } },
      box: { select: { userId: true, user: { select: { name: true } } } },
    },
  });
  return rows.map((r) => ({
    boxItemId: r.id,
    userId: r.box.userId,
    userName: r.box.user.name,
    equipmentItemId: r.equipmentItemId,
    itemName: r.equipmentItem.name,
    quantity: r.quantity,
    serialNumber: r.serialNumber,
  }));
}

export function usage(rows: BoxRow[]): { boxes: number; units: number } {
  return { boxes: new Set(rows.map((r) => r.userId)).size, units: rows.reduce((s, r) => s + r.quantity, 0) };
}

export function perBoxTotals(rows: BoxRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.userId, (totals.get(r.userId) ?? 0) + r.quantity);
  return totals;
}

/**
 * For a slot whose per-box quantity drops to `limit`: which units have to leave
 * which boxes. Units without a serial number go first, so tracked items stay put
 * whenever possible.
 */
export function excessRemovals(rows: BoxRow[], limit: number): { row: BoxRow; quantity: number }[] {
  const byUser = new Map<string, BoxRow[]>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  const out: { row: BoxRow; quantity: number }[] = [];
  for (const userRows of byUser.values()) {
    let excess = userRows.reduce((s, r) => s + r.quantity, 0) - limit;
    if (excess <= 0) continue;
    const ordered = [...userRows].sort((a, b) => Number(Boolean(a.serialNumber)) - Number(Boolean(b.serialNumber)));
    for (const row of ordered) {
      if (excess <= 0) break;
      const take = Math.min(row.quantity, excess);
      out.push({ row, quantity: take });
      excess -= take;
    }
  }
  return out;
}

/** How the existing boxes stand against one slot. */
export async function slotStanding(slot: TemplateSlot): Promise<{
  rows: BoxRow[];
  totalBoxes: number;
  boxesHolding: number;
  unitsInBoxes: number;
  boxesBelow: number;
}> {
  const [rows, totalBoxes] = await Promise.all([boxRowsFor(slotItemIds(slot)), prisma.box.count()]);
  const totals = perBoxTotals(rows);
  const full = [...totals.values()].filter((t) => t >= slot.quantity).length;
  const { boxes, units } = usage(rows);
  return { rows, totalBoxes, boxesHolding: boxes, unitsInBoxes: units, boxesBelow: totalBoxes - full };
}
