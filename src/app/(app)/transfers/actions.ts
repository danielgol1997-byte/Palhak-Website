"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/auth";
import {
  AssignmentStatus,
  AuditEntity,
  Role,
  TransferStatus,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const TransferItemInputSchema = z.object({
  equipmentItemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1000),
  unitTemplateId: z.string().min(1).nullable().optional(),
});

const CreateTransferSchema = z.object({
  toUserId: z.string().min(1),
  itemsJson: z.string().min(2),
});

export async function createTransferAction(formData: FormData) {
  const session = await requireSession();
  const parsed = CreateTransferSchema.safeParse({
    toUserId: formData.get("toUserId"),
    itemsJson: formData.get("itemsJson"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  const itemsParsed = z.array(TransferItemInputSchema).safeParse(
    JSON.parse(parsed.data.itemsJson),
  );
  if (!itemsParsed.success || itemsParsed.data.length === 0) {
    throw new Error("יש לבחור לפחות פריט אחד.");
  }

  if (parsed.data.toUserId === session.user.id) {
    throw new Error("לא ניתן להעביר לעצמך.");
  }

  const toUser = await prisma.user.findUnique({
    where: { id: parsed.data.toUserId },
    select: { id: true, active: true },
  });
  if (!toUser?.active) throw new Error("מקבל לא תקין.");

  // Merge duplicates (same item + same unitTemplateId)
  const merged = new Map<string, { equipmentItemId: string; quantity: number; unitTemplateId: string | null }>();
  for (const row of itemsParsed.data) {
    const key = `${row.equipmentItemId}::${row.unitTemplateId ?? ""}`;
    const cur = merged.get(key);
    if (!cur) {
      merged.set(key, {
        equipmentItemId: row.equipmentItemId,
        quantity: row.quantity,
        unitTemplateId: row.unitTemplateId ?? null,
      });
    } else {
      cur.quantity += row.quantity;
    }
  }
  const items = Array.from(merged.values());

  await prisma.$transaction(async (tx) => {
    // Validate items exist+active
    const dbItems = await tx.equipmentItem.findMany({
      where: { id: { in: items.map((i) => i.equipmentItemId) }, active: true, category: { active: true } },
      select: { id: true },
    });
    if (dbItems.length !== new Set(items.map((i) => i.equipmentItemId)).size) {
      throw new Error("פריטים לא תקינים.");
    }

    const created = await tx.transfer.create({
      data: {
        fromUserId: session.user.id,
        toUserId: parsed.data.toUserId,
        status: TransferStatus.PENDING_COMMANDER_APPROVAL,
      },
      select: { id: true, fromUserId: true, toUserId: true, status: true, createdAt: true },
    });

    for (const row of items) {
      const ti = await tx.transferItem.create({
        data: {
          transferId: created.id,
          equipmentItemId: row.equipmentItemId,
          quantity: row.quantity,
          unitTemplateId: row.unitTemplateId,
        },
        select: { id: true },
      });
      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.TRANSFER,
        entityId: created.id,
        action: "TRANSFER_ITEM_ADDED",
        beforeJson: null,
        afterJson: { transferItemId: ti.id, ...row },
      });
    }

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.TRANSFER,
      entityId: created.id,
      action: "TRANSFER_CREATED",
      beforeJson: null,
      afterJson: created,
    });
  });

  revalidatePath("/transfers");
}

const TransferIdSchema = z.object({ id: z.string().min(1) });

export async function cancelTransferAction(formData: FormData) {
  const session = await requireSession();
  const parsed = TransferIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.transfer.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        status: true,
        cancelledAt: true,
      },
    });
    if (!before) throw new Error("העברה לא נמצאה.");
    if (before.fromUserId !== session.user.id && session.user.role === Role.USER) {
      throw new Error("אין הרשאה.");
    }
    const terminalStatuses: TransferStatus[] = [
      TransferStatus.COMPLETED,
      TransferStatus.REJECTED,
      TransferStatus.CANCELLED,
    ];
    if (terminalStatuses.includes(before.status)) {
      throw new Error("לא ניתן לבטל העברה במצב זה.");
    }

    const after = await tx.transfer.update({
      where: { id: before.id },
      data: { status: TransferStatus.CANCELLED, cancelledAt: new Date() },
      select: { id: true, status: true, cancelledAt: true },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.TRANSFER,
      entityId: before.id,
      action: "TRANSFER_CANCELLED",
      beforeJson: before,
      afterJson: after,
    });
  });

  revalidatePath("/transfers");
}

export async function adminApproveTransferAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = TransferIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.transfer.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, status: true, approvedAt: true, approvedById: true, rejectedAt: true, cancelledAt: true },
    });
    if (!before) throw new Error("העברה לא נמצאה.");
    if (before.status !== TransferStatus.PENDING_COMMANDER_APPROVAL) {
      throw new Error("לא ניתן לאשר העברה במצב זה.");
    }

    const after = await tx.transfer.update({
      where: { id: parsed.data.id },
      data: {
        status: TransferStatus.PENDING_RECEIVER_CONFIRMATION,
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
      select: { id: true, status: true, approvedById: true, approvedAt: true },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.TRANSFER,
      entityId: parsed.data.id,
      action: "TRANSFER_APPROVED",
      beforeJson: before,
      afterJson: after,
    });
  });

  revalidatePath("/transfers");
}

