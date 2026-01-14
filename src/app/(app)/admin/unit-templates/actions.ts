"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { AuditEntity, Division, Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const CreateSchema = z.object({
  name: z.string().trim().min(1),
});

export async function createUnitTemplateAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = CreateSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const created = await tx.unitTemplate.create({
      data: {
        name: parsed.data.name,
        active: true,
      },
      select: { id: true, name: true, active: true },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.UNIT_TEMPLATE,
      entityId: created.id,
      action: "UNIT_TEMPLATE_CREATED",
      beforeJson: null,
      afterJson: created,
    });
  });

  revalidatePath("/admin/unit-templates");
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  active: z.string().transform((v) => v === "true").or(z.boolean()),
});

export async function updateUnitTemplateAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = UpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    active: formData.get("active"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.unitTemplate.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        name: true,
        active: true,
        items: { select: { equipmentItemId: true, quantityRequired: true } },
      },
    });
    if (!before) throw new Error("יחידה לא נמצאה.");

    const updated = await tx.unitTemplate.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        active: parsed.data.active,
      },
      select: { id: true, name: true, active: true },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.UNIT_TEMPLATE,
      entityId: parsed.data.id,
      action: "UNIT_TEMPLATE_UPDATED",
      beforeJson: before,
      afterJson: updated,
    });
  });

  revalidatePath("/admin/unit-templates");
  revalidatePath(`/admin/unit-templates/${parsed.data.id}`);
}

const SetItemsSchema = z.object({
  unitTemplateId: z.string().min(1),
  itemsJson: z.string().min(2),
});

export async function setUnitTemplateItemsAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = SetItemsSchema.safeParse({
    unitTemplateId: formData.get("unitTemplateId"),
    itemsJson: formData.get("itemsJson"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  const itemsParsed = z
    .array(
      z.object({
        equipmentItemId: z.string().min(1),
        quantityRequired: z.coerce.number().int().min(1).max(1000),
      }),
    )
    .safeParse(JSON.parse(parsed.data.itemsJson));
  if (!itemsParsed.success) throw new Error("נתוני תכולה לא תקינים.");

  // Deduplicate by equipmentItemId
  const map = new Map<string, number>();
  for (const row of itemsParsed.data) {
    map.set(row.equipmentItemId, row.quantityRequired);
  }
  const items = Array.from(map.entries()).map(([equipmentItemId, quantityRequired]) => ({
    equipmentItemId,
    quantityRequired,
  }));

  await prisma.$transaction(async (tx) => {
    const tpl = await tx.unitTemplate.findUnique({
      where: { id: parsed.data.unitTemplateId },
      select: {
        id: true,
        division: true,
        items: { select: { equipmentItemId: true, quantityRequired: true } },
      },
    });
    if (!tpl) throw new Error("יחידה לא נמצאה.");

    // Validate all items belong to same division
    if (items.length) {
      const dbItems = await tx.equipmentItem.findMany({
        where: { id: { in: items.map((i) => i.equipmentItemId) } },
        select: { id: true, category: { select: { division: true } } },
      });
      const divMap = new Map(dbItems.map((i) => [i.id, i.category.division] as const));
      for (const row of items) {
        const d = divMap.get(row.equipmentItemId);
        if (!d) throw new Error("פריט לא תקין.");
        if (d !== tpl.division) throw new Error("תכולת יחידה חייבת להיות באותה חלוקה.");
      }
    }

    const before = tpl.items;

    await tx.unitTemplateItem.deleteMany({
      where: { unitTemplateId: parsed.data.unitTemplateId },
    });
    if (items.length) {
      await tx.unitTemplateItem.createMany({
        data: items.map((i) => ({
          unitTemplateId: parsed.data.unitTemplateId,
          equipmentItemId: i.equipmentItemId,
          quantityRequired: i.quantityRequired,
        })),
        skipDuplicates: true,
      });
    }

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.UNIT_TEMPLATE,
      entityId: parsed.data.unitTemplateId,
      action: "UNIT_TEMPLATE_ITEMS_SET",
      beforeJson: before,
      afterJson: items,
    });
  });

  revalidatePath("/admin/unit-templates");
  revalidatePath(`/admin/unit-templates/${parsed.data.unitTemplateId}`);
}

const AddItemSchema = z.object({
  unitTemplateId: z.string().min(1),
  equipmentItemId: z.string().min(1),
  quantityRequired: z.coerce.number().int().min(1).max(1000),
});

