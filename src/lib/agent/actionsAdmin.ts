import { z } from "zod";
import { BackupKind, ClothingSize, Division, RequestStatus, TashLogAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assignmentStatusLabel, divisionLabel, requestStatusLabel, requestTypeLabel } from "@/lib/he";
import { blobConfigured, createBackup, pruneBackups } from "@/lib/backup";
import { PlanError, type AgentAction } from "./types";
import { YAMAH, define, form, getTashItem, id, run, serialSuffix, tashQtyAt, yamahStock } from "./actionKit";
import { loadTemplateSlots, slotAccepting, slotLabel } from "./boxTemplateData";

import {
  createDepartmentAction,
  deleteDepartmentAction,
  reorderDepartmentsAction,
  updateDepartmentAction,
} from "@/app/(app)/admin/departments/actions";
import { createPositionAction, updatePositionAction } from "@/app/(app)/admin/positions/actions";
import { adminUpdateUserDepartmentsPositionsAction } from "@/app/(app)/admin/users/actions";
import { adminUpdateUserPersonalDetailsAction } from "@/app/(app)/admin/users/[id]/personal-actions";
import {
  addUnitTemplateItemAction,
  createUnitTemplateAction,
  deleteUnitTemplateAction,
  removeUnitTemplateItemAction,
  updateUnitTemplateAction,
} from "@/app/(app)/admin/unit-templates/actions";
import { deleteItemAction } from "@/app/(app)/admin/items/actions";
import { recoverAssignmentToStorageAction } from "@/app/(app)/admin/storage/actions";
import {
  deleteTashItemAction,
  deleteTashLocationAction,
  deleteTashLogAction,
  setTashInventoryQuantityAction,
  updateTashItemAction,
  updateTashLogNotesAction,
} from "@/app/(app)/admin/tash/actions";
import { cancelRequestAction } from "@/app/(app)/requests/actions";

/**
 * The rest of what an administrator can do on the site: organisation
 * (departments, positions, who belongs where), personal details, unit templates,
 * deletions, the remaining ת״ש screens, cancelling requests and taking a backup.
 *
 * Same rule as actions.ts: every entry goes through the site's own server action.
 * Anything that deletes says exactly what disappears, in `warnings`.
 */

const IRREVERSIBLE = "הפעולה לא ניתנת לביטול, מלבד שחזור מגיבוי.";

/** FormData with one field that repeats (the way a multi-select posts). */
function formWithList(fields: Parameters<typeof form>[0], key: string, values: readonly string[]): FormData {
  const fd = form(fields);
  for (const v of values) fd.append(key, v);
  return fd;
}

function sameSet(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && [...a].sort().join("\n") === [...b].sort().join("\n");
}

const namesOrNone = (names: string[]) => (names.length ? names.join(", ") : "ללא");

// ─── departments (מחלקות) ─────────────────────────────────────────────────────

const divisions = z
  .array(z.enum(Division))
  .max(3)
  .describe("Equipment divisions the department is linked to: COMBAT = ציוד קרבי, LOGISTICS = ציוד משקי, MEDICAL = ציוד רפואי");

async function getDepartment(departmentId: string) {
  const d = await prisma.department.findUnique({
    where: { id: departmentId },
    select: {
      id: true,
      name: true,
      active: true,
      divisions: { select: { division: true } },
      positions: { select: { id: true, name: true, active: true } },
      _count: { select: { userDepartments: true } },
    },
  });
  if (!d) throw new PlanError(`No department with id "${departmentId}". Call list_departments for the ids.`);
  return d;
}

const divisionNames = (list: readonly Division[]) => namesOrNone(list.map(divisionLabel));

const createDepartment = define({
  name: "create_department",
  description: "Add a new department (הוספת מחלקה).",
  schema: z.object({ name: z.string().trim().min(1).max(80), divisions: divisions.optional() }),
  async preview(p) {
    if (await prisma.department.findUnique({ where: { name: p.name }, select: { id: true } })) {
      throw new PlanError(`כבר קיימת מחלקה בשם "${p.name}".`);
    }
    return { title: `הוספת מחלקה חדשה: ${p.name}`, details: [`סוגי ציוד: ${divisionNames(p.divisions ?? [])}`] };
  },
  async execute(p) {
    await run(createDepartmentAction(formWithList({ name: p.name }, "divisions", p.divisions ?? [])));
  },
});

const updateDepartment = define({
  name: "update_department",
  description: "Rename a department, change its equipment divisions, or deactivate / reactivate it (עריכת מחלקה). Send only what changes.",
  schema: z.object({
    departmentId: id("Department"),
    name: z.string().trim().min(1).max(80).optional(),
    active: z.boolean().optional(),
    divisions: divisions.optional().describe("The full new list of divisions (replaces the current list)"),
  }),
  async preview(p) {
    const d = await getDepartment(p.departmentId);
    const current = d.divisions.map((x) => x.division);
    const details: string[] = [];
    if (p.name !== undefined && p.name !== d.name) {
      if (await prisma.department.findUnique({ where: { name: p.name }, select: { id: true } })) {
        throw new PlanError(`כבר קיימת מחלקה בשם "${p.name}".`);
      }
      details.push(`שם: ${d.name} ← ${p.name}`);
    }
    if (p.divisions !== undefined && !sameSet(p.divisions, current)) details.push(`סוגי ציוד: ${divisionNames(current)} ← ${divisionNames(p.divisions)}`);
    if (p.active !== undefined && p.active !== d.active) details.push(p.active ? "הפעלה מחדש" : "השבתה (המחלקה לא נמחקת)");
    if (details.length === 0) throw new PlanError(`אין שינוי במחלקה ${d.name}.`);
    const warnings: string[] = [];
    if (p.active === false && d.active && d._count.userDepartments > 0) {
      warnings.push(`${d._count.userDepartments} משתמשים משויכים למחלקה. הם יישארו משויכים למחלקה לא פעילה.`);
    }
    return { title: `עריכת המחלקה ${d.name}`, details, ...(warnings.length ? { warnings } : {}) };
  },
  async execute(p) {
    const d = await getDepartment(p.departmentId);
    await run(
      updateDepartmentAction(
        formWithList({ id: d.id, name: p.name ?? d.name, active: p.active ?? d.active }, "divisions", p.divisions ?? d.divisions.map((x) => x.division)),
      ),
    );
  },
});

