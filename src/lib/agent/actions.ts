import { z } from "zod";
import { Division, Priority, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { divisionLabel, priorityLabel, requestTypeLabel, roleLabel } from "@/lib/he";
import { PlanError, type AgentAction, type AgentActor, type PrerequisiteStep, type PreviewContext, type StepView } from "./types";
import {
  boxRowsFor,
  excessRemovals,
  loadTemplateSlots,
  perBoxTotals,
  slotAccepting,
  slotItemIds,
  slotLabel,
  slotStanding,
  usage,
  type BoxRow,
  type TemplateSlot,
} from "./boxTemplateData";

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
import { createEmptyBoxAction, reassignBoxAction } from "@/app/(app)/admin/boxes/actions";
import { ADMIN_ACTIONS } from "./actionsAdmin";
import {
  addAlternativeAction,
  addBoxTemplateItemAction,
  removeAlternativeAction,
  removeBoxTemplateItemAction,
  updateGroupNameAction,
} from "@/app/(app)/admin/inventory/box-template/actions";
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
 * The catalogue is split in two files: equipment, boxes, the box template, stock,
 * requests, users and ת״ש quantities here; organisation, unit templates,
 * deletions and the rest of the admin screens in actionsAdmin.ts.
 *
 * Deliberately NOT available to the agent: restoring a backup, resetting the
 * database, and personal settings (the operator's own profile and theme).
 *
 * Steps that reach beyond the record they name (a template change affects every
 * box, deactivating a user leaves equipment signed on them…) return `warnings`,
 * which the plan card shows in amber. Where a clean way exists, the action can
 * also plan it: see `prerequisites`.
 */

import {
  DEFAULT_NOTE,
  YAMAH,
  define,
  form,
  getAssignment,
  getBoxItem,
  getItem,
  getTashItem,
  getUser,
  id,
  notes,
  qty,
  run,
  serialSuffix,
  tashQtyAt,
  yamahStock,
} from "./actionKit";

export { DEFAULT_NOTE };


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

/** Boxes that earlier steps of the plan hand over: who gives one away and who receives one. */
function boxHandovers(ctx: PreviewContext): { gaveAway: Set<string>; received: Set<string> } {
  const gaveAway = new Set<string>();
  const received = new Set<string>();
  for (const step of ctx.earlierSteps) {
    if (step.action !== "reassign_box") continue;
    gaveAway.add(String(step.params.fromUserId ?? ""));
    received.add(String(step.params.toUserId ?? ""));
  }
  return { gaveAway, received };
}

const reassignBox = define({
  name: "reassign_box",
  description:
    "Hand a whole box over to another person: the box keeps everything inside it and only the name on it changes " +
    "(שינוי השם על הקרטון / העברת קרטון לחייל אחר). Use it when someone left the unit and another soldier takes over their box. " +
    "No equipment moves and stock does not change. The new owner must be an active user who has no box, or only an empty one (it is replaced). " +
    "One step per box. To find the boxes use list_boxes (ownerActive: false lists boxes of deactivated users) and for people without a box use list_users (hasBox: false). " +
    "When the operator did not say who receives which box, ask, unless they said the pairing does not matter.",
  schema: z.object({
    fromUserId: id("The person whose name is on the box now"),
    toUserId: id("The person who takes the box over"),
  }),
  async preview(p, _actor, ctx) {
    if (p.fromUserId === p.toUserId) throw new PlanError("הקרטון כבר רשום על המשתמש הזה.");
    const from = await getUser(p.fromUserId);
    const to = await getUser(p.toUserId, { mustBeActive: true });
    const moves = boxHandovers(ctx);
    if (moves.gaveAway.has(from.id)) throw new PlanError(`הקרטון של ${from.name} כבר מועבר בצעד קודם באותה תוכנית.`);
    if (moves.received.has(from.id)) {
      throw new PlanError(`${from.name} רק מקבל קרטון בצעד קודם באותה תוכנית. Plan each box once, straight to its final owner.`);
    }
    if (moves.received.has(to.id)) throw new PlanError(`${to.name} כבר מקבל קרטון בצעד קודם באותה תוכנית. לכל אדם יכול להיות קרטון אחד.`);

    const box = await prisma.box.findUnique({
      where: { userId: from.id },
      select: { items: { orderBy: { equipmentItem: { name: "asc" } }, select: { quantity: true, serialNumber: true, equipmentItem: { select: { name: true } } } } },
    });
    if (!box) throw new PlanError(`ל${from.name} אין קרטון.`);

    const targetBox = moves.gaveAway.has(to.id)
      ? null
      : await prisma.box.findUnique({ where: { userId: to.id }, select: { items: { select: { quantity: true } } } });
    const targetUnits = targetBox
      ? Math.max(0, targetBox.items.reduce((s, i) => s + i.quantity, 0) - pendingForUser(to.id, ctx).boxLeaving)
      : 0;
    if (targetUnits > 0) {
      throw new PlanError(
        `ל${to.name} כבר יש קרטון עם ${targetUnits} יחידות ציוד, ולא דורסים קרטון עם ציוד. ` +
          `Options to offer the operator: pick someone who has no box; empty ${to.name}'s box first (to the ימ״ח or back to their signature); or move single items with transfer_box_item.`,
      );
    }

    const units = box.items.reduce((s, i) => s + i.quantity, 0);
    const lines = box.items.map((i) => `${i.quantity} × ${i.equipmentItem.name}${serialSuffix(i.serialNumber)}`);
    const details = [
      units === 0 ? "הקרטון ריק." : `הקרטון עובר כמו שהוא: ${units} יחידות ב-${box.items.length} שורות. הציוד לא זז והמלאי לא משתנה.`,
      ...lines.slice(0, 8),
      ...(lines.length > 8 ? [`ועוד ${lines.length - 8} שורות`] : []),
      ...(targetBox ? [`הקרטון הריק שרשום היום על ${to.name} יוסר ויוחלף בקרטון הזה.`] : []),
    ];
    const warnings = from.active ? [`${from.name} עדיין משתמש פעיל, ואחרי ההעברה לא יהיה לו קרטון.`] : [];
    return {
      title: `העברת הקרטון של ${from.name} אל ${to.name}`,
      details,
      ...(warnings.length ? { warnings } : {}),
    };
  },
  async execute(p) {
    await run(reassignBoxAction(p.fromUserId, p.toUserId));
  },
});

// ─── box template (תבנית קרטון) ───────────────────────────────────────────────
// A template change reaches every soldier's box, so each of these says what it
// will do to the boxes that exist, and can plan the clean-up first.

// What earlier steps of the same plan will already have taken out by the time a step runs.

type Line = { assignmentId?: string; quantity?: number };

/** boxItemId → units that earlier steps of the plan take out of boxes. */
function pendingBoxRemovals(ctx: PreviewContext): Map<string, number> {
  const out = new Map<string, number>();
  for (const step of ctx.earlierSteps) {
    if (!["remove_from_box_to_storage", "restore_from_box", "transfer_box_item"].includes(step.action)) continue;
    const boxItemId = String(step.params.boxItemId ?? "");
    out.set(boxItemId, (out.get(boxItemId) ?? 0) + Number(step.params.quantity ?? 0));
  }
  return out;
}

/** The box rows as they will be once the earlier steps of the plan have run. */
function afterEarlierSteps(rows: BoxRow[], ctx: PreviewContext): BoxRow[] {
  const pending = pendingBoxRemovals(ctx);
  if (pending.size === 0) return rows;
  return rows.map((r) => ({ ...r, quantity: r.quantity - (pending.get(r.boxItemId) ?? 0) })).filter((r) => r.quantity > 0);
}

/** Units earlier steps take off one soldier: signed equipment returned or transferred away, and box contents emptied. */
function pendingForUser(userId: string, ctx: PreviewContext): { signedLeaving: number; boxLeaving: number; signedArriving: number } {
  let signedLeaving = 0;
  let boxLeaving = 0;
  let signedArriving = 0;
  for (const step of ctx.earlierSteps) {
    const p = step.params;
    const q = Number(p.quantity ?? 0);
    if (step.action === "return_equipment_to_storage" && p.userId === userId) {
      signedLeaving += ((p.items as Line[]) ?? []).reduce((s, l) => s + Number(l.quantity ?? 0), 0);
    } else if (step.action === "transfer_equipment" && p.fromUserId === userId) signedLeaving += q;
    else if (step.action === "move_to_box" && p.userId === userId) signedLeaving += ((p.items as Line[]) ?? []).reduce((s, l) => s + Number(l.quantity ?? 0), 0);
    else if (step.action === "remove_from_box_to_storage" && p.userId === userId) boxLeaving += q;
    else if (step.action === "transfer_box_item" && p.fromUserId === userId) boxLeaving += q;
    else if (step.action === "restore_from_box" && p.userId === userId) {
      boxLeaving += q;
      signedArriving += q;
    }
  }
  return { signedLeaving, boxLeaving, signedArriving };
}

type BoxContentsMode = "leave" | "return_to_storage" | "restore_to_soldiers";

const boxContents = z
  .enum(["leave", "return_to_storage", "restore_to_soldiers"])
  .describe(
    "What to do with the affected units that are inside soldiers' boxes right now. " +
      "leave = they stay in the boxes but fall outside the template. " +
      "return_to_storage = first take them out of the boxes back to the ימ״ח. " +
      "restore_to_soldiers = first take them out and sign them back on each soldier. " +
      "With the last two the system adds the clean-up steps to the plan by itself, one per box, so do not add them yourself. " +
      "get_box_template shows how many units are affected. When units are affected and the operator has not said which of these they want, explain the options and ask before planning.",
  );

const CONTENTS_LABEL: Record<Exclude<BoxContentsMode, "leave">, string> = {
  return_to_storage: "יוחזרו לימ״ח",
  restore_to_soldiers: "יוחזרו לחתימת החיילים",
};

async function getSlot(equipmentItemId: string): Promise<{ slot: TemplateSlot; slots: TemplateSlot[] }> {
  const slots = await loadTemplateSlots();
  const slot = slots.find((s) => s.equipmentItemId === equipmentItemId);
  if (!slot) {
    throw new PlanError(
      `Item "${equipmentItemId}" is not the main item of any box-template row. Call get_box_template and use the equipmentItemId of the row.`,
    );
  }
  return { slot, slots };
}

/** One clean-up step per box row, through the ordinary box actions. */
function clearingSteps(removals: { row: BoxRow; quantity: number }[], mode: BoxContentsMode): PrerequisiteStep[] {
  if (mode === "leave") return [];
  const action = mode === "return_to_storage" ? "remove_from_box_to_storage" : "restore_from_box";
  return removals.map(({ row, quantity }) => ({ action, params: { userId: row.userId, boxItemId: row.boxItemId, quantity } }));
}

/** The lines that explain what happens to units already in boxes. */
function boxContentsOutcome(
  affected: { boxes: number; units: number },
  mode: BoxContentsMode,
  ctx: PreviewContext,
  what: string,
): { details: string[]; warnings: string[] } {
  const { phase } = ctx;
  if (affected.units === 0) {
    const cleared = pendingBoxRemovals(ctx).size > 0;
    return {
      details: [cleared ? "הצעדים שמעל מוציאים את היחידות האלה מהקרטונים לפני השינוי." : "אין כרגע יחידות כאלה בקרטונים, כך שאף קרטון קיים לא מושפע."],
      warnings: [],
    };
  }
  if (mode === "leave") {
    return {
      details: [],
      warnings: [
        `ב-${affected.boxes} קרטונים יש ${affected.units} יחידות ${what}. הן יישארו בקרטונים, אבל מחוץ לתבנית: לא ייספרו במעקב המילוי ולא ניתן יהיה להעביר אותן לקרטון אחר.`,
        `אפשר במקום זה לבקש מהסוכן להחזיר אותן קודם לימ״ח או לחתימת החיילים, ורק אז לבצע את השינוי.`,
      ],
    };
  }
  if (phase === "execute") {
    // The clean-up steps ran before this one. If units are still there, stop rather than strand them.
    throw new PlanError(`עדיין יש ${affected.units} יחידות ${what} ב-${affected.boxes} קרטונים, ולכן השינוי נעצר. בקש מהסוכן להכין את התוכנית מחדש.`);
  }
  return { details: [`לפני השינוי, ${affected.units} יחידות מ-${affected.boxes} קרטונים ${CONTENTS_LABEL[mode]} (הצעדים שמעל).`], warnings: [] };
}

const boxTemplateAddItem = define({
  name: "box_template_add_item",
  description:
    "Add a new row to the box template: an item every soldier's box should hold, and how many (הוספת פריט לתבנית הקרטון). To change the quantity of an existing row use box_template_set_quantity.",
  schema: z.object({
    equipmentItemId: id("Equipment item"),
    quantity: z.number().int().min(1).max(1000).describe("Units each box should hold"),
    groupName: z.string().trim().max(80).optional().describe("Optional display name for the row, e.g. קסדה when several helmet models can fill it"),
  }),
  async preview(p) {
    const item = await getItem(p.equipmentItemId);
    if (!item.active) throw new PlanError(`הפריט ${item.name} אינו פעיל.`);
    const slots = await loadTemplateSlots();
    const existing = slotAccepting(slots, item.id);
    if (existing) {
      throw new PlanError(
        existing.equipmentItemId === item.id
          ? `${item.name} כבר בתבנית (כמות לקרטון ${existing.quantity}). To change the quantity use box_template_set_quantity.`
          : `${item.name} כבר מוגדר בתבנית כחלופה בשורה "${slotLabel(existing)}".`,
      );
    }
    const [totalBoxes, rows, signed, inStock] = await Promise.all([
      prisma.box.count(),
      boxRowsFor([item.id]),
      prisma.assignment.aggregate({ where: { equipmentItemId: item.id, active: true }, _sum: { quantity: true } }),
      yamahStock(item.id),
    ]);
    const already = [...perBoxTotals(rows).values()].filter((t) => t >= p.quantity).length;
    const missing = totalBoxes - already;
    return {
      title: `הוספת ${item.name} לתבנית הקרטון`,
      details: [
        `כמות לקרטון: ${p.quantity}${p.groupName ? ` · שם השורה: ${p.groupName}` : ""}`,
        `כיום: ${inStock} בימ״ח, ${signed._sum.quantity ?? 0} חתומות על חיילים, ${usage(rows).units} כבר בקרטונים.`,
      ],
      ...(missing > 0
        ? {
            warnings: [
              `ב-${missing} מתוך ${totalBoxes} הקרטונים הקיימים השורה הזאת תופיע כחסרה, עד שיוכנס הפריט לכל קרטון.`,
              `כדי למלא אותם נדרשות עד ${missing * p.quantity} יחידות. אפשר לבקש מהסוכן להוסיף לקרטונים מהימ״ח או להעביר מחתימת החיילים.`,
            ],
          }
        : {}),
    };
  },
  async execute(p) {
    await run(addBoxTemplateItemAction(form({ equipmentItemId: p.equipmentItemId, quantity: p.quantity })));
    if (p.groupName) {
      const { slot } = await getSlot(p.equipmentItemId);
      await run(updateGroupNameAction(form({ templateItemId: slot.templateItemId, groupName: p.groupName })));
    }
  },
});

const boxTemplateSetQuantity = define({
  name: "box_template_set_quantity",
  description: "Change how many units of a template row each box should hold (שינוי כמות בתבנית הקרטון).",
  schema: z.object({
    equipmentItemId: id("Main item of the template row (from get_box_template)"),
    quantity: z.number().int().min(1).max(1000).describe("New number of units each box should hold"),
    boxContents: boxContents.describe(
      "Only matters when the quantity goes down: what to do with units above the new quantity that are in boxes now. " +
        "leave / return_to_storage / restore_to_soldiers. Use leave when the quantity goes up.",
    ),
  }),
  async preview(p, _actor, ctx) {
    const { slot } = await getSlot(p.equipmentItemId);
    if (slot.quantity === p.quantity) throw new PlanError(`הכמות לקרטון בשורה "${slotLabel(slot)}" כבר ${slot.quantity}.`);
    const standing = await slotStanding(slot);
    standing.rows = afterEarlierSteps(standing.rows, ctx);
    const title = `שינוי כמות בתבנית הקרטון: ${slotLabel(slot)}`;
    const details = [`כמות לקרטון: ${slot.quantity} ← ${p.quantity}`];

    if (p.quantity > slot.quantity) {
      const below = standing.totalBoxes - [...perBoxTotals(standing.rows).values()].filter((t) => t >= p.quantity).length;
      return {
        title,
        details,
        ...(below > 0
          ? { warnings: [`ב-${below} מתוך ${standing.totalBoxes} הקרטונים הקיימים השורה תופיע כחסרה, עד שיושלם הפריט בכל קרטון.`] }
          : {}),
      };
    }
    const removals = excessRemovals(standing.rows, p.quantity);
    const affected = { boxes: new Set(removals.map((r) => r.row.userId)).size, units: removals.reduce((s, r) => s + r.quantity, 0) };
    const outcome = boxContentsOutcome(affected, p.boxContents, ctx, "מעבר לכמות החדשה");
    return { title, details: [...details, ...outcome.details], ...(outcome.warnings.length ? { warnings: outcome.warnings } : {}) };
  },
  async prerequisites(p, _actor, ctx) {
    const { slot } = await getSlot(p.equipmentItemId);
    if (p.quantity >= slot.quantity) return [];
    return clearingSteps(excessRemovals(afterEarlierSteps((await slotStanding(slot)).rows, ctx), p.quantity), p.boxContents);
  },
  async execute(p) {
    // The site's action is an upsert: on an existing row it sets the quantity.
    await run(addBoxTemplateItemAction(form({ equipmentItemId: p.equipmentItemId, quantity: p.quantity })));
  },
});

const boxTemplateRemoveItem = define({
  name: "box_template_remove_item",
  description:
    "Remove a row from the box template, together with its alternatives (הסרת פריט מתבנית הקרטון). Boxes are not emptied unless boxContents asks for it.",
  schema: z.object({ equipmentItemId: id("Main item of the template row (from get_box_template)"), boxContents }),
  async preview(p, _actor, ctx) {
    const { slot } = await getSlot(p.equipmentItemId);
    const rows = afterEarlierSteps(await boxRowsFor(slotItemIds(slot)), ctx);
    const outcome = boxContentsOutcome(usage(rows), p.boxContents, ctx, `של "${slotLabel(slot)}"`);
    return {
      title: `הסרת "${slotLabel(slot)}" מתבנית הקרטון`,
      details: [
        `כמות לקרטון כיום: ${slot.quantity}${slot.alternatives.length ? ` · כולל ${slot.alternatives.length} חלופות שיוסרו איתה` : ""}`,
        ...outcome.details,
      ],
      ...(outcome.warnings.length ? { warnings: outcome.warnings } : {}),
    };
  },
  async prerequisites(p, _actor, ctx) {
    const { slot } = await getSlot(p.equipmentItemId);
    const rows = afterEarlierSteps(await boxRowsFor(slotItemIds(slot)), ctx);
    return clearingSteps(rows.map((row) => ({ row, quantity: row.quantity })), p.boxContents);
  },
  async execute(p) {
    await run(removeBoxTemplateItemAction(form({ equipmentItemId: p.equipmentItemId })));
  },
});

const boxTemplateAddAlternative = define({
  name: "box_template_add_alternative",
  description:
    "Let another item fill an existing template row, e.g. a second helmet model (הוספת חלופה לשורה בתבנית). Units of either item then count toward the row.",
  schema: z.object({
    equipmentItemId: id("Main item of the template row (from get_box_template)"),
    alternativeItemId: id("The item to accept as an alternative"),
  }),
  async preview(p) {
    const { slot, slots } = await getSlot(p.equipmentItemId);
    if (p.alternativeItemId === slot.equipmentItemId) throw new PlanError("לא ניתן להוסיף את הפריט הראשי כחלופה של עצמו.");
    const alt = await getItem(p.alternativeItemId);
    const taken = slotAccepting(slots, alt.id);
    if (taken) throw new PlanError(`${alt.name} כבר מוגדר בתבנית, בשורה "${slotLabel(taken)}".`);
    const inBoxes = usage(await boxRowsFor([alt.id]));
    return {
      title: `הוספת ${alt.name} כחלופה בשורה "${slotLabel(slot)}"`,
      details: [
        `כמות לקרטון בשורה: ${slot.quantity} (מכל הפריטים שבשורה יחד)`,
        ...(inBoxes.units > 0 ? [`${inBoxes.units} יחידות של ${alt.name} שכבר נמצאות ב-${inBoxes.boxes} קרטונים ייספרו מעכשיו בשורה הזאת.`] : []),
      ],
    };
  },
  async execute(p) {
    const { slot } = await getSlot(p.equipmentItemId);
    await run(addAlternativeAction(form({ templateItemId: slot.templateItemId, alternativeItemId: p.alternativeItemId })));
  },
});

const boxTemplateRemoveAlternative = define({
  name: "box_template_remove_alternative",
  description: "Stop accepting an alternative item in a template row (הסרת חלופה משורה בתבנית). The main item of the row stays.",
  schema: z.object({
    equipmentItemId: id("Main item of the template row (from get_box_template)"),
    alternativeItemId: id("The alternative item to remove"),
    boxContents,
  }),
  async preview(p, _actor, ctx) {
    const { slot } = await getSlot(p.equipmentItemId);
    const alt = slot.alternatives.find((a) => a.equipmentItemId === p.alternativeItemId);
    if (!alt) throw new PlanError(`Item "${p.alternativeItemId}" is not an alternative in the row "${slotLabel(slot)}". Call get_box_template.`);
    const rows = afterEarlierSteps(await boxRowsFor([alt.equipmentItemId]), ctx);
    const outcome = boxContentsOutcome(usage(rows), p.boxContents, ctx, `של ${alt.name}`);
    return {
      title: `הסרת החלופה ${alt.name} מהשורה "${slotLabel(slot)}"`,
      details: outcome.details,
      ...(outcome.warnings.length ? { warnings: outcome.warnings } : {}),
    };
  },
  async prerequisites(p, _actor, ctx) {
    const rows = afterEarlierSteps(await boxRowsFor([p.alternativeItemId]), ctx);
    return clearingSteps(rows.map((row) => ({ row, quantity: row.quantity })), p.boxContents);
  },
  async execute(p) {
    const { slot } = await getSlot(p.equipmentItemId);
    const alt = slot.alternatives.find((a) => a.equipmentItemId === p.alternativeItemId);
    if (!alt) throw new Error("חלופה לא נמצאה.");
    await run(removeAlternativeAction(form({ altId: alt.altId })));
  },
});

const boxTemplateSetGroupName = define({
  name: "box_template_set_group_name",
  description: "Set or clear the display name of a template row (שם קבוצה). Only the label changes.",
  schema: z.object({
    equipmentItemId: id("Main item of the template row (from get_box_template)"),
    groupName: z.string().trim().max(80).describe("New name; empty string clears it"),
  }),
  async preview(p) {
    const { slot } = await getSlot(p.equipmentItemId);
    if ((slot.groupName ?? "") === p.groupName) throw new PlanError("שם השורה כבר כזה.");
    return {
      title: `שינוי שם שורה בתבנית הקרטון: ${slot.name}`,
      details: [`${slot.groupName || "(ללא שם)"} ← ${p.groupName || "(ללא שם)"}`],
    };
  },
  async execute(p) {
    const { slot } = await getSlot(p.equipmentItemId);
    await run(updateGroupNameAction(form({ templateItemId: slot.templateItemId, groupName: p.groupName })));
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
    const drop = -delta;
    const bigDrop = drop > 0 && (p.quantity === 0 || (drop >= 5 && drop / stock >= 0.2));
    return {
      title: `עדכון מלאי בימ״ח: ${item.name}`,
      details: [`${stock} ← ${p.quantity} (${delta > 0 ? "תוספת של" : "ירידה של"} ${Math.abs(delta)})`],
      ...(bigDrop
        ? {
            warnings: [
              `המלאי יורד ב-${drop} יחידות בלי רישום לאן הן הלכו. עדכון ספירה מתאים לתיקון טעות בספירה.`,
              `אם הציוד נמסר לחיילים, עדיף לבקש "הקצאה" כדי שיירשם על שמם.`,
            ],
          }
        : {}),
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
  async preview(p, actor, ctx) {
    const user = await getUser(p.userId);
    if (user.active === p.active) throw new PlanError(`${user.name} כבר ${p.active ? "פעיל" : "לא פעיל"}.`);
    if (user.id === actor.id && !p.active) throw new PlanError("לא ניתן להשבית את החשבון של עצמך דרך הסוכן.");
    const warnings: string[] = [];
    if (!p.active) {
      const [signed, boxed, open] = await Promise.all([
        prisma.assignment.aggregate({ where: { userId: user.id, active: true }, _sum: { quantity: true } }),
        prisma.boxItem.aggregate({ where: { box: { userId: user.id } }, _sum: { quantity: true } }),
        prisma.request.count({ where: { requesterId: user.id, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      ]);
      // Equipment that earlier steps of this plan already take off him does not count.
      const pending = pendingForUser(user.id, ctx);
      const signedUnits = Math.max(0, (signed._sum.quantity ?? 0) - pending.signedLeaving + pending.signedArriving);
      const boxedUnits = boxHandovers(ctx).gaveAway.has(user.id) ? 0 : Math.max(0, (boxed._sum.quantity ?? 0) - pending.boxLeaving);
      if (signedUnits > 0 || boxedUnits > 0) {
        warnings.push(
          `על ${user.name} עדיין רשומות ${signedUnits} יחידות ציוד חתומות ו-${boxedUnits} יחידות בקרטון. ההשבתה לא מחזירה אותן, והן יישארו רשומות על משתמש לא פעיל.`,
          `אפשר לבקש מהסוכן קודם להחזיר את הציוד לימ״ח או להעביר אותו לחייל אחר (כולל העברת הקרטון כולו על שם חייל אחר), ורק אז להשבית.`,
        );
      }
      if (open > 0) warnings.push(`יש לו ${open} בקשות פתוחות שיישארו ממתינות.`);
    }
    return {
      title: `${p.active ? "הפעלת" : "השבתת"} המשתמש ${user.name}`,
      details: [`תפקיד: ${roleLabel(user.role)}`, ...(p.active ? [] : ["המשתמש לא יוכל להתחבר למערכת."])],
      ...(warnings.length ? { warnings } : {}),
    };
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
    const warnings: string[] = [];
    if (p.role === Role.SUPER_ADMIN || p.role === Role.THEME_MASTER) {
      warnings.push(`זו הרשאה מלאה: ניהול משתמשים והרשאות, גיבויים, והפעלת סוכן ה-AI.`);
    } else if (p.role === Role.ADMIN) {
      warnings.push(`מנהל יכול לאשר בקשות, להקצות ולהעביר ציוד ולערוך מלאי.`);
    }
    return {
      title: `שינוי הרשאה למשתמש ${user.name}`,
      details: [`${roleLabel(user.role)} ← ${roleLabel(p.role)}`],
      ...(warnings.length ? { warnings } : {}),
    };
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
    const warnings: string[] = [];
    if (p.active === false && item.active) {
      const [signed, boxed, pending, inStock, slots] = await Promise.all([
        prisma.assignment.aggregate({ where: { equipmentItemId: item.id, active: true }, _sum: { quantity: true }, _count: true }),
        prisma.boxItem.aggregate({ where: { equipmentItemId: item.id }, _sum: { quantity: true } }),
        prisma.requestItem.count({ where: { equipmentItemId: item.id, status: "PENDING" } }),
        yamahStock(item.id),
        loadTemplateSlots(),
      ]);
      const signedUnits = signed._sum.quantity ?? 0;
      const boxedUnits = boxed._sum.quantity ?? 0;
      if (signedUnits + boxedUnits + inStock > 0) {
        warnings.push(
          `הפריט עדיין בשימוש: ${signedUnits} יחידות חתומות על חיילים, ${boxedUnits} בקרטונים, ${inStock} בימ״ח. הן יישארו רשומות, אבל לא ניתן יהיה לבקש או להקצות את הפריט מחדש.`,
        );
      }
      if (pending > 0) warnings.push(`יש ${pending} שורות בבקשות פתוחות לפריט הזה, שלא ניתן יהיה לאשר אחרי ההשבתה.`);
      const slot = slotAccepting(slots, item.id);
      if (slot) warnings.push(`הפריט מוגדר בתבנית הקרטון (שורה "${slotLabel(slot)}"). כדאי להסיר אותו מהתבנית או להחליף אותו שם.`);
    }
    return { title: `עריכת הפריט ${item.name}`, details, ...(warnings.length ? { warnings } : {}) };
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
  reassignBox,
  boxTemplateAddItem,
  boxTemplateSetQuantity,
  boxTemplateRemoveItem,
  boxTemplateAddAlternative,
  boxTemplateRemoveAlternative,
  boxTemplateSetGroupName,
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
  ...ADMIN_ACTIONS,
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
  ctx: PreviewContext = { phase: "draft", earlierSteps: [] },
): Promise<{ action: AgentAction; params: Record<string, unknown>; view: StepView }> {
  const action = getAgentAction(actionName);
  if (!action) throw new PlanError(`Unknown action "${actionName}".`);
  if (!actionAllowedFor(action, actor)) throw new PlanError("אין לך הרשאה לפעולה זו.");
  const parsed = action.schema.safeParse(rawParams);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(input)"}: ${i.message}`).join("; ");
    throw new PlanError(`Invalid parameters – ${issues}`);
  }
  const view = await action.preview(parsed.data, actor, ctx);
  return { action, params: parsed.data as Record<string, unknown>, view };
}
