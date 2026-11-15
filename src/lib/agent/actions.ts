import { z } from "zod";
import { Division, Priority, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { divisionLabel, priorityLabel, requestTypeLabel, roleLabel } from "@/lib/he";
import { PlanError, type AgentAction, type AgentActor, type StepView } from "./types";

import {
  addToBoxDirectBulkAction,
  adminAssignEquipmentBulkAction,
  adminTransferAssignmentAction,
  adminUnassignEquipmentBulkAction,
  moveToBoxBulkAction,
  removeFromBoxAction,
  restoreFromBoxAction,
  transferBoxItemAction,
} from "@/app/(app)/admin/users/[id]/equipment-actions";
import { createEmptyBoxAction } from "@/app/(app)/admin/boxes/actions";
import { upsertStorageInventoryAction } from "@/app/(app)/admin/storage/actions";
import {
  handleRequestItemsBatchAction,
  updateRequestNotesAction,
  updateRequestPriorityAction,
} from "@/app/(app)/admin/requests/actions";
import {
  adminCreateUserAction,
  adminUpdateUserActiveAction,
  superAdminUpdateUserRoleAction,
} from "@/app/(app)/admin/users/actions";
import { createItemAction, updateItemAction } from "@/app/(app)/admin/items/actions";
import {
  addTashQuantityAction,
  createTashItemAction,
  deductTashQuantityAction,
  markTashLossAction,
  moveTashQuantityAction,
} from "@/app/(app)/admin/tash/actions";

/**
 * Everything the AI agent is able to change.
 *
 * Each entry wraps one of the site's existing server actions, so the agent goes
 * through exactly the same validation, stock bookkeeping, history records and
 * permission checks as the buttons in the UI. Nothing here writes to the
 * database directly.
 *
 * Deliberately NOT available to the agent: deleting users / items / departments /
 * templates, database reset and restore, and theme changes.
 */

const YAMAH = "ימ״ח";
export const DEFAULT_NOTE = "בוצע באמצעות סוכן ה-AI";

// ─── helpers ──────────────────────────────────────────────────────────────────

const id = (what: string) => z.string().min(1).describe(`${what} – an id returned by a lookup tool. Never invent ids.`);
const qty = z.number().int().min(1).max(1000).describe("Quantity (whole number, at least 1)");
const notes = z
  .string()
  .trim()
  .max(500)
  .optional()
  .describe("Short reason in Hebrew, shown in the history. Use the operator's own reason when they gave one.");

function form(fields: Record<string, string | number | boolean | undefined | null>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) fd.set(k, String(v));
  }
  return fd;
}

/** Server actions either return { success, error } or throw. Normalise to "throws on failure". */
async function run(result: Promise<unknown>): Promise<void> {
  const r = await result;
  if (r && typeof r === "object" && "success" in r && (r as { success: unknown }).success === false) {
    throw new Error(String((r as { error?: unknown }).error ?? "הפעולה נכשלה."));
  }
}

function serialSuffix(serial: string | null | undefined) {
  return serial ? ` (מס׳ סידורי ${serial})` : "";
}

async function getUser(userId: string, opts: { mustBeActive?: boolean } = {}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, active: true, role: true, personalNumber: true, email: true },
  });
  if (!user) throw new PlanError(`No user with id "${userId}". Look the person up with search_users first.`);
  if (opts.mustBeActive && !user.active) throw new PlanError(`המשתמש ${user.name} אינו פעיל.`);
  return user;
}

async function getItem(equipmentItemId: string) {
  const item = await prisma.equipmentItem.findUnique({
    where: { id: equipmentItemId },
    select: {
      id: true,
      name: true,
      active: true,
      isWeapon: true,
      isSight: true,
      isClothing: true,
      isShoe: true,
      category: { select: { division: true } },
    },
  });
  if (!item) throw new PlanError(`No equipment item with id "${equipmentItemId}". Look it up with search_items first.`);
  return item;
}

async function yamahStock(equipmentItemId: string): Promise<number> {
  const inv = await prisma.storageInventory.findFirst({
    where: { equipmentItemId, location: { name: YAMAH, active: true } },
    select: { quantity: true },
  });
  return inv?.quantity ?? 0;
}

async function getAssignment(assignmentId: string, userId: string) {
  const a = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      userId: true,
      quantity: true,
      active: true,
      status: true,
      serialNumber: true,
      equipmentItem: { select: { id: true, name: true } },
    },
  });
  if (!a) throw new PlanError(`No assignment with id "${assignmentId}". Call get_user_equipment to get current ids.`);
  if (a.userId !== userId) throw new PlanError(`Assignment "${assignmentId}" does not belong to that user.`);
  return a;
}

