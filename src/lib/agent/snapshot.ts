import { RequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The headline numbers of the whole system, read fresh on every chat turn and
 * given to the model up front, so "how many boxes do we have" or "how many
 * soldiers are there" needs no lookup. Also returned by the system_overview tool.
 */

const YAMAH = "ימ״ח";

export type SystemSnapshot = Awaited<ReturnType<typeof loadSystemSnapshot>>;

export async function loadSystemSnapshot() {
  const waiting = { status: { in: [RequestStatus.OPEN, RequestStatus.IN_PROGRESS] }, type: { notIn: ["ADMIN_ASSIGNMENT" as const, "ADMIN_EQUIPMENT_TRANSFER" as const] } };
  const [
    usersByRole,
    inactiveUsers,
    boxes,
    soldiersWithoutBox,
    activeItems,
    inactiveItems,
    weapons,
    sights,
    storage,
    signed,
    boxed,
    departments,
    positions,
    unitTemplates,
    boxTemplateRows,
    tashItems,
    tashUnits,
    tashLocations,
    requestsWaiting,
    urgentWaiting,
    lastBackup,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], where: { active: true }, _count: { _all: true } }),
    prisma.user.count({ where: { active: false } }),
    prisma.box.count(),
    prisma.user.count({ where: { active: true, role: "USER", box: null } }),
    prisma.equipmentItem.count({ where: { active: true } }),
    prisma.equipmentItem.count({ where: { active: false } }),
    prisma.equipmentItem.count({ where: { active: true, isWeapon: true } }),
    prisma.equipmentItem.count({ where: { active: true, isSight: true } }),
    prisma.storageInventory.aggregate({ where: { location: { name: YAMAH }, quantity: { gt: 0 } }, _sum: { quantity: true }, _count: true }),
    prisma.assignment.aggregate({ where: { active: true }, _sum: { quantity: true } }),
    prisma.boxItem.aggregate({ _sum: { quantity: true } }),
    prisma.department.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { name: true, _count: { select: { userDepartments: { where: { user: { active: true } } } } } },
    }),
    prisma.position.count({ where: { active: true } }),
    prisma.unitTemplate.count({ where: { active: true } }),
    prisma.boxTemplateItem.count(),
    prisma.tashItem.count(),
    prisma.tashInventory.aggregate({ _sum: { quantity: true } }),
    prisma.tashLocation.count(),
    prisma.request.count({ where: waiting }),
    prisma.request.count({ where: { ...waiting, priority: { in: ["HIGH", "URGENT"] } } }),
    prisma.databaseBackup.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true, kind: true, verifiedAt: true } }).catch(() => null),
  ]);

  const role = (r: string) => usersByRole.find((g) => g.role === r)?._count._all ?? 0;
  return {
    people: {
      activeTotal: usersByRole.reduce((s, g) => s + g._count._all, 0),
      soldiers: role("USER"),
      admins: role("ADMIN"),
      superAdmins: role("SUPER_ADMIN") + role("THEME_MASTER"),
      viewOnly: role("VIEW_ONLY"),
      inactive: inactiveUsers,
    },
    boxes: { total: boxes, activeSoldiersWithoutBox: soldiersWithoutBox, templateRows: boxTemplateRows },
    catalog: { activeItems, inactiveItems, weaponTypes: weapons, sightTypes: sights },
    equipmentUnits: {
      inStorage: storage._sum.quantity ?? 0,
      itemTypesInStock: storage._count,
      signedOnSoldiers: signed._sum.quantity ?? 0,
      inBoxes: boxed._sum.quantity ?? 0,
    },
    organisation: {
      departments: departments.map((d) => ({ name: d.name, activeMembers: d._count.userDepartments })),
      positions,
      unitTemplates,
    },
    tash: { itemTypes: tashItems, units: tashUnits._sum.quantity ?? 0, savedLocations: tashLocations },
    requests: { waitingForAdmin: requestsWaiting, highOrUrgent: urgentWaiting },
    lastBackup: lastBackup ? { at: lastBackup.createdAt.toISOString().slice(0, 16).replace("T", " "), kind: lastBackup.kind, verified: Boolean(lastBackup.verifiedAt) } : null,
  };
}

/** One compact paragraph for the system prompt. */
export function snapshotLine(s: SystemSnapshot): string {
  const depts = s.organisation.departments.map((d) => `${d.name} (${d.activeMembers})`).join(", ") || "none";
  return [
    `Live system snapshot (read from the database for this message):`,
    `People: ${s.people.activeTotal} active users – ${s.people.soldiers} soldiers, ${s.people.admins} admins, ${s.people.superAdmins} super admins, ${s.people.viewOnly} view-only; ${s.people.inactive} inactive.`,
    `Boxes (קרטונים): ${s.boxes.total} boxes exist; ${s.boxes.activeSoldiersWithoutBox} active soldiers have no box; the box template has ${s.boxes.templateRows} rows.`,
    `Catalog: ${s.catalog.activeItems} active item types (${s.catalog.weaponTypes} weapon types, ${s.catalog.sightTypes} sight types), ${s.catalog.inactiveItems} inactive.`,
    `Equipment units: ${s.equipmentUnits.inStorage} in the ימ״ח storage across ${s.equipmentUnits.itemTypesInStock} item types, ${s.equipmentUnits.signedOnSoldiers} signed on soldiers, ${s.equipmentUnits.inBoxes} inside boxes.`,
    `Departments (active members): ${depts}. ${s.organisation.positions} positions, ${s.organisation.unitTemplates} unit templates.`,
    `ציוד ת״ש: ${s.tash.itemTypes} item types, ${s.tash.units} units, ${s.tash.savedLocations} saved locations.`,
    `Requests waiting for an admin: ${s.requests.waitingForAdmin} (${s.requests.highOrUrgent} high or urgent).`,
    s.lastBackup ? `Last database backup: ${s.lastBackup.at} UTC (${s.lastBackup.kind}${s.lastBackup.verified ? ", verified" : ""}).` : `No database backup recorded.`,
    `For anything more detailed than these totals, use the lookup tools.`,
  ].join("\n");
}
