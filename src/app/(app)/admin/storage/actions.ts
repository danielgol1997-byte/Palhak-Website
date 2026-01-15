"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { AuditEntity, Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const YAMAH_NAME = "ימ״ח";

async function getYamahLocation(tx: any) {
  let location = await tx.storageLocation.findUnique({
    where: { name: YAMAH_NAME },
    });
  if (!location) {
    location = await tx.storageLocation.create({
      data: { name: YAMAH_NAME, active: true },
    });
  }
  return location;
}

const UpsertInventorySchema = z.object({
  equipmentItemId: z.string().min(1),
  quantity: z.coerce.number().int().min(0).max(100000),
});

export async function upsertStorageInventoryAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = UpsertInventorySchema.safeParse({
    equipmentItemId: formData.get("equipmentItemId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const yamah = await getYamahLocation(tx);
    const equipmentItemId = parsed.data.equipmentItemId;
    const quantity = parsed.data.quantity;

    const before = await tx.storageInventory.findUnique({
      where: {
        locationId_equipmentItemId: {
          locationId: yamah.id,
          equipmentItemId: equipmentItemId,
        },
      },
      select: { id: true, locationId: true, equipmentItemId: true, quantity: true },
    });

    const after = await tx.storageInventory.upsert({
      where: {
        locationId_equipmentItemId: {
          locationId: yamah.id,
          equipmentItemId: equipmentItemId,
        },
      },
      create: {
        locationId: yamah.id,
        equipmentItemId: equipmentItemId,
        quantity: quantity,
      },
      update: {
        quantity: quantity,
      },
      select: { id: true, locationId: true, equipmentItemId: true, quantity: true },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.STORAGE_INVENTORY,
      entityId: after.id,
      action: "STORAGE_INVENTORY_UPSERT",
      beforeJson: before ?? null,
      afterJson: after,
      metadataJson: { locationId: yamah.id, equipmentItemId: equipmentItemId },
    });
  });

  revalidatePath("/admin/storage");
  revalidatePath("/inventory");
}

const DeleteInventorySchema = z.object({
  id: z.string().min(1),
});

export async function deleteStorageInventoryAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = DeleteInventorySchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.storageInventory.findUnique({
      where: { id: parsed.data.id },
    });
    if (!before) return;

    await tx.storageInventory.delete({
      where: { id: parsed.data.id },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.STORAGE_INVENTORY,
      entityId: parsed.data.id,
      action: "STORAGE_INVENTORY_DELETED",
      beforeJson: before,
      afterJson: null,
    });
  });

  revalidatePath("/admin/storage");
  revalidatePath("/inventory");
}

const RecoverAssignmentSchema = z.object({
  assignmentId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).optional(),
});

export async function recoverAssignmentToStorageAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = RecoverAssignmentSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    // Find the assignment
    const assignment = await tx.assignment.findUnique({
      where: { id: parsed.data.assignmentId },
      include: {
        equipmentItem: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true },
        },
      },
    });

    if (!assignment) throw new Error("הקצאה לא נמצאה.");
    if (
      assignment.status !== "DAMAGED" &&
      assignment.status !== "STOLEN" &&
      assignment.status !== "MISSING" &&
      assignment.status !== "USED"
    ) {
      throw new Error("ניתן לשחזר רק פריטים בסטטוס בלאי, נגנב, אבד או שומש.");
    }

    // Determine quantity to recover (default to all)
    const quantityToRecover = parsed.data.quantity ?? assignment.quantity;

    if (quantityToRecover > assignment.quantity) {
      throw new Error("לא ניתן לשחזר יותר מהכמות הקיימת.");
    }

    // Get yamah location
    const yamah = await getYamahLocation(tx);

    // Restore to storage
    const storageInv = await tx.storageInventory.findUnique({
      where: {
        locationId_equipmentItemId: {
          locationId: yamah.id,
          equipmentItemId: assignment.equipmentItemId,
        },
      },
    });

    if (storageInv) {
      await tx.storageInventory.update({
        where: {
          locationId_equipmentItemId: {
            locationId: yamah.id,
            equipmentItemId: assignment.equipmentItemId,
          },
        },
        data: {
          quantity: storageInv.quantity + quantityToRecover,
        },
      });
    } else {
      await tx.storageInventory.create({
        data: {
          locationId: yamah.id,
          equipmentItemId: assignment.equipmentItemId,
          quantity: quantityToRecover,
        },
      });
    }

    // Handle partial vs full recovery
    if (quantityToRecover < assignment.quantity) {
      // Partial recovery: reduce assignment quantity
      await tx.assignment.update({
        where: { id: assignment.id },
        data: {
          quantity: assignment.quantity - quantityToRecover,
        },
      });

      // Audit log for partial recovery
      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.ASSIGNMENT,
        entityId: assignment.id,
        action: "ASSIGNMENT_PARTIALLY_RECOVERED_TO_STORAGE",
        beforeJson: { quantity: assignment.quantity },
        afterJson: { quantity: assignment.quantity - quantityToRecover },
        metadataJson: {
          equipmentItemId: assignment.equipmentItemId,
          equipmentItemName: assignment.equipmentItem.name,
          userId: assignment.userId,
          userName: assignment.user.name,
          quantityRecovered: quantityToRecover,
          quantityRemaining: assignment.quantity - quantityToRecover,
          previousStatus: assignment.status,
          serialNumber: assignment.serialNumber,
        },
      });
    } else {
      // Full recovery: delete the assignment
      await tx.assignment.delete({
        where: { id: assignment.id },
      });

      // Audit log for full recovery
      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.ASSIGNMENT,
        entityId: assignment.id,
        action: "ASSIGNMENT_RECOVERED_TO_STORAGE",
        beforeJson: assignment,
        afterJson: null,
        metadataJson: {
          equipmentItemId: assignment.equipmentItemId,
          equipmentItemName: assignment.equipmentItem.name,
          userId: assignment.userId,
          userName: assignment.user.name,
          quantity: assignment.quantity,
          previousStatus: assignment.status,
          serialNumber: assignment.serialNumber,
        },
      });
    }
  }, {
    maxWait: 10000,
    timeout: 15000,
  });

  revalidatePath("/admin/storage");
  revalidatePath("/inventory");
  revalidatePath("/admin/weapons-and-sights");
}