async function getBoxItem(boxItemId: string, userId: string) {
  const b = await prisma.boxItem.findUnique({
    where: { id: boxItemId },
    select: {
      id: true,
      quantity: true,
      serialNumber: true,
      box: { select: { userId: true } },
      equipmentItem: { select: { id: true, name: true } },
    },
  });
  if (!b) throw new PlanError(`No box item with id "${boxItemId}". Call get_user_equipment to get current ids.`);
  if (b.box.userId !== userId) throw new PlanError(`Box item "${boxItemId}" is not in that user's box.`);
  return b;
}

async function getTashItem(itemId: string) {
  const item = await prisma.tashItem.findUnique({
    where: { id: itemId },
    select: { id: true, name: true, unit: true, inventory: { select: { location: true, quantity: true } } },
  });
  if (!item) throw new PlanError(`No ת״ש item with id "${itemId}". Look it up with search_tash first.`);
  return item;
}

function tashQtyAt(item: Awaited<ReturnType<typeof getTashItem>>, location: string) {
  return item.inventory.find((i) => i.location === location)?.quantity ?? 0;
}

function define<S extends z.ZodType>(action: AgentAction<S>): AgentAction {
  return action as unknown as AgentAction;
}

// ─── equipment: storage ⇄ soldier ─────────────────────────────────────────────

const itemLine = z.object({
  equipmentItemId: id("Equipment item"),
  quantity: qty,
  serialNumber: z.string().trim().min(1).optional().describe("Required for weapons and sights; one unit per serial number"),
});

const assignEquipment = define({
  name: "assign_equipment",
  description:
    "Sign equipment out of the ימ״ח storage to a soldier (הקצאת ציוד / החתמה). Stock in storage goes down, the soldier's signed equipment goes up.",
  schema: z.object({ userId: id("Soldier"), items: z.array(itemLine).min(1).max(50), notes }),
  async preview(p) {
    const user = await getUser(p.userId, { mustBeActive: true });
    const details: string[] = [];
    const needed = new Map<string, number>();
    for (const line of p.items) {
      const item = await getItem(line.equipmentItemId);
      if (!item.active) throw new PlanError(`הפריט ${item.name} אינו פעיל.`);
      if ((item.isWeapon || item.isSight) && !line.serialNumber) {
        throw new PlanError(`נדרש מספר סידורי עבור ${item.name}. Ask the operator for the serial number.`);
      }
      if (line.serialNumber && line.quantity !== 1) {
        throw new PlanError(`פריט עם מספר סידורי (${item.name}) מוקצה ביחידה אחת בכל שורה.`);
      }
      const total = (needed.get(item.id) ?? 0) + line.quantity;
      needed.set(item.id, total);
      const stock = await yamahStock(item.id);
      if (stock < total) throw new PlanError(`אין מספיק ${item.name} בימ״ח: זמין ${stock}, נדרש ${total}.`);
      details.push(`${line.quantity} × ${item.name}${serialSuffix(line.serialNumber)} · מלאי בימ״ח ${stock} ← ${stock - total}`);
    }
    return { title: `הקצאת ציוד מהימ״ח אל ${user.name}`, details };
  },
  async execute(p) {
    await run(
      adminAssignEquipmentBulkAction(
        form({ userId: p.userId, adminNotes: p.notes || DEFAULT_NOTE, lines: JSON.stringify(p.items) }),
      ),
    );
  },
});

const assignmentLine = z.object({ assignmentId: id("Assignment (a row of the soldier's signed equipment)"), quantity: qty });

const returnEquipment = define({
  name: "return_equipment_to_storage",
  description:
    "Take signed equipment off a soldier and put it back in the ימ״ח storage (ביטול הקצאה / זיכוי / החזרה לימ״ח).",
  schema: z.object({ userId: id("Soldier"), items: z.array(assignmentLine).min(1).max(50), notes }),
  async preview(p) {
    const user = await getUser(p.userId);
    const details: string[] = [];
    for (const line of p.items) {
      const a = await getAssignment(line.assignmentId, p.userId);
      if (line.quantity > a.quantity) {
        throw new PlanError(`ל${user.name} יש רק ${a.quantity} × ${a.equipmentItem.name}, אי אפשר להחזיר ${line.quantity}.`);
      }
      details.push(`${line.quantity} × ${a.equipmentItem.name}${serialSuffix(a.serialNumber)} · נשאר אצלו ${a.quantity - line.quantity}`);
    }
    return { title: `החזרת ציוד מ${user.name} לימ״ח`, details };
  },
  async execute(p) {
    await run(
      adminUnassignEquipmentBulkAction(
        form({ userId: p.userId, adminNotes: p.notes || DEFAULT_NOTE, lines: JSON.stringify(p.items) }),
      ),
    );
  },
});

