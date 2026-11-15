import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PlanError, type AgentAction } from "./types";

/**
 * Shared building blocks for the agent's actions: parameter shapes, the bridge to
 * the site's server actions, and lookups that fail with a message the model can act on.
 */

export const YAMAH = "ימ״ח";
export const DEFAULT_NOTE = "בוצע באמצעות סוכן ה-AI";

// ─── helpers ──────────────────────────────────────────────────────────────────

export const id = (what: string) => z.string().min(1).describe(`${what} – an id returned by a lookup tool. Never invent ids.`);
export const qty = z.number().int().min(1).max(1000).describe("Quantity (whole number, at least 1)");
export const notes = z
  .string()
  .trim()
  .max(500)
  .optional()
  .describe("Short reason in Hebrew, shown in the history. Use the operator's own reason when they gave one.");

export function form(fields: Record<string, string | number | boolean | undefined | null>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) fd.set(k, String(v));
  }
  return fd;
}

/** Server actions either return { success, error } or throw. Normalise to "throws on failure". */
export async function run(result: Promise<unknown>): Promise<void> {
  const r = await result;
  if (r && typeof r === "object" && "success" in r && (r as { success: unknown }).success === false) {
    throw new Error(String((r as { error?: unknown }).error ?? "הפעולה נכשלה."));
  }
}

export function serialSuffix(serial: string | null | undefined) {
  return serial ? ` (מס׳ סידורי ${serial})` : "";
}

export async function getUser(userId: string, opts: { mustBeActive?: boolean } = {}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, active: true, role: true, personalNumber: true, email: true },
  });
  if (!user) throw new PlanError(`No user with id "${userId}". Look the person up with search_users first.`);
  if (opts.mustBeActive && !user.active) throw new PlanError(`המשתמש ${user.name} אינו פעיל.`);
  return user;
}

export async function getItem(equipmentItemId: string) {
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

export async function yamahStock(equipmentItemId: string): Promise<number> {
  const inv = await prisma.storageInventory.findFirst({
    where: { equipmentItemId, location: { name: YAMAH, active: true } },
    select: { quantity: true },
  });
  return inv?.quantity ?? 0;
}

export async function getAssignment(assignmentId: string, userId: string) {
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

export async function getBoxItem(boxItemId: string, userId: string) {
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

export async function getTashItem(itemId: string) {
  const item = await prisma.tashItem.findUnique({
    where: { id: itemId },
    select: { id: true, name: true, unit: true, inventory: { select: { location: true, quantity: true } } },
  });
  if (!item) throw new PlanError(`No ת״ש item with id "${itemId}". Look it up with search_tash first.`);
  return item;
}

export function tashQtyAt(item: Awaited<ReturnType<typeof getTashItem>>, location: string) {
  return item.inventory.find((i) => i.location === location)?.quantity ?? 0;
}

export function define<S extends z.ZodType>(action: AgentAction<S>): AgentAction {
  return action as unknown as AgentAction;
}
