"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { AuditEntity, Role, TashLogAction } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const YAMAH_NAME = "ימ״ח";

// ─── Location management ──────────────────────────────────────────────────────

/** Upsert a location name into the saved list (called internally when a location is used). */
async function ensureTashLocation(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], name: string) {
  await tx.tashLocation.upsert({
    where: { name },
    create: { name },
    update: {},
  });
}

export async function deleteTashLocationAction(formData: FormData) {
  await requireRole(Role.ADMIN);
  const id = formData.get("id") as string;
  if (!id) throw new Error("מזהה חסר.");
  await prisma.tashLocation.delete({ where: { id } }).catch(() => null);
  revalidatePath("/admin/tash");
}

// ─── Item CRUD ────────────────────────────────────────────────────────────────

const ItemSchema = z.object({
  name: z.string().trim().min(1, "שם חובה"),
  description: z.string().trim().optional(),
  unit: z.string().trim().min(1).default("יחידה"),
});

export async function createTashItemAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = ItemSchema.safeParse({
    name: formData.get("name"),
    description: (formData.get("description") as string) || undefined,
    unit: (formData.get("unit") as string) || "יחידה",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const item = await tx.tashItem.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        unit: parsed.data.unit,
      },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.TASH_ITEM,
      entityId: item.id,
      action: "TASH_ITEM_CREATED",
      beforeJson: null,
      afterJson: { name: item.name, description: item.description, unit: item.unit },
    });
  });

  revalidatePath("/admin/tash");
}

export async function updateTashItemAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const id = formData.get("id") as string;
  if (!id) throw new Error("מזהה חסר.");

  const parsed = ItemSchema.safeParse({
    name: formData.get("name"),
    description: (formData.get("description") as string) || undefined,
    unit: (formData.get("unit") as string) || "יחידה",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.tashItem.findUnique({ where: { id } });
    if (!before) throw new Error("פריט לא נמצא.");

    const after = await tx.tashItem.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        unit: parsed.data.unit,
      },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.TASH_ITEM,
      entityId: id,
      action: "TASH_ITEM_UPDATED",
      beforeJson: { name: before.name, description: before.description, unit: before.unit },
      afterJson: { name: after.name, description: after.description, unit: after.unit },
    });
  });

  revalidatePath("/admin/tash");
}

export async function deleteTashItemAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const id = formData.get("id") as string;
  if (!id) throw new Error("מזהה חסר.");

  await prisma.$transaction(async (tx) => {
    const item = await tx.tashItem.findUnique({
      where: { id },
      include: { inventory: true },
    });
    if (!item) throw new Error("פריט לא נמצא.");

    const totalQty = item.inventory.reduce((sum, inv) => sum + inv.quantity, 0);
    if (totalQty > 0) {
      throw new Error("לא ניתן למחוק פריט עם כמות קיימת. יש להוריד את המלאי לאפס תחילה.");
    }

    await tx.tashItem.delete({ where: { id } });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.TASH_ITEM,
      entityId: id,
      action: "TASH_ITEM_DELETED",
      beforeJson: { name: item.name, description: item.description, unit: item.unit },
      afterJson: null,
    });
  });

  revalidatePath("/admin/tash");
}

// ─── Inventory operations ─────────────────────────────────────────────────────

const AddQtySchema = z.object({
  itemId: z.string().min(1),
  location: z.string().trim().min(1, "מיקום חובה"),
  quantity: z.coerce.number().int().min(1, "כמות חייבת להיות לפחות 1").max(100000),
  notes: z.string().trim().optional(),
});

export async function addTashQuantityAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = AddQtySchema.safeParse({
    itemId: formData.get("itemId"),
    location: formData.get("location"),
    quantity: formData.get("quantity"),
    notes: (formData.get("notes") as string) || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    await tx.tashInventory.upsert({
      where: {
        itemId_location: {
          itemId: parsed.data.itemId,
          location: parsed.data.location,
        },
      },
      create: {
        itemId: parsed.data.itemId,
        location: parsed.data.location,
        quantity: parsed.data.quantity,
      },
      update: {
        quantity: { increment: parsed.data.quantity },
      },
    });

    await ensureTashLocation(tx, parsed.data.location);

    await tx.tashLog.create({
      data: {
        itemId: parsed.data.itemId,
        action: TashLogAction.ADDED,
        quantity: parsed.data.quantity,
        toLocation: parsed.data.location,
        notes: parsed.data.notes ?? null,
        performedById: session.user.id,
      },
    });
  });

  revalidatePath("/admin/tash");
}

const DeductQtySchema = z.object({
  itemId: z.string().min(1),
  location: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(100000),
  notes: z.string().trim().optional(),
});