const transferEquipment = define({
  name: "transfer_equipment",
  description:
    "Move signed equipment directly from one soldier to another (העברת ציוד בין חיילים). One assignment per step; add several steps for several items.",
  schema: z.object({
    fromUserId: id("Soldier who holds the equipment now"),
    toUserId: id("Soldier who receives it"),
    assignmentId: id("Assignment of the source soldier"),
    quantity: qty,
    notes,
  }),
  async preview(p) {
    if (p.fromUserId === p.toUserId) throw new PlanError("המקור והיעד הם אותו חייל.");
    const from = await getUser(p.fromUserId);
    const to = await getUser(p.toUserId, { mustBeActive: true });
    const a = await getAssignment(p.assignmentId, p.fromUserId);
    if (!a.active || a.status !== "ASSIGNED") throw new PlanError(`ההקצאה של ${a.equipmentItem.name} אינה פעילה להעברה.`);
    if (p.quantity > a.quantity) {
      throw new PlanError(`ל${from.name} יש רק ${a.quantity} × ${a.equipmentItem.name}, אי אפשר להעביר ${p.quantity}.`);
    }
    if (a.serialNumber && p.quantity !== a.quantity) throw new PlanError("בפריט עם מספר סידורי יש להעביר את כל הכמות.");
    return {
      title: `העברת ציוד מ${from.name} אל ${to.name}`,
      details: [`${p.quantity} × ${a.equipmentItem.name}${serialSuffix(a.serialNumber)} · נשאר אצל ${from.name}: ${a.quantity - p.quantity}`],
    };
  },
  async execute(p) {
    await run(
      adminTransferAssignmentAction(
        form({
          fromUserId: p.fromUserId,
          toUserId: p.toUserId,
          assignmentId: p.assignmentId,
          quantity: p.quantity,
          adminNotes: p.notes || DEFAULT_NOTE,
        }),
      ),
    );
  },
});

// ─── equipment: boxes (קרטונים) ───────────────────────────────────────────────

const moveToBox = define({
  name: "move_to_box",
  description:
    "Move equipment the soldier is signed on into that soldier's own box (העברה לקרטון). Only items defined in the box template can go in.",
  schema: z.object({ userId: id("Soldier"), items: z.array(assignmentLine).min(1).max(50) }),
  async preview(p) {
    const user = await getUser(p.userId);
    const details: string[] = [];
    for (const line of p.items) {
      const a = await getAssignment(line.assignmentId, p.userId);
      if (line.quantity > a.quantity) {
        throw new PlanError(`ל${user.name} יש רק ${a.quantity} × ${a.equipmentItem.name}, אי אפשר להעביר ${line.quantity} לקרטון.`);
      }
      details.push(`${line.quantity} × ${a.equipmentItem.name}${serialSuffix(a.serialNumber)}`);
    }
    return { title: `העברה לקרטון של ${user.name}`, details };
  },
  async execute(p) {
    await run(moveToBoxBulkAction(form({ userId: p.userId, lines: JSON.stringify(p.items) })));
  },
});

const boxItemParams = z.object({ userId: id("Soldier who owns the box"), boxItemId: id("Box item"), quantity: qty });

const restoreFromBox = define({
  name: "restore_from_box",
  description: "Take an item out of a soldier's box and sign it back onto the same soldier (שחזור מקרטון / הוצאה מהקרטון לחייל).",
  schema: boxItemParams,
  async preview(p) {
    const user = await getUser(p.userId);
    const b = await getBoxItem(p.boxItemId, p.userId);
    if (p.quantity > b.quantity) throw new PlanError(`בקרטון יש רק ${b.quantity} × ${b.equipmentItem.name}.`);
    return {
      title: `הוצאה מהקרטון של ${user.name} חזרה לחתימתו`,
      details: [`${p.quantity} × ${b.equipmentItem.name}${serialSuffix(b.serialNumber)} · נשאר בקרטון ${b.quantity - p.quantity}`],
    };
  },
  async execute(p) {
    await run(restoreFromBoxAction(form(p)));
  },
});

const removeFromBox = define({
  name: "remove_from_box_to_storage",
  description: "Take an item out of a soldier's box and return it to the ימ״ח storage (הסרה מהקרטון לימ״ח).",
  schema: boxItemParams,
  async preview(p) {
    const user = await getUser(p.userId);
    const b = await getBoxItem(p.boxItemId, p.userId);
    if (p.quantity > b.quantity) throw new PlanError(`בקרטון יש רק ${b.quantity} × ${b.equipmentItem.name}.`);
    return {
      title: `הסרה מהקרטון של ${user.name} והחזרה לימ״ח`,
      details: [`${p.quantity} × ${b.equipmentItem.name}${serialSuffix(b.serialNumber)} · נשאר בקרטון ${b.quantity - p.quantity}`],
    };
  },
  async execute(p) {
    await run(removeFromBoxAction(form(p)));
  },
});