const deleteDepartment = define({
  name: "delete_department",
  description:
    "Delete a department for good (מחיקת מחלקה). Only possible when it has no positions and no users. Otherwise deactivate it with update_department.",
  schema: z.object({ departmentId: id("Department") }),
  async preview(p) {
    const d = await getDepartment(p.departmentId);
    if (d.positions.length > 0) {
      throw new PlanError(
        `לא ניתן למחוק את המחלקה ${d.name}: יש בה ${d.positions.length} תפקידים (${d.positions.map((x) => x.name).join(", ")}), ובאתר אין מחיקת תפקידים. ` +
          `Offer to deactivate the department instead (update_department with active:false).`,
      );
    }
    if (d._count.userDepartments > 0) {
      throw new PlanError(
        `לא ניתן למחוק את המחלקה ${d.name}: ${d._count.userDepartments} משתמשים משויכים אליה. ` +
          `Offer to move them first (set_user_departments) or to deactivate the department instead.`,
      );
    }
    return { title: `מחיקת המחלקה ${d.name}`, details: ["אין בה תפקידים ואין משתמשים משויכים."], warnings: [IRREVERSIBLE] };
  },
  async execute(p) {
    await run(deleteDepartmentAction(form({ id: p.departmentId })));
  },
});

const reorderDepartments = define({
  name: "reorder_departments",
  description: "Change the display order of the departments (סידור מחלקות). Send every department id exactly once, in the new order.",
  schema: z.object({ orderedDepartmentIds: z.array(z.string().min(1)).min(2).max(100) }),
  async preview(p) {
    const all = await prisma.department.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
    if (!sameSet(p.orderedDepartmentIds, all.map((d) => d.id))) {
      throw new PlanError(`orderedDepartmentIds must list all ${all.length} departments exactly once. Call list_departments for the ids.`);
    }
    if (p.orderedDepartmentIds.every((x, i) => x === all[i].id)) throw new PlanError("זה כבר הסדר הנוכחי.");
    const byId = new Map(all.map((d) => [d.id, d.name]));
    return { title: "שינוי סדר המחלקות", details: p.orderedDepartmentIds.map((x, i) => `${i + 1}. ${byId.get(x)}`) };
  },
  async execute(p) {
    await run(reorderDepartmentsAction(p.orderedDepartmentIds));
  },
});

// ─── positions (תפקידים) ──────────────────────────────────────────────────────

async function getPosition(positionId: string) {
  const pos = await prisma.position.findUnique({
    where: { id: positionId },
    select: { id: true, name: true, active: true, sortOrder: true, departmentId: true, department: { select: { name: true } }, _count: { select: { userPositions: true } } },
  });
  if (!pos) throw new PlanError(`No position with id "${positionId}". Call list_departments for the ids.`);
  return pos;
}

async function positionNameTaken(departmentId: string, name: string, exceptId?: string) {
  const found = await prisma.position.findUnique({ where: { departmentId_name: { departmentId, name } }, select: { id: true } });
  return Boolean(found && found.id !== exceptId);
}

const createPosition = define({
  name: "create_position",
  description: "Add a position inside a department (הוספת תפקיד).",
  schema: z.object({ departmentId: id("Department"), name: z.string().trim().min(1).max(80) }),
  async preview(p) {
    const d = await getDepartment(p.departmentId);
    if (await positionNameTaken(d.id, p.name)) throw new PlanError(`במחלקה ${d.name} כבר קיים תפקיד בשם "${p.name}".`);
    return { title: `הוספת התפקיד ${p.name}`, details: [`מחלקה: ${d.name}`] };
  },
  async execute(p) {
    const last = await prisma.position.findFirst({ where: { departmentId: p.departmentId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    await run(createPositionAction(form({ departmentId: p.departmentId, name: p.name, sortOrder: (last?.sortOrder ?? -1) + 1 })));
  },
});

const updatePosition = define({
  name: "update_position",
  description: "Rename a position, move it to another department, or deactivate / reactivate it (עריכת תפקיד). Positions cannot be deleted, only deactivated.",
  schema: z.object({
    positionId: id("Position"),
    name: z.string().trim().min(1).max(80).optional(),
    departmentId: id("Department to move the position to").optional(),
    active: z.boolean().optional(),
  }),
  async preview(p) {
    const pos = await getPosition(p.positionId);
    const details: string[] = [];
    const warnings: string[] = [];
    const moving = p.departmentId !== undefined && p.departmentId !== pos.departmentId;
    const nextName = p.name ?? pos.name;
    const target = moving ? await getDepartment(p.departmentId!) : null;
    if (nextName !== pos.name || moving) {
      if (await positionNameTaken(target?.id ?? pos.departmentId, nextName, pos.id)) {
        throw new PlanError(`במחלקה ${target?.name ?? pos.department.name} כבר קיים תפקיד בשם "${nextName}".`);
      }
    }
    if (nextName !== pos.name) details.push(`שם: ${pos.name} ← ${nextName}`);
    if (target) {
      details.push(`מחלקה: ${pos.department.name} ← ${target.name}`);
      if (pos._count.userPositions > 0) warnings.push(`${pos._count.userPositions} משתמשים מחזיקים בתפקיד. הם יישארו משויכים למחלקה ${pos.department.name} עד שישנו להם את השיוך.`);
    }
    if (p.active !== undefined && p.active !== pos.active) {
      details.push(p.active ? "הפעלה מחדש" : "השבתה (התפקיד לא נמחק)");
      if (!p.active && pos._count.userPositions > 0) warnings.push(`${pos._count.userPositions} משתמשים מחזיקים בתפקיד, והם יישארו רשומים עליו.`);
    }
    if (details.length === 0) throw new PlanError(`אין שינוי בתפקיד ${pos.name}.`);
    return { title: `עריכת התפקיד ${pos.name} (${pos.department.name})`, details, ...(warnings.length ? { warnings } : {}) };
  },
  async execute(p) {
    const pos = await getPosition(p.positionId);
    await run(
      updatePositionAction(
        form({ id: pos.id, departmentId: p.departmentId ?? pos.departmentId, name: p.name ?? pos.name, sortOrder: pos.sortOrder, active: p.active ?? pos.active }),
      ),
    );
  },
});

// ─── users: personal details and where they belong ────────────────────────────

async function getUserFull(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      personalNumber: true,
      phoneNumber: true,
      role: true,
      active: true,
      shirtSize: true,
      pantsSize: true,
      shoeSize: true,
      userDepartments: { select: { departmentId: true, department: { select: { name: true } } } },
      userPositions: { select: { positionId: true, position: { select: { name: true } } } },
    },
  });
  if (!u) throw new PlanError(`No user with id "${userId}". Look the person up with search_users first.`);
  return u;
}

