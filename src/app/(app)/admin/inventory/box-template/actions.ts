"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { AuditEntity, Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

async function getOrCreateBoxTemplate(tx: any) {
  let tpl = await tx.boxTemplate.findFirst();
  if (!tpl) {
    tpl = await tx.boxTemplate.create({ data: {} });
  }
  return tpl;
}

const AddItemSchema = z.object({
  equipmentItemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1000),
});

export async function addBoxTemplateItemAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(Role.ADMIN);
  const parsed = AddItemSchema.safeParse({
    equipmentItemId: formData.get("equipmentItemId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    return { success: false, error: "נתונים לא תקינים." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const tpl = await getOrCreateBoxTemplate(tx);

      const item = await tx.equipmentItem.findUnique({
        where: { id: parsed.data.equipmentItemId },
        select: { id: true, name: true },
      });
      if (!item) throw new Error("פריט לא נמצא.");

      await tx.boxTemplateItem.upsert({
        where: {
          boxTemplateId_equipmentItemId: {
            boxTemplateId: tpl.id,
            equipmentItemId: parsed.data.equipmentItemId,
          },
        },
        create: {
          boxTemplateId: tpl.id,
          equipmentItemId: parsed.data.equipmentItemId,
          quantity: parsed.data.quantity,
        },
        update: {
          quantity: parsed.data.quantity,
        },
      });

      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.BOX_TEMPLATE,
        entityId: tpl.id,
        action: "BOX_TEMPLATE_ITEM_UPSERTED",
        afterJson: { equipmentItemId: parsed.data.equipmentItemId, quantity: parsed.data.quantity },
        metadataJson: { itemName: item.name },
      });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "אירעה שגיאה.";
    return { success: false, error: message };
  }

  revalidatePath("/admin/inventory/box-template");
  revalidatePath("/admin/boxes");
  return { success: true };
}

const RemoveItemSchema = z.object({
  equipmentItemId: z.string().min(1),
});

export async function removeBoxTemplateItemAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(Role.ADMIN);
  const parsed = RemoveItemSchema.safeParse({
    equipmentItemId: formData.get("equipmentItemId"),
  });
  if (!parsed.success) {
    return { success: false, error: "נתונים לא תקינים." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const tpl = await getOrCreateBoxTemplate(tx);

      await tx.boxTemplateItem.delete({
        where: {
          boxTemplateId_equipmentItemId: {
            boxTemplateId: tpl.id,
            equipmentItemId: parsed.data.equipmentItemId,
          },
        },
      });

      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.BOX_TEMPLATE,
        entityId: tpl.id,
        action: "BOX_TEMPLATE_ITEM_REMOVED",
        metadataJson: { equipmentItemId: parsed.data.equipmentItemId },
      });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "אירעה שגיאה.";
    return { success: false, error: message };
  }

  revalidatePath("/admin/inventory/box-template");
  revalidatePath("/admin/boxes");
  return { success: true };
}

const AddMultipleItemsSchema = z.object({
  items: z.array(
    z.object({
      equipmentItemId: z.string().min(1),
      quantity: z.number().int().min(1).max(1000),
    })
  ),
});

export async function addMultipleBoxTemplateItemsAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(Role.ADMIN);

  const itemsJson = formData.get("items");
  if (!itemsJson || typeof itemsJson !== "string") {
    return { success: false, error: "נתונים לא תקינים." };
  }

  const parsed = AddMultipleItemsSchema.safeParse({
    items: JSON.parse(itemsJson),
  });
  if (!parsed.success) {
    return { success: false, error: "נתונים לא תקינים." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const tpl = await getOrCreateBoxTemplate(tx);

      for (const item of parsed.data.items) {
        const equipmentItem = await tx.equipmentItem.findUnique({
          where: { id: item.equipmentItemId },
          select: { id: true },
        });
        if (!equipmentItem) throw new Error("פריט לא נמצא.");

        await tx.boxTemplateItem.upsert({
          where: {
            boxTemplateId_equipmentItemId: {
              boxTemplateId: tpl.id,
              equipmentItemId: item.equipmentItemId,
            },
          },
          create: {
            boxTemplateId: tpl.id,
            equipmentItemId: item.equipmentItemId,
            quantity: item.quantity,
          },
          update: {
            quantity: item.quantity,
          },
        });
      }

      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.BOX_TEMPLATE,
        entityId: tpl.id,
        action: "BOX_TEMPLATE_ITEMS_ADDED",
        afterJson: parsed.data.items,
      });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "אירעה שגיאה.";
    return { success: false, error: message };
  }

  revalidatePath("/admin/inventory/box-template");
  revalidatePath("/admin/boxes");
  return { success: true };
}