const transferBoxItem = define({
  name: "transfer_box_item",
  description: "Move an item from one soldier's box into another soldier's box (העברה לקרטון אחר).",
  schema: z.object({
    fromUserId: id("Soldier whose box holds the item"),
    toUserId: id("Soldier whose box receives it"),
    boxItemId: id("Box item"),
    quantity: qty,
  }),
  async preview(p) {
    if (p.fromUserId === p.toUserId) throw new PlanError("המקור והיעד הם אותו חייל.");
    const from = await getUser(p.fromUserId);
    const to = await getUser(p.toUserId, { mustBeActive: true });
    const b = await getBoxItem(p.boxItemId, p.fromUserId);
    if (p.quantity > b.quantity) throw new PlanError(`בקרטון של ${from.name} יש רק ${b.quantity} × ${b.equipmentItem.name}.`);
    return {
      title: `העברה מהקרטון של ${from.name} לקרטון של ${to.name}`,
      details: [`${p.quantity} × ${b.equipmentItem.name}${serialSuffix(b.serialNumber)}`],
    };
  },
  async execute(p) {
    await run(transferBoxItemAction(form(p)));
  },
});

const addToBoxFromStorage = define({
  name: "add_to_box_from_storage",
  description:
    "Put equipment from the ימ״ח storage straight into a soldier's box, without signing it on the soldier first (הוספה לקרטון מהימ״ח).",
  schema: z.object({ userId: id("Soldier who owns the box"), items: z.array(itemLine).min(1).max(50), notes }),
  async preview(p) {
    const user = await getUser(p.userId, { mustBeActive: true });
    const details: string[] = [];
    const needed = new Map<string, number>();
    for (const line of p.items) {
      const item = await getItem(line.equipmentItemId);
      const total = (needed.get(item.id) ?? 0) + line.quantity;
      needed.set(item.id, total);
      const stock = await yamahStock(item.id);
      if (stock < total) throw new PlanError(`אין מספיק ${item.name} בימ״ח: זמין ${stock}, נדרש ${total}.`);
      details.push(`${line.quantity} × ${item.name}${serialSuffix(line.serialNumber)} · מלאי בימ״ח ${stock} ← ${stock - total}`);
    }
    return { title: `הוספה לקרטון של ${user.name} ישירות מהימ״ח`, details };
  },
  async execute(p) {
    await run(
      addToBoxDirectBulkAction(form({ userId: p.userId, adminNotes: p.notes || DEFAULT_NOTE, lines: JSON.stringify(p.items) })),
    );
  },
});

const createBox = define({
  name: "create_box",
  description: "Create an empty box for a soldier who does not have one yet (יצירת קרטון).",
  schema: z.object({ userId: id("Soldier") }),
  async preview(p) {
    const user = await getUser(p.userId, { mustBeActive: true });
    const existing = await prisma.box.findUnique({ where: { userId: p.userId }, select: { id: true } });
    if (existing) throw new PlanError(`ל${user.name} כבר קיים קרטון.`);
    return { title: `יצירת קרטון ריק עבור ${user.name}`, details: [] };
  },
  async execute(p) {
    await run(createEmptyBoxAction(p.userId));
  },
});

// ─── storage ──────────────────────────────────────────────────────────────────

const setStorageQuantity = define({
  name: "set_storage_quantity",
  description:
    "Set the absolute quantity of an item in the ימ״ח storage (עדכון מלאי / ספירת מלאי). This overwrites the number; to add 5, read the current stock and send current + 5.",
  schema: z.object({
    equipmentItemId: id("Equipment item"),
    quantity: z.number().int().min(0).max(100000).describe("The new total quantity in storage"),
  }),
  async preview(p) {
    const item = await getItem(p.equipmentItemId);
    const stock = await yamahStock(item.id);
    if (stock === p.quantity) throw new PlanError(`המלאי של ${item.name} בימ״ח כבר ${stock}. אין מה לשנות.`);
    const delta = p.quantity - stock;
    return {
      title: `עדכון מלאי בימ״ח: ${item.name}`,
      details: [`${stock} ← ${p.quantity} (${delta > 0 ? "+" : ""}${delta})`],
    };
  },
  async execute(p) {
    await run(upsertStorageInventoryAction(form(p)));
  },
});

// ─── requests ─────────────────────────────────────────────────────────────────

