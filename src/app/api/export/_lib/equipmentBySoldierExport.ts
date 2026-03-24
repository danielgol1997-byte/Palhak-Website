import { prisma } from "@/lib/prisma";

export async function fetchEquipmentBySoldierUsers() {
  return prisma.user.findMany({
    where: { active: true },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      personalNumber: true,
      assignments: {
        where: { active: true },
        orderBy: [{ assignedAt: "desc" }],
        select: {
          quantity: true,
          status: true,
          serialNumber: true,
          clothingSize: true,
          shoeSize: true,
          assignedAt: true,
          assignedBy: { select: { name: true } },
          equipmentItem: {
            select: {
              id: true,
              name: true,
              isWeapon: true,
              isSight: true,
              isClothing: true,
              isShoe: true,
            },
          },
        },
      },
    },
  });
}

export type EquipmentBySoldierUser = Awaited<ReturnType<typeof fetchEquipmentBySoldierUsers>>[number];

export function parseEquipmentLayout(request: Request): "tabs" | "matrix" {
  const u = new URL(request.url);
  return u.searchParams.get("layout") === "matrix" ? "matrix" : "tabs";
}

/** Columns = equipment items with at least one assigned quantity across all users. */
export function buildMatrixColumns(users: EquipmentBySoldierUser[]): { id: string; header: string }[] {
  const idToName = new Map<string, string>();
  const idTotalQty = new Map<string, number>();

  for (const u of users) {
    for (const a of u.assignments) {
      const id = a.equipmentItem.id;
      const name = a.equipmentItem.name;
      idToName.set(id, name);
      idTotalQty.set(id, (idTotalQty.get(id) ?? 0) + a.quantity);
    }
  }

  const ids = [...idToName.keys()].filter((id) => (idTotalQty.get(id) ?? 0) > 0);
  ids.sort((a, b) => {
    const na = idToName.get(a)!;
    const nb = idToName.get(b)!;
    const c = na.localeCompare(nb, "he");
    if (c !== 0) return c;
    return a.localeCompare(b);
  });

  const idsByName = new Map<string, string[]>();
  for (const id of ids) {
    const name = idToName.get(id)!;
    const list = idsByName.get(name);
    if (list) list.push(id);
    else idsByName.set(name, [id]);
  }

  return ids.map((id) => {
    const name = idToName.get(id)!;
    const group = idsByName.get(name)!;
    const header = group.length > 1 ? `${name} (${id.slice(0, 6)})` : name;
    return { id, header };
  });
}

export function userEquipmentQtyByItemId(u: EquipmentBySoldierUser): Map<string, number> {
  const qty = new Map<string, number>();
  for (const a of u.assignments) {
    const id = a.equipmentItem.id;
    qty.set(id, (qty.get(id) ?? 0) + a.quantity);
  }
  return qty;
}

export function buildMatrixDataRow(
  u: EquipmentBySoldierUser,
  columns: { id: string }[],
): (string | number)[] {
  const qty = userEquipmentQtyByItemId(u);
  const cells: (string | number)[] = [u.name, u.personalNumber ?? ""];
  for (const col of columns) {
    const q = qty.get(col.id) ?? 0;
    cells.push(q > 0 ? q : "");
  }
  return cells;
}
