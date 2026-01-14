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

export async function deleteItemAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const id = formData.get("id") as string;
  if (!id) throw new Error("מזהה פריט חסר.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.equipmentItem.findUnique({
      where: { id },
      include: {
        assignments: true,
        storageInventories: true,
        transferItems: true,
        unitTemplateItems: true,
        requestItems: true,
      },
    });

    if (!before) throw new Error("פריט לא נמצא.");
    
    if (
      before.assignments.length > 0 ||
      before.storageInventories.length > 0 ||
      before.transferItems.length > 0 ||
      before.unitTemplateItems.length > 0 ||
      before.requestItems.length > 0
    ) {
      throw new Error("לא ניתן למחוק פריט שיש לו היסטוריה או מלאי במערכת. בטל את הפריט (הפוך ללא פעיל) במקום למחוק.");
    }

    await tx.equipmentItem.delete({ where: { id } });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.ITEM,
      entityId: id,
      action: "ITEM_DELETED",
      beforeJson: before,
      afterJson: null,
    });
  });

  revalidatePath("/admin/items");
}