const REQUEST_ITEM_ACTION_LABEL = { FULFILL: "אישור", DENY: "דחייה", CANCEL: "ביטול", RESET: "החזרה למצב ממתין" } as const;

async function getRequest(requestId: string) {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      type: true,
      status: true,
      priority: true,
      adminNotes: true,
      requester: { select: { name: true } },
      items: {
        select: { id: true, quantity: true, status: true, equipmentItem: { select: { name: true, isWeapon: true, isSight: true } } },
      },
    },
  });
  if (!request) throw new PlanError(`No request with id "${requestId}". Use list_requests to find it.`);
  return request;
}

const handleRequestItems = define({
  name: "handle_request_items",
  description:
    "Approve (FULFILL), deny (DENY), cancel (CANCEL) or reopen (RESET) lines of a soldier's request (טיפול בבקשה). FULFILL performs the request: new equipment is signed out of storage, returns go back to storage, and so on.",
  schema: z.object({
    requestId: id("Request"),
    operations: z
      .array(
        z.object({
          requestItemId: id("Request line"),
          action: z.enum(["FULFILL", "DENY", "CANCEL", "RESET"]),
          quantity: z.number().int().min(1).max(1000).optional().describe("For a partial FULFILL. Omit to fulfil the whole line."),
          serialNumber: z.string().trim().min(1).optional().describe("Required when fulfilling a weapon or sight"),
        }),
      )
      .min(1)
      .max(50),
  }),
  async preview(p) {
    const request = await getRequest(p.requestId);
    if (request.type === "ADMIN_EQUIPMENT_TRANSFER") throw new PlanError("רשומת העברה ניהולית — לא ניתן לשנות אותה.");
    const details: string[] = [];
    for (const op of p.operations) {
      const line = request.items.find((i) => i.id === op.requestItemId);
      if (!line) throw new PlanError(`Request line "${op.requestItemId}" is not part of request "${p.requestId}". Call get_request for the current lines.`);
      if (op.action === "FULFILL") {
        if ((line.equipmentItem.isWeapon || line.equipmentItem.isSight) && !op.serialNumber) {
          throw new PlanError(`נדרש מספר סידורי כדי לאשר ${line.equipmentItem.name}. Ask the operator for it.`);
        }
        if (op.quantity && op.quantity > Math.abs(line.quantity)) {
          throw new PlanError(`לא ניתן לספק ${op.quantity} × ${line.equipmentItem.name}: התבקשו ${Math.abs(line.quantity)}.`);
        }
      }
      if (op.action === "RESET" && line.status === "PENDING") throw new PlanError(`השורה ${line.equipmentItem.name} כבר במצב ממתין.`);
      details.push(
        `${REQUEST_ITEM_ACTION_LABEL[op.action]}: ${op.quantity ?? Math.abs(line.quantity)} × ${line.equipmentItem.name}${serialSuffix(op.serialNumber)}`,
      );
    }
    return { title: `טיפול בבקשת "${requestTypeLabel(request.type)}" של ${request.requester.name}`, details };
  },
  async execute(p) {
    await run(handleRequestItemsBatchAction(form({ requestId: p.requestId, operations: JSON.stringify(p.operations) })));
  },
});

const setRequestPriority = define({
  name: "set_request_priority",
  description: "Change the priority of a request (שינוי עדיפות).",
  schema: z.object({ requestId: id("Request"), priority: z.enum(Priority) }),
  async preview(p) {
    const request = await getRequest(p.requestId);
    if (request.priority === p.priority) throw new PlanError(`העדיפות כבר ${priorityLabel(p.priority)}.`);
    return {
      title: `שינוי עדיפות לבקשה של ${request.requester.name}`,
      details: [`${priorityLabel(request.priority)} ← ${priorityLabel(p.priority)}`],
    };
  },
  async execute(p) {
    await run(updateRequestPriorityAction(form({ id: p.requestId, priority: p.priority })));
  },
});

const setRequestNotes = define({
  name: "set_request_notes",
  description: "Replace the admin notes of a request (הערות מנהל). Overwrites the existing notes.",
  schema: z.object({ requestId: id("Request"), notes: z.string().trim().max(2000).describe("The full new notes text") }),
  async preview(p) {
    const request = await getRequest(p.requestId);
    return {
      title: `עדכון הערות מנהל לבקשה של ${request.requester.name}`,
      details: [`קודם: ${request.adminNotes?.trim() || "(ריק)"}`, `חדש: ${p.notes || "(ריק)"}`],
    };
  },
  async execute(p) {
    await run(updateRequestNotesAction(form({ id: p.requestId, notes: p.notes })));
  },
});

// ─── users ────────────────────────────────────────────────────────────────────