const clearable = "Send null to clear it.";
const shoe = (n: number | null | undefined) => (n === null || n === undefined ? null : (`SIZE_${n}` as const));

const updateUserDetails = define({
  name: "update_user_details",
  description:
    "Edit a user's personal details: name, email, personal number, phone, shirt / trousers / shoe size (עריכת פרטים אישיים). Send only the fields that change. " +
    "For role use set_user_role, for active state set_user_active, for department and position set_user_departments.",
  schema: z.object({
    userId: id("User"),
    name: z.string().trim().min(1).max(120).optional(),
    email: z.email().optional().describe("The Google account the person signs in with. Changing it changes how they sign in."),
    personalNumber: z.string().trim().min(1).max(20).nullable().optional().describe(`מספר אישי. ${clearable}`),
    phoneNumber: z.string().trim().min(1).max(30).nullable().optional().describe(clearable),
    shirtSize: z.enum(ClothingSize).nullable().optional().describe(clearable),
    pantsSize: z.enum(ClothingSize).nullable().optional().describe(clearable),
    shoeSize: z.number().int().min(36).max(48).nullable().optional().describe(`European shoe size 36–48. ${clearable}`),
  }),
  async preview(p) {
    const u = await getUserFull(p.userId);
    const details: string[] = [];
    const warnings: string[] = [];
    const show = (v: string | null | undefined) => v || "ריק";
    if (p.name !== undefined && p.name !== u.name) details.push(`שם: ${u.name} ← ${p.name}`);
    if (p.email !== undefined && p.email.toLowerCase() !== u.email) {
      const email = p.email.toLowerCase();
      if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new PlanError("כבר קיים משתמש עם כתובת אימייל זו.");
      details.push(`אימייל: ${u.email} ← ${email}`);
      warnings.push(`${u.name} יתחבר מעכשיו רק עם חשבון Google של ${email}. הכתובת הישנה תפסיק לעבוד.`);
    }
    if (p.personalNumber !== undefined && p.personalNumber !== u.personalNumber) {
      if (p.personalNumber && (await prisma.user.findUnique({ where: { personalNumber: p.personalNumber }, select: { id: true } }))) {
        throw new PlanError("כבר קיים משתמש עם מספר אישי זה.");
      }
      details.push(`מספר אישי: ${show(u.personalNumber)} ← ${show(p.personalNumber)}`);
    }
    if (p.phoneNumber !== undefined && p.phoneNumber !== u.phoneNumber) details.push(`טלפון: ${show(u.phoneNumber)} ← ${show(p.phoneNumber)}`);
    if (p.shirtSize !== undefined && p.shirtSize !== u.shirtSize) details.push(`מידת חולצה: ${show(u.shirtSize)} ← ${show(p.shirtSize)}`);
    if (p.pantsSize !== undefined && p.pantsSize !== u.pantsSize) details.push(`מידת מכנסיים: ${show(u.pantsSize)} ← ${show(p.pantsSize)}`);
    if (p.shoeSize !== undefined && shoe(p.shoeSize) !== u.shoeSize) {
      details.push(`מידת נעליים: ${show(u.shoeSize?.replace("SIZE_", ""))} ← ${show(p.shoeSize?.toString())}`);
    }
    if (details.length === 0) throw new PlanError(`אין שינוי בפרטים של ${u.name}.`);
    return { title: `עריכת הפרטים של ${u.name}`, details, ...(warnings.length ? { warnings } : {}) };
  },
  async execute(p) {
    const u = await getUserFull(p.userId);
    const pick = <T,>(next: T | null | undefined, current: T | null) => (next === undefined ? current : next);
    await run(
      adminUpdateUserPersonalDetailsAction(
        form({
          userId: u.id,
          name: p.name ?? u.name,
          email: (p.email ?? u.email).toLowerCase(),
          personalNumber: pick(p.personalNumber, u.personalNumber),
          phoneNumber: pick(p.phoneNumber, u.phoneNumber),
          role: u.role,
          active: u.active,
          shirtSize: pick(p.shirtSize, u.shirtSize),
          pantsSize: pick(p.pantsSize, u.pantsSize),
          shoeSize: p.shoeSize === undefined ? u.shoeSize : shoe(p.shoeSize),
          departmentId: u.userDepartments[0]?.departmentId,
          positionId: u.userPositions[0]?.positionId,
        }),
      ),
    );
    // The details form keeps one department and one position. Put back the rest for people who have several.
    if (u.userDepartments.length > 1 || u.userPositions.length > 1) {
      const fd = formWithList({ userId: u.id }, "departments", u.userDepartments.map((d) => d.departmentId));
      for (const pos of u.userPositions) fd.append("positions", pos.positionId);
      await run(adminUpdateUserDepartmentsPositionsAction(fd));
    }
  },
});