export async function adminRejectTransferAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = TransferIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.transfer.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, status: true, rejectedAt: true, cancelledAt: true },
    });
    if (!before) throw new Error("העברה לא נמצאה.");
    if (before.status !== TransferStatus.PENDING_COMMANDER_APPROVAL) {
      throw new Error("לא ניתן לדחות העברה במצב זה.");
    }

    const after = await tx.transfer.update({
      where: { id: parsed.data.id },
      data: { status: TransferStatus.REJECTED, rejectedAt: new Date() },
      select: { id: true, status: true, rejectedAt: true },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.TRANSFER,
      entityId: parsed.data.id,
      action: "TRANSFER_REJECTED",
      beforeJson: before,
      afterJson: after,
    });
  });

  revalidatePath("/transfers");
}

export async function receiverConfirmTransferAction(formData: FormData) {
  const session = await requireSession();
  const parsed = TransferIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const transfer = await tx.transfer.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        status: true,
        receivedAt: true,
        items: { select: { id: true, equipmentItemId: true, quantity: true, unitTemplateId: true } },
      },
    });
    if (!transfer) throw new Error("העברה לא נמצאה.");
    if (transfer.toUserId !== session.user.id && session.user.role === Role.USER) {
      throw new Error("אין הרשאה.");
    }
    if (transfer.status !== TransferStatus.PENDING_RECEIVER_CONFIRMATION) {
      throw new Error("לא ניתן לאשר קבלה במצב זה.");
    }

    // Decrement sender assignments, increment receiver assignments
    for (const item of transfer.items) {
      let remaining = item.quantity;
      const rows = await tx.assignment.findMany({
        where: {
          userId: transfer.fromUserId,
          equipmentItemId: item.equipmentItemId,
          status: AssignmentStatus.ASSIGNED,
          active: true,
        },
        orderBy: [{ assignedAt: "asc" }],
        select: { id: true, userId: true, equipmentItemId: true, quantity: true, status: true, active: true, assignedAt: true },
      });
      const total = rows.reduce((acc, r) => acc + r.quantity, 0);
      if (total < remaining) throw new Error("אין כמות מספקת אצל השולח.");

      for (const row of rows) {
        if (remaining <= 0) break;
        if (row.quantity <= remaining) {
          const before = row;
          const after = await tx.assignment.update({
            where: { id: row.id },
            data: { active: false, assignedById: session.user.id },
            select: { id: true, active: true, quantity: true, status: true, userId: true, equipmentItemId: true },
          });
          await writeAuditLog(tx, {
            actorId: session.user.id,
            entity: AuditEntity.ASSIGNMENT,
            entityId: row.id,
            action: "ASSIGNMENT_DEACTIVATED_TRANSFER_OUT",
            beforeJson: before,
            afterJson: after,
            metadataJson: { transferId: transfer.id, transferItemId: item.id },
          });
          remaining -= row.quantity;
        } else {
          const beforeReduce = row;
          const updated = await tx.assignment.update({
            where: { id: row.id },
            data: { quantity: row.quantity - remaining, assignedById: session.user.id },
            select: { id: true, quantity: true, status: true, active: true, userId: true, equipmentItemId: true },
          });
          await writeAuditLog(tx, {
            actorId: session.user.id,
            entity: AuditEntity.ASSIGNMENT,
            entityId: row.id,
            action: "ASSIGNMENT_QUANTITY_UPDATED_TRANSFER_OUT",
            beforeJson: beforeReduce,
            afterJson: updated,
            metadataJson: { transferId: transfer.id, transferItemId: item.id },
          });
          remaining = 0;
        }
      }

      const createdIn = await tx.assignment.create({
        data: {
          userId: transfer.toUserId,
          equipmentItemId: item.equipmentItemId,
          quantity: item.quantity,
          status: AssignmentStatus.ASSIGNED,
          active: true,
          assignedById: session.user.id,
          assignedAt: new Date(),
        },
        select: { id: true, userId: true, equipmentItemId: true, quantity: true, status: true, active: true },
      });
      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.ASSIGNMENT,
        entityId: createdIn.id,
        action: "ASSIGNMENT_CREATED_TRANSFER_IN",
        beforeJson: null,
        afterJson: createdIn,
        metadataJson: { transferId: transfer.id, transferItemId: item.id },
      });
    }

    const before = {
      id: transfer.id,
      status: transfer.status,
      receivedAt: transfer.receivedAt,
    };
    const after = await tx.transfer.update({
      where: { id: transfer.id },
      data: { status: TransferStatus.COMPLETED, receivedAt: new Date() },
      select: { id: true, status: true, receivedAt: true },
    });
    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.TRANSFER,
      entityId: transfer.id,
      action: "TRANSFER_RECEIVED_COMPLETED",
      beforeJson: before,
      afterJson: after,
    });
  });

  revalidatePath("/transfers");
}


