"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role, AuditEntity, Division } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ensureGeneralCategory } from "@/lib/categoryUtils";

const CreateSchema = z.object({
  division: z.nativeEnum(Division),
  name: z.string().trim().min(1),
  isWeapon: z.union([z.string(), z.null(), z.undefined()]).transform(v => v === "true"),
  isSight: z.union([z.string(), z.null(), z.undefined()]).transform(v => v === "true"),
  isClothing: z.union([z.string(), z.null(), z.undefined()]).transform(v => v === "true"),
  isShoe: z.union([z.string(), z.null(), z.undefined()]).transform(v => v === "true"),
});

export async function createItemAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = CreateSchema.safeParse({
    division: formData.get("division"),
    name: formData.get("name"),
    isWeapon: formData.get("isWeapon"),
    isSight: formData.get("isSight"),
    isClothing: formData.get("isClothing"),
    isShoe: formData.get("isShoe"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  const categoryId = await ensureGeneralCategory(parsed.data.division);

  await prisma.$transaction(async (tx) => {
    const created = await tx.equipmentItem.create({
      data: {
        categoryId,
        name: parsed.data.name,
        active: true,
        isWeapon: parsed.data.isWeapon,
        isSight: parsed.data.isSight,
        isClothing: parsed.data.isClothing,
        isShoe: parsed.data.isShoe,
      },
      select: { id: true, categoryId: true, name: true, active: true, isWeapon: true, isSight: true, isClothing: true, isShoe: true },
    });

    // Automatically add to storage (Yamah) with 0 quantity
    const yamah = await tx.storageLocation.findFirst({
      where: { name: "ימ״ח", active: true },
    });

    if (yamah) {
      await tx.storageInventory.create({
        data: {
          locationId: yamah.id,
          equipmentItemId: created.id,
          quantity: 0,
        },
      });
    }

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.ITEM,
      entityId: created.id,
      action: "ITEM_CREATED",
      beforeJson: null,
      afterJson: created,
    });
  });

  revalidatePath("/admin/items");
  revalidatePath("/admin/storage");
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  division: z.nativeEnum(Division),
  name: z.string().trim().min(1),
  active: z.string().transform((v) => v === "true").or(z.boolean()),
  isWeapon: z.union([z.string(), z.null(), z.undefined()]).transform(v => v === "true"),
  isSight: z.union([z.string(), z.null(), z.undefined()]).transform(v => v === "true"),
  isClothing: z.union([z.string(), z.null(), z.undefined()]).transform(v => v === "true"),
  isShoe: z.union([z.string(), z.null(), z.undefined()]).transform(v => v === "true"),
});

export async function updateItemAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = UpdateSchema.safeParse({
    id: formData.get("id"),
    division: formData.get("division"),
    name: formData.get("name"),
    active: formData.get("active"),
    isWeapon: formData.get("isWeapon"),
    isSight: formData.get("isSight"),
    isClothing: formData.get("isClothing"),
    isShoe: formData.get("isShoe"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  const categoryId = await ensureGeneralCategory(parsed.data.division);

  await prisma.$transaction(async (tx) => {
    const before = await tx.equipmentItem.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, categoryId: true, name: true, active: true, isWeapon: true, isSight: true, isClothing: true, isShoe: true },
    });
    if (!before) throw new Error("פריט לא נמצא.");

    const updated = await tx.equipmentItem.update({
      where: { id: parsed.data.id },
      data: {
        categoryId,
        name: parsed.data.name,
        active: parsed.data.active,
        isWeapon: parsed.data.isWeapon,
        isSight: parsed.data.isSight,
        isClothing: parsed.data.isClothing,
        isShoe: parsed.data.isShoe,
      },
      select: { id: true, categoryId: true, name: true, active: true, isWeapon: true, isSight: true, isClothing: true, isShoe: true },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.ITEM,
      entityId: parsed.data.id,
      action: "ITEM_UPDATED",
      beforeJson: before,
      afterJson: updated,
    });
  });

  revalidatePath("/admin/items");
}