const setUserActive = define({
  name: "set_user_active",
  description: "Activate or deactivate a user account (הפעלה / השבתה של משתמש). A deactivated user cannot sign in.",
  schema: z.object({ userId: id("User"), active: z.boolean() }),
  async preview(p, actor) {
    const user = await getUser(p.userId);
    if (user.active === p.active) throw new PlanError(`${user.name} כבר ${p.active ? "פעיל" : "לא פעיל"}.`);
    if (user.id === actor.id && !p.active) throw new PlanError("לא ניתן להשבית את החשבון של עצמך דרך הסוכן.");
    return { title: `${p.active ? "הפעלת" : "השבתת"} המשתמש ${user.name}`, details: [`תפקיד: ${roleLabel(user.role)}`] };
  },
  async execute(p) {
    await run(adminUpdateUserActiveAction(form({ userId: p.userId, active: p.active })));
  },
});

const setUserRole = define({
  name: "set_user_role",
  description: "Change a user's permission level (שינוי הרשאה): USER, ADMIN, VIEW_ONLY, SUPER_ADMIN or THEME_MASTER.",
  superAdminOnly: true,
  schema: z.object({ userId: id("User"), role: z.enum(Role) }),
  async preview(p, actor) {
    const user = await getUser(p.userId);
    if (user.id === actor.id) throw new PlanError("לא ניתן לשנות את התפקיד של עצמך.");
    if (user.role === p.role) throw new PlanError(`${user.name} כבר בתפקיד ${roleLabel(p.role)}.`);
    return { title: `שינוי הרשאה למשתמש ${user.name}`, details: [`${roleLabel(user.role)} ← ${roleLabel(p.role)}`] };
  },
  async execute(p) {
    await run(superAdminUpdateUserRoleAction(form({ userId: p.userId, role: p.role })));
  },
});

const createUser = define({
  name: "create_user",
  description: "Create a new user so they can sign in with Google (הוספת משתמש חדש). They start as a regular soldier.",
  schema: z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z.email().describe("The Google account email the person will sign in with"),
    personalNumber: z.string().trim().min(1).optional(),
    phoneNumber: z.string().trim().min(1).optional(),
  }),
  async preview(p) {
    const email = p.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new PlanError("כבר קיים משתמש עם כתובת אימייל זו.");
    }
    if (p.personalNumber && (await prisma.user.findUnique({ where: { personalNumber: p.personalNumber }, select: { id: true } }))) {
      throw new PlanError("כבר קיים משתמש עם מספר אישי זה.");
    }
    return {
      title: `יצירת משתמש חדש: ${p.firstName} ${p.lastName}`,
      details: [
        `אימייל: ${email}`,
        ...(p.personalNumber ? [`מספר אישי: ${p.personalNumber}`] : []),
        ...(p.phoneNumber ? [`טלפון: ${p.phoneNumber}`] : []),
      ],
    };
  },
  async execute(p) {
    await run(adminCreateUserAction(form(p)));
  },
});

// ─── equipment catalog ────────────────────────────────────────────────────────

const itemFlags = {
  isWeapon: z.boolean().optional().describe("נשק – needs a serial number"),
  isSight: z.boolean().optional().describe("כוונת / צלמ – needs a serial number"),
  isClothing: z.boolean().optional().describe("ביגוד – has a clothing size"),
  isShoe: z.boolean().optional().describe("הנעלה – has a shoe size"),
};

function flagLabels(f: { isWeapon?: boolean; isSight?: boolean; isClothing?: boolean; isShoe?: boolean }) {
  const out = [f.isWeapon && "נשק", f.isSight && "כוונת", f.isClothing && "ביגוד", f.isShoe && "הנעלה"].filter(Boolean);
  return out.length ? out.join(", ") : "רגיל";
}

const createItem = define({
  name: "create_item",
  description: "Add a new equipment type to the catalog (הוספת פריט ציוד חדש). It starts with 0 in storage.",
  schema: z.object({
    name: z.string().trim().min(1).max(120),
    division: z.enum(Division).describe("COMBAT = ציוד קרבי, LOGISTICS = ציוד משקי, MEDICAL = ציוד רפואי"),
    ...itemFlags,
  }),
  async preview(p) {
    const dup = await prisma.equipmentItem.findFirst({
      where: { name: p.name, category: { division: p.division } },
      select: { id: true },
    });
    if (dup) throw new PlanError(`כבר קיים פריט בשם "${p.name}" ב${divisionLabel(p.division)}.`);
    return { title: `הוספת פריט חדש לקטלוג: ${p.name}`, details: [divisionLabel(p.division), `סוג: ${flagLabels(p)}`] };
  },
  async execute(p) {
    await run(
      createItemAction(
        form({
          name: p.name,
          division: p.division,
          isWeapon: !!p.isWeapon,
          isSight: !!p.isSight,
          isClothing: !!p.isClothing,
          isShoe: !!p.isShoe,
        }),
      ),
    );
  },
});