const setUserDepartments = define({
  name: "set_user_departments",
  description:
    "Set which departments and positions a user belongs to (שיוך למחלקה ולתפקיד). Send the full new lists; they replace the current ones. " +
    "Every position must belong to one of the departments in the list. Empty lists remove the user from all of them.",
  schema: z.object({
    userId: id("User"),
    departmentIds: z.array(z.string().min(1)).max(20).describe("Department ids from list_departments"),
    positionIds: z.array(z.string().min(1)).max(20).describe("Position ids from list_departments"),
  }),
  async preview(p) {
    const u = await getUserFull(p.userId);
    const [depts, positions] = await Promise.all([
      prisma.department.findMany({ where: { id: { in: p.departmentIds } }, select: { id: true, name: true, active: true } }),
      prisma.position.findMany({ where: { id: { in: p.positionIds } }, select: { id: true, name: true, active: true, departmentId: true } }),
    ]);
    if (depts.length !== new Set(p.departmentIds).size) throw new PlanError("One of the department ids does not exist. Call list_departments for the ids.");
    if (positions.length !== new Set(p.positionIds).size) throw new PlanError("One of the position ids does not exist. Call list_departments for the ids.");
    const stray = positions.find((x) => !p.departmentIds.includes(x.departmentId));
    if (stray) throw new PlanError(`התפקיד ${stray.name} לא שייך לאף אחת מהמחלקות שנבחרו.`);
    const inactive = [...depts, ...positions].find((x) => !x.active);
    if (inactive) throw new PlanError(`${inactive.name} אינו פעיל, ולא ניתן לשייך אליו.`);
    const sameDepts = sameSet(p.departmentIds, u.userDepartments.map((d) => d.departmentId));
    const samePos = sameSet(p.positionIds, u.userPositions.map((x) => x.positionId));
    if (sameDepts && samePos) throw new PlanError(`זה כבר השיוך של ${u.name}.`);
    return {
      title: `שינוי השיוך של ${u.name}`,
      details: [
        ...(sameDepts ? [] : [`מחלקות: ${namesOrNone(u.userDepartments.map((d) => d.department.name))} ← ${namesOrNone(depts.map((d) => d.name))}`]),
        ...(samePos ? [] : [`תפקידים: ${namesOrNone(u.userPositions.map((x) => x.position.name))} ← ${namesOrNone(positions.map((x) => x.name))}`]),
      ],
    };
  },
  async execute(p) {
    const fd = formWithList({ userId: p.userId }, "departments", p.departmentIds);
    for (const x of p.positionIds) fd.append("positions", x);
    await run(adminUpdateUserDepartmentsPositionsAction(fd));
  },
});

// ─── unit templates (תבניות יחידה) ────────────────────────────────────────────

async function getUnitTemplate(unitTemplateId: string) {
  const t = await prisma.unitTemplate.findUnique({
    where: { id: unitTemplateId },
    select: {
      id: true,
      name: true,
      active: true,
      items: { select: { equipmentItemId: true, quantityRequired: true, equipmentItem: { select: { name: true } } } },
      _count: { select: { transferItems: true } },
    },
  });
  if (!t) throw new PlanError(`No unit template with id "${unitTemplateId}". Call list_unit_templates for the ids.`);
  return t;
}

async function getCatalogItem(equipmentItemId: string) {
  const item = await prisma.equipmentItem.findUnique({ where: { id: equipmentItemId }, select: { id: true, name: true, active: true } });
  if (!item) throw new PlanError(`No equipment item with id "${equipmentItemId}". Look it up with search_items first.`);
  return item;
}

const createUnitTemplate = define({
  name: "create_unit_template",
  description: "Create a new, empty unit template (תבנית יחידה חדשה). Add its items afterwards with unit_template_set_item.",
  schema: z.object({ name: z.string().trim().min(1).max(80) }),
  async preview(p) {
    if (await prisma.unitTemplate.findUnique({ where: { name: p.name }, select: { id: true } })) {
      throw new PlanError(`כבר קיימת תבנית יחידה בשם "${p.name}".`);
    }
    return { title: `יצירת תבנית יחידה חדשה: ${p.name}`, details: ["התבנית נוצרת ריקה."] };
  },
  async execute(p) {
    await run(createUnitTemplateAction(form({ name: p.name })));
  },
});

const updateUnitTemplate = define({
  name: "update_unit_template",
  description: "Rename a unit template or deactivate / reactivate it (עריכת תבנית יחידה).",
  schema: z.object({ unitTemplateId: id("Unit template"), name: z.string().trim().min(1).max(80).optional(), active: z.boolean().optional() }),
  async preview(p) {
    const t = await getUnitTemplate(p.unitTemplateId);
    const details: string[] = [];
    if (p.name !== undefined && p.name !== t.name) {
      if (await prisma.unitTemplate.findUnique({ where: { name: p.name }, select: { id: true } })) {
        throw new PlanError(`כבר קיימת תבנית יחידה בשם "${p.name}".`);
      }
      details.push(`שם: ${t.name} ← ${p.name}`);
    }
    if (p.active !== undefined && p.active !== t.active) details.push(p.active ? "הפעלה מחדש" : "השבתה (התבנית לא נמחקת)");
    if (details.length === 0) throw new PlanError(`אין שינוי בתבנית ${t.name}.`);
    return { title: `עריכת תבנית היחידה ${t.name}`, details };
  },
  async execute(p) {
    const t = await getUnitTemplate(p.unitTemplateId);
    await run(updateUnitTemplateAction(form({ id: t.id, name: p.name ?? t.name, active: p.active ?? t.active })));
  },
});