export async function deleteItemAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(Role.ADMIN);
  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "מזהה פריט חסר." };

  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.equipmentItem.findUnique({
        where: { id },
        select: {
          id: true, name: true, active: true, discontinued: true,
          assignments: { where: { active: true }, select: { id: true }, take: 1 },
          boxItems: { select: { id: true }, take: 1 },
          requestItems: { select: { id: true }, take: 1 },
          storageInventories: { select: { id: true, quantity: true } },
          unitTemplateItems: { select: { unitTemplateId: true }, take: 1 },
          boxTemplateItems: { select: { id: true }, take: 1 },
          boxTemplateAlts: { select: { id: true }, take: 1 },
          transferItems: { select: { id: true }, take: 1 },
        },
      });

      if (!item) throw new Error("פריט לא נמצא.");

      // Block if there are any active assignments
      if (item.assignments.length > 0) {
        throw new Error("לא ניתן למחוק פריט שמוקצה לחיילים. יש להסיר את כל ההקצאות הפעילות תחילה.");
      }

      // Check for active box items
      if (item.boxItems.length > 0) {
        throw new Error("לא ניתן למחוק פריט שנמצא בקרטונים פעילים. יש להסיר אותו מהקרטונים תחילה.");
      }

      const hasHistory =
        item.requestItems.length > 0 ||
        item.transferItems.length > 0;

      if (item.discontinued) {
        // Second-step permanent removal: strip all references, then delete the row
        const requestItemRows = await tx.requestItem.findMany({
          where: { equipmentItemId: id },
          select: { requestId: true },
        });
        const affectedRequestIds = [...new Set(requestItemRows.map((r) => r.requestId))];

        const transferItemRows = await tx.transferItem.findMany({
          where: { equipmentItemId: id },
          select: { transferId: true },
        });
        const affectedTransferIds = [...new Set(transferItemRows.map((t) => t.transferId))];

        if (affectedRequestIds.length > 0) {
          await tx.adminNotification.deleteMany({ where: { requestId: { in: affectedRequestIds } } });
        }

        await tx.requestItem.deleteMany({ where: { equipmentItemId: id } });
        if (affectedRequestIds.length > 0) {
          await tx.request.deleteMany({
            where: { id: { in: affectedRequestIds }, items: { none: {} } },
          });
        }

        await tx.transferItem.deleteMany({ where: { equipmentItemId: id } });
        if (affectedTransferIds.length > 0) {
          await tx.transfer.deleteMany({
            where: { id: { in: affectedTransferIds }, items: { none: {} } },
          });
        }

        await tx.assignment.deleteMany({ where: { equipmentItemId: id } });
        await tx.storageInventory.deleteMany({ where: { equipmentItemId: id } });
        await tx.unitTemplateItem.deleteMany({ where: { equipmentItemId: id } });
        await tx.boxTemplateItemAlt.deleteMany({ where: { equipmentItemId: id } });
        await tx.boxTemplateItem.deleteMany({ where: { equipmentItemId: id } });
        await tx.boxItem.deleteMany({ where: { equipmentItemId: id } });
        await tx.user.updateMany({ where: { weaponItemId: id }, data: { weaponItemId: null } });

        await tx.equipmentItem.delete({ where: { id } });

        await writeAuditLog(tx, {
          actorId: session.user.id,
          entity: AuditEntity.ITEM,
          entityId: id,
          action: "ITEM_PURGED",
          beforeJson: { name: item.name, discontinued: true },
          afterJson: null,
        });
      } else if (hasHistory) {
        // Soft delete: mark as discontinued so FK references in request history remain valid
        await tx.equipmentItem.update({
          where: { id },
          data: { discontinued: true, active: false },
        });

        // Remove from storage, templates — these no longer apply
        await tx.storageInventory.deleteMany({ where: { equipmentItemId: id } });
        await tx.unitTemplateItem.deleteMany({ where: { equipmentItemId: id } });
        await tx.boxTemplateItemAlt.deleteMany({ where: { equipmentItemId: id } });
        await tx.boxTemplateItem.deleteMany({ where: { equipmentItemId: id } });

        await writeAuditLog(tx, {
          actorId: session.user.id,
          entity: AuditEntity.ITEM,
          entityId: id,
          action: "ITEM_DISCONTINUED",
          beforeJson: { name: item.name, active: item.active },
          afterJson: { discontinued: true, active: false },
        });
      } else {
        // Hard delete: no history, safe to fully remove
        await tx.storageInventory.deleteMany({ where: { equipmentItemId: id } });
        await tx.unitTemplateItem.deleteMany({ where: { equipmentItemId: id } });
        await tx.boxTemplateItemAlt.deleteMany({ where: { equipmentItemId: id } });
        await tx.boxTemplateItem.deleteMany({ where: { equipmentItemId: id } });
        // Delete any inactive assignment records
        await tx.assignment.deleteMany({ where: { equipmentItemId: id } });

        await tx.equipmentItem.delete({ where: { id } });

        await writeAuditLog(tx, {
          actorId: session.user.id,
          entity: AuditEntity.ITEM,
          entityId: id,
          action: "ITEM_DELETED",
          beforeJson: { name: item.name },
          afterJson: null,
        });
      }
    });
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "אירעה שגיאה בלתי צפויה." };
  }

  revalidatePath("/admin/items");
  revalidatePath("/admin/storage");
  return { success: true };
}