export async function addUnitTemplateItemAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = AddItemSchema.safeParse({
    unitTemplateId: formData.get("unitTemplateId"),
    equipmentItemId: formData.get("equipmentItemId"),
    quantityRequired: formData.get("quantityRequired"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const tpl = await tx.unitTemplate.findUnique({
      where: { id: parsed.data.unitTemplateId },
      select: { id: true },
    });
    if (!tpl) throw new Error("יחידה לא נמצאה.");

    const item = await tx.equipmentItem.findUnique({
      where: { id: parsed.data.equipmentItemId },
      select: { id: true },
    });
    if (!item) throw new Error("פריט לא נמצא.");

    await tx.unitTemplateItem.upsert({
      where: {
        unitTemplateId_equipmentItemId: {
          unitTemplateId: parsed.data.unitTemplateId,
          equipmentItemId: parsed.data.equipmentItemId,
        },
      },
      create: {
        unitTemplateId: parsed.data.unitTemplateId,
        equipmentItemId: parsed.data.equipmentItemId,
        quantityRequired: parsed.data.quantityRequired,
      },
      update: {
        quantityRequired: parsed.data.quantityRequired,
      },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.UNIT_TEMPLATE,
      entityId: parsed.data.unitTemplateId,
      action: "UNIT_TEMPLATE_ITEM_ADDED",
      afterJson: parsed.data,
    });
  });

  revalidatePath(`/admin/unit-templates/${parsed.data.unitTemplateId}`);
}

const RemoveItemSchema = z.object({
  unitTemplateId: z.string().min(1),
  equipmentItemId: z.string().min(1),
});

export async function removeUnitTemplateItemAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = RemoveItemSchema.safeParse({
    unitTemplateId: formData.get("unitTemplateId"),
    equipmentItemId: formData.get("equipmentItemId"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    await tx.unitTemplateItem.delete({
      where: {
        unitTemplateId_equipmentItemId: {
          unitTemplateId: parsed.data.unitTemplateId,
          equipmentItemId: parsed.data.equipmentItemId,
        },
      },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.UNIT_TEMPLATE,
      entityId: parsed.data.unitTemplateId,
      action: "UNIT_TEMPLATE_ITEM_REMOVED",
      metadataJson: { equipmentItemId: parsed.data.equipmentItemId },
    });
  });

  revalidatePath(`/admin/unit-templates/${parsed.data.unitTemplateId}`);
}

const AddMultipleItemsSchema = z.object({
  unitTemplateId: z.string().min(1),
  items: z.array(
    z.object({
      equipmentItemId: z.string().min(1),
      quantity: z.number().int().min(1).max(1000),
    })
  ),
});

export async function addMultipleUnitTemplateItemsAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  
  const itemsJson = formData.get("items");
  if (!itemsJson || typeof itemsJson !== "string") {
    throw new Error("נתונים לא תקינים.");
  }

  const parsed = AddMultipleItemsSchema.safeParse({
    unitTemplateId: formData.get("unitTemplateId"),
    items: JSON.parse(itemsJson),
  });
  
  if (!parsed.success) {
    throw new Error("נתונים לא תקינים.");
  }

  await prisma.$transaction(async (tx) => {
    const tpl = await tx.unitTemplate.findUnique({
      where: { id: parsed.data.unitTemplateId },
      select: { id: true },
    });
    if (!tpl) throw new Error("יחידה לא נמצאה.");

    // Validate all items exist
    for (const item of parsed.data.items) {
      const equipmentItem = await tx.equipmentItem.findUnique({
        where: { id: item.equipmentItemId },
        select: { id: true },
      });
      if (!equipmentItem) throw new Error("פריט לא נמצא.");
    }

    // Add/update all items
    for (const item of parsed.data.items) {
      await tx.unitTemplateItem.upsert({
        where: {
          unitTemplateId_equipmentItemId: {
            unitTemplateId: parsed.data.unitTemplateId,
            equipmentItemId: item.equipmentItemId,
          },
        },
        create: {
          unitTemplateId: parsed.data.unitTemplateId,
          equipmentItemId: item.equipmentItemId,
          quantityRequired: item.quantity,
        },
        update: {
          quantityRequired: item.quantity,
        },
      });
    }

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.UNIT_TEMPLATE,
      entityId: parsed.data.unitTemplateId,
      action: "UNIT_TEMPLATE_ITEMS_ADDED",
      afterJson: parsed.data.items,
    });
  });

  revalidatePath(`/admin/unit-templates/${parsed.data.unitTemplateId}`);
}

const DeleteSchema = z.object({
  id: z.string().min(1),
});

export async function deleteUnitTemplateAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = DeleteSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const tpl = await tx.unitTemplate.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        name: true,
        active: true,
        items: { select: { equipmentItemId: true, quantityRequired: true } },
      },
    });
    if (!tpl) throw new Error("יחידה לא נמצאה.");

    await tx.unitTemplate.delete({
      where: { id: parsed.data.id },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.UNIT_TEMPLATE,
      entityId: parsed.data.id,
      action: "UNIT_TEMPLATE_DELETED",
      beforeJson: tpl,
      afterJson: null,
    });
  });

  revalidatePath("/admin/unit-templates");
}