const unitTemplateSetItem = define({
  name: "unit_template_set_item",
  description: "Add an item to a unit template, or change how many of it the template requires (הוספת פריט לתבנית יחידה / שינוי כמות).",
  schema: z.object({
    unitTemplateId: id("Unit template"),
    equipmentItemId: id("Equipment item"),
    quantity: z.number().int().min(1).max(1000).describe("How many the template requires"),
  }),
  async preview(p) {
    const t = await getUnitTemplate(p.unitTemplateId);
    const item = await getCatalogItem(p.equipmentItemId);
    const row = t.items.find((i) => i.equipmentItemId === item.id);
    if (row?.quantityRequired === p.quantity) throw new PlanError(`בתבנית ${t.name} כבר נדרשים ${p.quantity} × ${item.name}.`);
    if (!row && !item.active) throw new PlanError(`הפריט ${item.name} אינו פעיל.`);
    return {
      title: row ? `תבנית היחידה ${t.name}: שינוי כמות של ${item.name}` : `תבנית היחידה ${t.name}: הוספת ${item.name}`,
      details: [row ? `כמות נדרשת: ${row.quantityRequired} ← ${p.quantity}` : `כמות נדרשת: ${p.quantity}`],
    };
  },
  async execute(p) {
    await run(addUnitTemplateItemAction(form({ unitTemplateId: p.unitTemplateId, equipmentItemId: p.equipmentItemId, quantityRequired: p.quantity })));
  },
});

const unitTemplateRemoveItem = define({
  name: "unit_template_remove_item",
  description: "Remove an item from a unit template (הסרת פריט מתבנית יחידה).",
  schema: z.object({ unitTemplateId: id("Unit template"), equipmentItemId: id("Equipment item") }),
  async preview(p) {
    const t = await getUnitTemplate(p.unitTemplateId);
    const row = t.items.find((i) => i.equipmentItemId === p.equipmentItemId);
    if (!row) throw new PlanError(`הפריט הזה לא נמצא בתבנית ${t.name}. Call list_unit_templates to see its items.`);
    return { title: `תבנית היחידה ${t.name}: הסרת ${row.equipmentItem.name}`, details: [`היו נדרשים ${row.quantityRequired}.`] };
  },
  async execute(p) {
    await run(removeUnitTemplateItemAction(form(p)));
  },
});

const deleteUnitTemplate = define({
  name: "delete_unit_template",
  description: "Delete a unit template for good, with its item list (מחיקת תבנית יחידה). To keep it but hide it, use update_unit_template with active:false.",
  schema: z.object({ unitTemplateId: id("Unit template") }),
  async preview(p) {
    const t = await getUnitTemplate(p.unitTemplateId);
    const warnings = [`התבנית תימחק יחד עם ${t.items.length} הפריטים שמוגדרים בה. ${IRREVERSIBLE}`];
    if (t._count.transferItems > 0) warnings.push(`${t._count.transferItems} שורות בהיסטוריית ההעברות מפנות לתבנית הזו, וההפניה שלהן תתנתק.`);
    warnings.push("אפשר במקום זה להשבית את התבנית, והיא תישמר.");
    return { title: `מחיקת תבנית היחידה ${t.name}`, details: t.items.slice(0, 8).map((i) => `${i.quantityRequired} × ${i.equipmentItem.name}`), warnings };
  },
  async execute(p) {
    await run(deleteUnitTemplateAction(form({ id: p.unitTemplateId })));
  },
});

// ─── catalog: deleting an item ────────────────────────────────────────────────

const deleteItem = define({
  name: "delete_item",
  description:
    "Delete an equipment type from the catalog (מחיקת פריט). The site decides how deep it goes: an item with history is only marked as discontinued; " +
    "deleting an already discontinued item erases it together with its history. Not possible while units are signed on soldiers or sit in boxes. " +
    "To just hide an item, use update_item with active:false, which loses nothing.",
  schema: z.object({ equipmentItemId: id("Equipment item") }),
  async preview(p) {
    const item = await prisma.equipmentItem.findUnique({
      where: { id: p.equipmentItemId },
      select: {
        id: true,
        name: true,
        discontinued: true,
        _count: { select: { requestItems: true, transferItems: true, unitTemplateItems: true } },
      },
    });
    if (!item) throw new PlanError(`No equipment item with id "${p.equipmentItemId}". Look it up with search_items (includeInactive) first.`);
    const [signed, boxed, stock, slots] = await Promise.all([
      prisma.assignment.aggregate({ where: { equipmentItemId: item.id, active: true }, _sum: { quantity: true } }),
      prisma.boxItem.aggregate({ where: { equipmentItemId: item.id }, _sum: { quantity: true } }),
      prisma.storageInventory.aggregate({ where: { equipmentItemId: item.id }, _sum: { quantity: true } }),
      loadTemplateSlots(),
    ]);
    const signedUnits = signed._sum.quantity ?? 0;
    const boxedUnits = boxed._sum.quantity ?? 0;
    const inStock = stock._sum.quantity ?? 0;
    if (signedUnits > 0) {
      throw new PlanError(
        `לא ניתן למחוק את ${item.name}: ${signedUnits} יחידות רשומות על חיילים. ` +
          `Offer to return them to the ימ״ח first, or to deactivate the item instead (update_item active:false).`,
      );
    }
    if (boxedUnits > 0) {
      throw new PlanError(
        `לא ניתן למחוק את ${item.name}: ${boxedUnits} יחידות נמצאות בקרטונים. ` +
          `Offer to take them out of the boxes first, or to deactivate the item instead (update_item active:false).`,
      );
    }
    const history = item._count.requestItems + item._count.transferItems;
    const slot = slotAccepting(slots, item.id);
    const side: string[] = [];
    if (inStock > 0) side.push(`רישום המלאי של הפריט יימחק: ${inStock} יחידות ייעלמו מספירת הימ״ח.`);
    if (slot) side.push(`הפריט יוסר מתבנית הקרטון (שורה "${slotLabel(slot)}").`);
    if (item._count.unitTemplateItems > 0) side.push(`הפריט יוסר מ-${item._count.unitTemplateItems} תבניות יחידה.`);

    if (item.discontinued) {
      return {
        title: `מחיקה סופית של הפריט ${item.name}`,
        details: ["הפריט כבר מסומן כלא בשימוש. המחיקה הזו מוחקת אותו לגמרי."],
        warnings: [
          `יימחקו לצמיתות גם ${item._count.requestItems} שורות מבקשות ו-${item._count.transferItems} שורות מהעברות שבהיסטוריה. בקשה או העברה שתישאר בלי שורות תימחק כולה.`,
          ...side,
          IRREVERSIBLE,
        ],
      };
    }
    if (history > 0) {
      return {
        title: `הוצאת הפריט ${item.name} משימוש`,
        details: [`לפריט יש היסטוריה (${history} שורות בבקשות ובהעברות), ולכן הוא לא נמחק אלא מסומן כ"לא בשימוש" ונעלם מהקטלוג. ההיסטוריה נשמרת.`],
        warnings: [...side, "מחיקה נוספת של אותו פריט אחרי זה תמחק גם את ההיסטוריה שלו.", "אם רוצים רק להסתיר את הפריט, השבתה שלו שומרת גם את המלאי ואת התבניות."],
      };
    }
    return { title: `מחיקת הפריט ${item.name}`, details: ["לפריט אין היסטוריה, והוא יימחק לגמרי מהקטלוג."], warnings: [...side, IRREVERSIBLE] };
  },
  async execute(p) {
    await run(deleteItemAction(form({ id: p.equipmentItemId })));
  },
});