const updateItem = define({
  name: "update_item",
  description:
    "Rename an equipment type, move it to another division, change its flags, or deactivate / reactivate it (עריכת פריט). Send only the fields that change.",
  schema: z.object({
    equipmentItemId: id("Equipment item"),
    name: z.string().trim().min(1).max(120).optional(),
    division: z.enum(Division).optional(),
    active: z.boolean().optional().describe("false hides the item from new requests; nothing is deleted"),
    ...itemFlags,
  }),
  async preview(p) {
    const item = await getItem(p.equipmentItemId);
    const details: string[] = [];
    if (p.name !== undefined && p.name !== item.name) details.push(`שם: ${item.name} ← ${p.name}`);
    if (p.division !== undefined && p.division !== item.category.division) {
      details.push(`מחלקה: ${divisionLabel(item.category.division)} ← ${divisionLabel(p.division)}`);
    }
    if (p.active !== undefined && p.active !== item.active) details.push(p.active ? "הפעלה מחדש" : "השבתה (הפריט לא יימחק)");
    const next = {
      isWeapon: p.isWeapon ?? item.isWeapon,
      isSight: p.isSight ?? item.isSight,
      isClothing: p.isClothing ?? item.isClothing,
      isShoe: p.isShoe ?? item.isShoe,
    };
    if (flagLabels(next) !== flagLabels(item)) details.push(`סוג: ${flagLabels(item)} ← ${flagLabels(next)}`);
    if (details.length === 0) throw new PlanError(`אין שינוי בפריט ${item.name}.`);
    return { title: `עריכת הפריט ${item.name}`, details };
  },
  async execute(p) {
    const item = await getItem(p.equipmentItemId);
    await run(
      updateItemAction(
        form({
          id: item.id,
          name: p.name ?? item.name,
          division: p.division ?? item.category.division,
          active: p.active ?? item.active,
          isWeapon: p.isWeapon ?? item.isWeapon,
          isSight: p.isSight ?? item.isSight,
          isClothing: p.isClothing ?? item.isClothing,
          isShoe: p.isShoe ?? item.isShoe,
        }),
      ),
    );
  },
});

// ─── ציוד ת״ש ──────────────────────────────────────────────────────────────────

const tashLocation = z.string().trim().min(1).max(120).describe(`Location name exactly as returned by search_tash (the main store is "${YAMAH}")`);
const tashQty = z.number().int().min(1).max(100000);
const tashNotes = z.string().trim().max(500).optional().describe("Optional note for the ת״ש log");

const tashCreateItem = define({
  name: "tash_create_item",
  description: "Add a new ציוד ת״ש item type (it starts with no quantity anywhere).",
  schema: z.object({
    name: z.string().trim().min(1).max(120),
    unit: z.string().trim().min(1).max(40).optional().describe('Unit of measure, default "יחידה"'),
    description: z.string().trim().max(500).optional(),
  }),
  async preview(p) {
    if (await prisma.tashItem.findUnique({ where: { name: p.name }, select: { id: true } })) {
      throw new PlanError(`כבר קיים פריט ת״ש בשם "${p.name}".`);
    }
    return { title: `הוספת פריט ת״ש חדש: ${p.name}`, details: [`יחידת מידה: ${p.unit ?? "יחידה"}`, ...(p.description ? [p.description] : [])] };
  },
  async execute(p) {
    await run(createTashItemAction(form(p)));
  },
});

const tashAdd = define({
  name: "tash_add_quantity",
  description: "Add quantity of a ציוד ת״ש item at a location (קליטת כמות).",
  schema: z.object({ itemId: id("ת״ש item"), location: tashLocation, quantity: tashQty, notes: tashNotes }),
  async preview(p) {
    const item = await getTashItem(p.itemId);
    const now = tashQtyAt(item, p.location);
    return { title: `ת״ש: הוספת ${p.quantity} ${item.unit} של ${item.name}`, details: [`מיקום: ${p.location} · ${now} ← ${now + p.quantity}`] };
  },
  async execute(p) {
    await run(addTashQuantityAction(form(p)));
  },
});