export async function deductTashQuantityAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = DeductQtySchema.safeParse({
    itemId: formData.get("itemId"),
    location: formData.get("location"),
    quantity: formData.get("quantity"),
    notes: (formData.get("notes") as string) || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const inv = await tx.tashInventory.findUnique({
      where: {
        itemId_location: {
          itemId: parsed.data.itemId,
          location: parsed.data.location,
        },
      },
    });
    if (!inv || inv.quantity < parsed.data.quantity) {
      throw new Error("כמות לא מספיקה במיקום זה.");
    }

    if (inv.quantity === parsed.data.quantity) {
      await tx.tashInventory.delete({
        where: {
          itemId_location: {
            itemId: parsed.data.itemId,
            location: parsed.data.location,
          },
        },
      });
    } else {
      await tx.tashInventory.update({
        where: {
          itemId_location: {
            itemId: parsed.data.itemId,
            location: parsed.data.location,
          },
        },
        data: { quantity: { decrement: parsed.data.quantity } },
      });
    }

    await tx.tashLog.create({
      data: {
        itemId: parsed.data.itemId,
        action: TashLogAction.DEDUCTED,
        quantity: parsed.data.quantity,
        fromLocation: parsed.data.location,
        notes: parsed.data.notes ?? null,
        performedById: session.user.id,
      },
    });
  });

  revalidatePath("/admin/tash");
}

const MoveSchema = z.object({
  itemId: z.string().min(1),
  fromLocation: z.string().trim().min(1),
  toLocation: z.string().trim().min(1, "מיקום יעד חובה"),
  quantity: z.coerce.number().int().min(1).max(100000),
  notes: z.string().trim().optional(),
});

export async function moveTashQuantityAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = MoveSchema.safeParse({
    itemId: formData.get("itemId"),
    fromLocation: formData.get("fromLocation"),
    toLocation: formData.get("toLocation"),
    quantity: formData.get("quantity"),
    notes: (formData.get("notes") as string) || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "נתונים לא תקינים.");

  if (parsed.data.fromLocation === parsed.data.toLocation) {
    throw new Error("מיקום המקור והיעד זהים.");
  }

  await prisma.$transaction(async (tx) => {
    const fromInv = await tx.tashInventory.findUnique({
      where: {
        itemId_location: {
          itemId: parsed.data.itemId,
          location: parsed.data.fromLocation,
        },
      },
    });
    if (!fromInv || fromInv.quantity < parsed.data.quantity) {
      throw new Error("כמות לא מספיקה במיקום המקור.");
    }

    if (fromInv.quantity === parsed.data.quantity) {
      await tx.tashInventory.delete({
        where: {
          itemId_location: {
            itemId: parsed.data.itemId,
            location: parsed.data.fromLocation,
          },
        },
      });
    } else {
      await tx.tashInventory.update({
        where: {
          itemId_location: {
            itemId: parsed.data.itemId,
            location: parsed.data.fromLocation,
          },
        },
        data: { quantity: { decrement: parsed.data.quantity } },
      });
    }

    await tx.tashInventory.upsert({
      where: {
        itemId_location: {
          itemId: parsed.data.itemId,
          location: parsed.data.toLocation,
        },
      },
      create: {
        itemId: parsed.data.itemId,
        location: parsed.data.toLocation,
        quantity: parsed.data.quantity,
      },
      update: {
        quantity: { increment: parsed.data.quantity },
      },
    });

    await ensureTashLocation(tx, parsed.data.fromLocation);
    await ensureTashLocation(tx, parsed.data.toLocation);

    const isReturn = parsed.data.toLocation === YAMAH_NAME;
    await tx.tashLog.create({
      data: {
        itemId: parsed.data.itemId,
        action: isReturn ? TashLogAction.RETURNED : TashLogAction.MOVED,
        quantity: parsed.data.quantity,
        fromLocation: parsed.data.fromLocation,
        toLocation: parsed.data.toLocation,
        notes: parsed.data.notes ?? null,
        performedById: session.user.id,
      },
    });
  });

  revalidatePath("/admin/tash");
}

const MarkLossSchema = z.object({
  itemId: z.string().min(1),
  location: z.string().trim().min(1),
  action: z.enum(["LOST", "STOLEN", "DAMAGED"]),
  quantity: z.coerce.number().int().min(1).max(100000),
  notes: z.string().trim().optional(),
});

export async function markTashLossAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = MarkLossSchema.safeParse({
    itemId: formData.get("itemId"),
    location: formData.get("location"),
    action: formData.get("action"),
    quantity: formData.get("quantity"),
    notes: (formData.get("notes") as string) || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const inv = await tx.tashInventory.findUnique({
      where: {
        itemId_location: {
          itemId: parsed.data.itemId,
          location: parsed.data.location,
        },
      },
    });
    if (!inv || inv.quantity < parsed.data.quantity) {
      throw new Error("כמות לא מספיקה במיקום זה.");
    }

    if (inv.quantity === parsed.data.quantity) {
      await tx.tashInventory.delete({
        where: {
          itemId_location: {
            itemId: parsed.data.itemId,
            location: parsed.data.location,
          },
        },
      });
    } else {
      await tx.tashInventory.update({
        where: {
          itemId_location: {
            itemId: parsed.data.itemId,
            location: parsed.data.location,
          },
        },
        data: { quantity: { decrement: parsed.data.quantity } },
      });
    }

    const actionEnum =
      parsed.data.action === "LOST"
        ? TashLogAction.LOST
        : parsed.data.action === "STOLEN"
          ? TashLogAction.STOLEN
          : TashLogAction.DAMAGED;

    await tx.tashLog.create({
      data: {
        itemId: parsed.data.itemId,
        action: actionEnum,
        quantity: parsed.data.quantity,
        fromLocation: parsed.data.location,
        notes: parsed.data.notes ?? null,
        performedById: session.user.id,
      },
    });
  });

  revalidatePath("/admin/tash");
}