// ─── storage: bringing written-off equipment back ─────────────────────────────

const WRITTEN_OFF = ["DAMAGED", "STOLEN", "MISSING", "USED"];

const recoverWrittenOff = define({
  name: "recover_written_off_equipment",
  description:
    "Put equipment that was written off on a soldier (בלאי, אבד / נגנב, חסר, שומש) back into the ימ״ח storage, for example when a lost item was found (שחזור למלאי). " +
    "get_user_equipment shows these rows with their status and assignmentId.",
  schema: z.object({
    assignmentId: id("The written-off assignment row"),
    quantity: z.number().int().min(1).max(1000).optional().describe("Default: the whole row"),
  }),
  async preview(p) {
    const a = await prisma.assignment.findUnique({
      where: { id: p.assignmentId },
      select: { quantity: true, status: true, serialNumber: true, equipmentItem: { select: { id: true, name: true } }, user: { select: { name: true } } },
    });
    if (!a) throw new PlanError(`No assignment with id "${p.assignmentId}". Call get_user_equipment to get current ids.`);
    if (!WRITTEN_OFF.includes(a.status)) {
      throw new PlanError(`השורה הזו במצב "${assignmentStatusLabel(a.status)}". For equipment that is simply signed on a soldier use return_equipment_to_storage.`);
    }
    const q = p.quantity ?? a.quantity;
    if (q > a.quantity) throw new PlanError(`בשורה יש רק ${a.quantity} יחידות.`);
    const stock = await yamahStock(a.equipmentItem.id);
    return {
      title: `שחזור למלאי: ${q} × ${a.equipmentItem.name}${serialSuffix(a.serialNumber)}`,
      details: [`היה רשום על ${a.user.name} במצב "${assignmentStatusLabel(a.status)}"`, `מלאי ב${YAMAH}: ${stock} ← ${stock + q}`],
    };
  },
  async execute(p) {
    const a = await prisma.assignment.findUnique({ where: { id: p.assignmentId }, select: { quantity: true } });
    await run(recoverAssignmentToStorageAction(form({ assignmentId: p.assignmentId, quantity: p.quantity ?? a?.quantity })));
  },
});

// ─── requests ─────────────────────────────────────────────────────────────────

const cancelRequest = define({
  name: "cancel_request",
  description:
    "Cancel a request that has not been closed yet (ביטול בקשה): every line still waiting is cancelled and nothing is issued. " +
    "To refuse only some lines, or to record a refusal with a reason, use handle_request_items with DENY instead.",
  schema: z.object({ requestId: id("Request") }),
  async preview(p) {
    const r = await prisma.request.findUnique({
      where: { id: p.requestId },
      select: { status: true, type: true, requester: { select: { name: true } }, items: { where: { status: "PENDING" }, select: { quantity: true, equipmentItem: { select: { name: true } } } } },
    });
    if (!r) throw new PlanError(`No request with id "${p.requestId}". Use list_requests.`);
    const closed: RequestStatus[] = [RequestStatus.FULFILLED, RequestStatus.DENIED, RequestStatus.CANCELLED];
    if (closed.includes(r.status)) throw new PlanError(`הבקשה כבר במצב "${requestStatusLabel(r.status)}" ולא ניתן לבטל אותה.`);
    return {
      title: `ביטול הבקשה של ${r.requester.name} (${requestTypeLabel(r.type)})`,
      details: r.items.length ? r.items.map((i) => `${Math.abs(i.quantity)} × ${i.equipmentItem.name} – יבוטל`) : ["אין בה שורות ממתינות."],
    };
  },
  async execute(p) {
    await run(cancelRequestAction(form({ id: p.requestId })));
  },
});

// ─── ציוד ת״ש: the rest ───────────────────────────────────────────────────────

const tashLocation = z.string().trim().min(1).max(120).describe(`Location name exactly as returned by search_tash (the main store is "${YAMAH}")`);