const tashDeduct = define({
  name: "tash_deduct_quantity",
  description: "Remove quantity of a ציוד ת״ש item from a location (הורדת כמות / ניפוק).",
  schema: z.object({ itemId: id("ת״ש item"), location: tashLocation, quantity: tashQty, notes: tashNotes }),
  async preview(p) {
    const item = await getTashItem(p.itemId);
    const now = tashQtyAt(item, p.location);
    if (now < p.quantity) throw new PlanError(`ב${p.location} יש רק ${now} ${item.unit} של ${item.name}.`);
    return { title: `ת״ש: הורדת ${p.quantity} ${item.unit} של ${item.name}`, details: [`מיקום: ${p.location} · ${now} ← ${now - p.quantity}`] };
  },
  async execute(p) {
    await run(deductTashQuantityAction(form(p)));
  },
});

const tashMove = define({
  name: "tash_move_quantity",
  description: "Move a ציוד ת״ש item between locations (העברה בין מיקומים).",
  schema: z.object({ itemId: id("ת״ש item"), fromLocation: tashLocation, toLocation: tashLocation, quantity: tashQty, notes: tashNotes }),
  async preview(p) {
    if (p.fromLocation === p.toLocation) throw new PlanError("מיקום המקור והיעד זהים.");
    const item = await getTashItem(p.itemId);
    const now = tashQtyAt(item, p.fromLocation);
    if (now < p.quantity) throw new PlanError(`ב${p.fromLocation} יש רק ${now} ${item.unit} של ${item.name}.`);
    return {
      title: `ת״ש: העברת ${p.quantity} ${item.unit} של ${item.name}`,
      details: [`${p.fromLocation} (${now} ← ${now - p.quantity}) אל ${p.toLocation} (${tashQtyAt(item, p.toLocation)} ← ${tashQtyAt(item, p.toLocation) + p.quantity})`],
    };
  },
  async execute(p) {
    await run(moveTashQuantityAction(form(p)));
  },
});

const TASH_LOSS_LABEL = { LOST: "אבד", STOLEN: "נגנב", DAMAGED: "בלאי" } as const;

const tashMarkLoss = define({
  name: "tash_mark_loss",
  description: "Write off ציוד ת״ש as lost, stolen or damaged at a location (סימון אובדן / גניבה / בלאי).",
  schema: z.object({
    itemId: id("ת״ש item"),
    location: tashLocation,
    kind: z.enum(["LOST", "STOLEN", "DAMAGED"]),
    quantity: tashQty,
    notes: tashNotes,
  }),
  async preview(p) {
    const item = await getTashItem(p.itemId);
    const now = tashQtyAt(item, p.location);
    if (now < p.quantity) throw new PlanError(`ב${p.location} יש רק ${now} ${item.unit} של ${item.name}.`);
    return {
      title: `ת״ש: סימון ${p.quantity} ${item.unit} של ${item.name} כ"${TASH_LOSS_LABEL[p.kind]}"`,
      details: [`מיקום: ${p.location} · ${now} ← ${now - p.quantity}`],
    };
  },
  async execute(p) {
    await run(markTashLossAction(form({ itemId: p.itemId, location: p.location, action: p.kind, quantity: p.quantity, notes: p.notes })));
  },
});

// ─── registry ─────────────────────────────────────────────────────────────────

export const AGENT_ACTIONS: readonly AgentAction[] = [
  assignEquipment,
  returnEquipment,
  transferEquipment,
  moveToBox,
  restoreFromBox,
  removeFromBox,
  transferBoxItem,
  addToBoxFromStorage,
  createBox,
  setStorageQuantity,
  handleRequestItems,
  setRequestPriority,
  setRequestNotes,
  setUserActive,
  setUserRole,
  createUser,
  createItem,
  updateItem,
  tashCreateItem,
  tashAdd,
  tashDeduct,
  tashMove,
  tashMarkLoss,
];

const BY_NAME = new Map(AGENT_ACTIONS.map((a) => [a.name, a]));

export function getAgentAction(name: string): AgentAction | undefined {
  return BY_NAME.get(name);
}

export function actionAllowedFor(action: AgentAction, actor: AgentActor): boolean {
  if (!action.superAdminOnly) return true;
  return actor.role === Role.SUPER_ADMIN || actor.role === Role.THEME_MASTER;
}

/** Parse + check against live data + describe. Used when drafting and again right before executing. */
export async function previewStep(
  actionName: string,
  rawParams: unknown,
  actor: AgentActor,
): Promise<{ action: AgentAction; params: Record<string, unknown>; view: StepView }> {
  const action = getAgentAction(actionName);
  if (!action) throw new PlanError(`Unknown action "${actionName}".`);
  if (!actionAllowedFor(action, actor)) throw new PlanError("אין לך הרשאה לפעולה זו.");
  const parsed = action.schema.safeParse(rawParams);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(input)"}: ${i.message}`).join("; ");
    throw new PlanError(`Invalid parameters – ${issues}`);
  }
  const view = await action.preview(parsed.data, actor);
  return { action, params: parsed.data as Record<string, unknown>, view };
}