const tashUpdateItem = define({
  name: "tash_update_item",
  description: "Rename a ציוד ת״ש item, or change its unit of measure or description (עריכת פריט ת״ש).",
  schema: z.object({
    itemId: id("ת״ש item"),
    name: z.string().trim().min(1).max(120).optional(),
    unit: z.string().trim().min(1).max(40).optional(),
    description: z.string().trim().max(500).nullable().optional().describe("Send null to clear it."),
  }),
  async preview(p) {
    const item = await prisma.tashItem.findUnique({ where: { id: p.itemId }, select: { id: true, name: true, unit: true, description: true } });
    if (!item) throw new PlanError(`No ת״ש item with id "${p.itemId}". Look it up with search_tash first.`);
    const details: string[] = [];
    if (p.name !== undefined && p.name !== item.name) {
      if (await prisma.tashItem.findUnique({ where: { name: p.name }, select: { id: true } })) throw new PlanError(`כבר קיים פריט ת״ש בשם "${p.name}".`);
      details.push(`שם: ${item.name} ← ${p.name}`);
    }
    if (p.unit !== undefined && p.unit !== item.unit) details.push(`יחידת מידה: ${item.unit} ← ${p.unit}`);
    if (p.description !== undefined && (p.description || null) !== item.description) details.push(`תיאור: ${item.description || "ריק"} ← ${p.description || "ריק"}`);
    if (details.length === 0) throw new PlanError(`אין שינוי בפריט ${item.name}.`);
    return { title: `ת״ש: עריכת הפריט ${item.name}`, details };
  },
  async execute(p) {
    const item = await prisma.tashItem.findUniqueOrThrow({ where: { id: p.itemId }, select: { name: true, unit: true, description: true } });
    await run(
      updateTashItemAction(
        form({ id: p.itemId, name: p.name ?? item.name, unit: p.unit ?? item.unit, description: p.description === undefined ? item.description : p.description }),
      ),
    );
  },
});

const tashDeleteItem = define({
  name: "tash_delete_item",
  description: "Delete a ציוד ת״ש item for good, together with its quantities and its whole log (מחיקת פריט ת״ש).",
  schema: z.object({ itemId: id("ת״ש item") }),
  async preview(p) {
    const item = await getTashItem(p.itemId);
    const logs = await prisma.tashLog.count({ where: { itemId: item.id } });
    const held = item.inventory.filter((i) => i.quantity > 0);
    const total = held.reduce((s, i) => s + i.quantity, 0);
    return {
      title: `ת״ש: מחיקת הפריט ${item.name}`,
      details: held.map((i) => `${i.location}: ${i.quantity} ${item.unit}`),
      warnings: [
        total > 0
          ? `יימחקו ${total} ${item.unit} ב-${held.length} מיקומים, וגם ${logs} רשומות ביומן הת״ש של הפריט.`
          : `לפריט אין כמות כרגע. יימחקו ${logs} רשומות ביומן הת״ש שלו.`,
        IRREVERSIBLE,
      ],
    };
  },
  async execute(p) {
    await run(deleteTashItemAction(form({ id: p.itemId })));
  },
});

const tashSetQuantity = define({
  name: "tash_set_quantity",
  description:
    "Set the exact quantity of a ציוד ת״ש item at one location after a count (עדכון כמות לפי ספירה). The log records the difference. " +
    "For receiving or issuing a known amount use tash_add_quantity / tash_deduct_quantity.",
  schema: z.object({
    itemId: id("ת״ש item"),
    location: tashLocation,
    newQuantity: z.number().int().min(0).max(100000),
    notes: z.string().trim().max(500).optional().describe("Optional note for the ת״ש log"),
  }),
  async preview(p) {
    const item = await getTashItem(p.itemId);
    const now = tashQtyAt(item, p.location);
    if (now === p.newQuantity) throw new PlanError(`ב${p.location} כבר רשומים ${now} ${item.unit} של ${item.name}.`);
    const diff = p.newQuantity - now;
    return {
      title: `ת״ש: עדכון הכמות של ${item.name} ב${p.location}`,
      details: [`${now} ← ${p.newQuantity} ${item.unit} (${diff > 0 ? `תוספת של ${diff}` : `ירידה של ${-diff}`})`],
    };
  },
  async execute(p) {
    await run(setTashInventoryQuantityAction(form(p)));
  },
});

async function getTashLog(logId: string) {
  const log = await prisma.tashLog.findUnique({
    where: { id: logId },
    select: { id: true, itemId: true, action: true, quantity: true, fromLocation: true, toLocation: true, notes: true, createdAt: true, item: { select: { name: true, unit: true } } },
  });
  if (!log) throw new PlanError(`No ת״ש log entry with id "${logId}". Call tash_history for the ids.`);
  return log;
}

const TASH_ACTION_LABEL: Record<TashLogAction, string> = {
  ADDED: "הוספה",
  DEDUCTED: "הורדה",
  MOVED: "העברה",
  RETURNED: "החזרה",
  LOST: "אובדן",
  STOLEN: "גניבה",
  DAMAGED: "בלאי",
};

function describeLog(log: Awaited<ReturnType<typeof getTashLog>>) {
  const where = [log.fromLocation, log.toLocation].filter(Boolean).join(" ← ");
  return `${TASH_ACTION_LABEL[log.action]} של ${log.quantity} ${log.item.unit} ${log.item.name}${where ? ` (${where})` : ""}, ${log.createdAt.toISOString().slice(0, 10)}`;
}

const tashEditLogNote = define({
  name: "tash_edit_log_note",
  description: "Change or clear the note on one line of the ציוד ת״ש log (עריכת הערה ביומן הת״ש). Quantities do not change.",
  schema: z.object({ logId: id("ת״ש log entry (logId from tash_history)"), notes: z.string().trim().max(2000).describe("The new note. Empty string clears it.") }),
  async preview(p) {
    const log = await getTashLog(p.logId);
    if ((log.notes ?? "") === p.notes) throw new PlanError("זו כבר ההערה שרשומה.");
    return { title: "ת״ש: עריכת הערה ביומן", details: [describeLog(log), `הערה: ${log.notes || "ריק"} ← ${p.notes || "ריק"}`] };
  },
  async execute(p) {
    await run(updateTashLogNotesAction(form({ id: p.logId, notes: p.notes })));
  },
});

const tashDeleteLogEntry = define({
  name: "tash_delete_log_entry",
  description:
    "Undo one ציוד ת״ש action: delete its line from the log and reverse its effect on the quantities (ביטול פעולת ת״ש / מחיקת רשומה מהיומן). " +
    "Use it to fix a mistaken entry.",
  schema: z.object({ logId: id("ת״ש log entry (logId from tash_history)") }),
  async preview(p) {
    const log = await getTashLog(p.logId);
    const item = await getTashItem(log.itemId);
    // What the reversal does, per location: +quantity goes back, -quantity is taken off.
    const effects: { location: string; delta: number }[] = [];
    if (log.action === "ADDED") {
      if (log.toLocation) effects.push({ location: log.toLocation, delta: -log.quantity });
    } else if (log.action === "MOVED" || log.action === "RETURNED") {
      if (log.toLocation) effects.push({ location: log.toLocation, delta: -log.quantity });
      if (log.fromLocation) effects.push({ location: log.fromLocation, delta: log.quantity });
    } else if (log.fromLocation) {
      effects.push({ location: log.fromLocation, delta: log.quantity });
    }
    if (effects.length === 0) throw new PlanError("הרשומה פגומה (חסר בה מיקום), ולא ניתן לבטל אותה.");
    const details = [describeLog(log)];
    for (const e of effects) {
      const now = tashQtyAt(item, e.location);
      if (now + e.delta < 0) {
        throw new PlanError(`לא ניתן לבטל את הרשומה: ב${e.location} יש היום רק ${now} ${item.unit}, והביטול דורש להוריד ${-e.delta}.`);
      }
      details.push(`${e.location}: ${now} ← ${now + e.delta} ${item.unit}`);
    }
    return { title: "ת״ש: ביטול פעולה ומחיקתה מהיומן", details, warnings: ["הרשומה נמחקת מהיומן והכמויות חוזרות למה שהיו לפני הפעולה."] };
  },
  async execute(p) {
    await run(deleteTashLogAction(form({ id: p.logId })));
  },
});

const tashDeleteSavedLocation = define({
  name: "tash_delete_saved_location",
  description:
    "Remove a location name from the list of saved ת״ש locations that the site suggests (מחיקת מיקום שמור). Quantities are not touched; only the suggestion disappears.",
  schema: z.object({ name: z.string().trim().min(1).max(120).describe("Saved location name, exactly as in search_tash → savedLocations") }),
  async preview(p) {
    const loc = await prisma.tashLocation.findUnique({ where: { name: p.name }, select: { id: true } });
    if (!loc) throw new PlanError(`אין מיקום שמור בשם "${p.name}". search_tash returns the saved locations.`);
    const held = await prisma.tashInventory.aggregate({ where: { location: p.name, quantity: { gt: 0 } }, _sum: { quantity: true }, _count: true });
    const units = held._sum.quantity ?? 0;
    return {
      title: `ת״ש: הסרת המיקום השמור "${p.name}"`,
      details: ["השם יורד מרשימת ההצעות בלבד."],
      ...(units > 0 ? { warnings: [`במיקום הזה רשומים כרגע ${units} יחידות של ${held._count} פריטים. הן נשארות כמו שהן.`] } : {}),
    };
  },
  async execute(p) {
    const loc = await prisma.tashLocation.findUnique({ where: { name: p.name }, select: { id: true } });
    if (!loc) throw new Error(`אין מיקום שמור בשם "${p.name}".`);
    await run(deleteTashLocationAction(form({ id: loc.id })));
  },
});

// ─── backup ───────────────────────────────────────────────────────────────────

const createBackupNow = define({
  name: "create_backup",
  description:
    "Take a full backup of the database right now (יצירת גיבוי). Offer it before a large or irreversible plan. Restoring a backup is not something the agent does; that is done from the backups screen.",
  superAdminOnly: true,
  schema: z.object({ label: z.string().trim().min(1).max(100).optional().describe("Short Hebrew label saying why, shown in the backups list") }),
  async preview(p) {
    return {
      title: "יצירת גיבוי מלא של בסיס הנתונים",
      details: [
        `תווית: ${p.label ?? "גיבוי דרך סוכן ה-AI"}`,
        blobConfigured() ? "הגיבוי נשמר במערכת וגם בעותק חיצוני." : "הגיבוי נשמר במערכת.",
        "שום נתון לא משתנה.",
      ],
    };
  },
  async execute(p, actor) {
    await createBackup({ kind: BackupKind.MANUAL, trigger: "manual", actorId: actor.id, label: p.label ?? "גיבוי דרך סוכן ה-AI" });
    await pruneBackups();
  },
});

export const ADMIN_ACTIONS: readonly AgentAction[] = [
  createDepartment,
  updateDepartment,
  deleteDepartment,
  reorderDepartments,
  createPosition,
  updatePosition,
  updateUserDetails,
  setUserDepartments,
  createUnitTemplate,
  updateUnitTemplate,
  unitTemplateSetItem,
  unitTemplateRemoveItem,
  deleteUnitTemplate,
  deleteItem,
  recoverWrittenOff,
  cancelRequest,
  tashUpdateItem,
  tashDeleteItem,
  tashSetQuantity,
  tashEditLogNote,
  tashDeleteLogEntry,
  tashDeleteSavedLocation,
  createBackupNow,
];
