"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { AssignmentStatus, AuditEntity, RequestItemStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const HandleTransferItemSchema = z.object({
  requestItemId: z.string().min(1),
  action: z.enum(["ACCEPT", "REJECT"]),
  recipientNotes: z.string().optional(),
});

export async function handleTransferItemAction(formData: FormData) {
  const session = await requireSession();
  
  const parsed = HandleTransferItemSchema.safeParse({
    requestItemId: formData.get("requestItemId"),
    action: formData.get("action"),
    recipientNotes: formData.get("recipientNotes") || undefined,
  });
  
  if (!parsed.success) {
    throw new Error("נתונים לא תקינים.");
  }

  // Validate rejection has notes
  if (parsed.data.action === "REJECT" && !parsed.data.recipientNotes?.trim()) {
    throw new Error("יש להוסיף הערות בעת דחיית פריט.");
  }

  await prisma.$transaction(async (tx) => {
    const requestItem = await tx.requestItem.findUnique({
      where: { id: parsed.data.requestItemId },
      include: {
        request: {
          include: {
            requester: { select: { id: true, name: true } },
            recipient: { select: { id: true, name: true } },
          },
        },
        equipmentItem: {
          select: {
            id: true,
            name: true,
            isWeapon: true,
            isSight: true,
          },
        },
      },
    });

    if (!requestItem) {
      throw new Error("פריט לא נמצא.");
    }

    // Verify this is a transfer request
    if (requestItem.request.type !== "TRANSFER") {
      throw new Error("זו אינה בקשת העברה.");
    }

    // Verify the current user is the recipient
    if (requestItem.request.recipientId !== session.user.id) {
      throw new Error("אין לך הרשאה לטפל בבקשה זו.");
    }

    // Verify item is in AWAITING_ACCEPTANCE status
    if (requestItem.status !== RequestItemStatus.AWAITING_ACCEPTANCE) {
      throw new Error("פריט זה לא ממתין לקליטה.");
    }

    const now = new Date();

    if (parsed.data.action === "ACCEPT") {
      // Accept: Move in-transit (PENDING_APPROVAL) assignments from approving admin -> recipient.
      // This keeps transfers fully reversible (admin can later reset/deny and we can restore sender).
      const approvingAdminId =
        requestItem.resolvedById ?? requestItem.request.resolvedById ?? null;
      if (!approvingAdminId) {
        throw new Error("מאשר ההעברה לא נמצא.");
      }
      let remaining = requestItem.quantity;

      const pending = await tx.assignment.findMany({
        where: {
          userId: approvingAdminId,
          equipmentItemId: requestItem.equipmentItemId,
          status: AssignmentStatus.PENDING_APPROVAL,
          active: true,
          ...(requestItem.serialNumber ? { serialNumber: requestItem.serialNumber } : { serialNumber: null }),
        },
        orderBy: [{ assignedAt: "asc" }],
      });

      for (const a of pending) {
        if (remaining <= 0) break;
        if (a.quantity <= remaining) {
          await tx.assignment.update({
            where: { id: a.id },
            data: {
              userId: session.user.id,
              status: AssignmentStatus.ASSIGNED,
              assignedAt: now,
              assignedById: approvingAdminId,
            },
          });
          remaining -= a.quantity;
        } else {
          // Split sender pending approval
          await tx.assignment.update({
            where: { id: a.id },
            data: { quantity: a.quantity - remaining },
          });
          await tx.assignment.create({
            data: {
              userId: session.user.id,
              equipmentItemId: requestItem.equipmentItemId,
              quantity: remaining,
              status: AssignmentStatus.ASSIGNED,
              active: true,
              assignedById: approvingAdminId,
              assignedAt: now,
              serialNumber: a.serialNumber,
              clothingSize: a.clothingSize,
              shoeSize: a.shoeSize,
            },
          });
          remaining = 0;
        }
      }

      if (remaining > 0) {
        // Legacy fallback: if sender assignments were previously deleted (older data), create for recipient.
        await tx.assignment.create({
          data: {
            userId: session.user.id,
            equipmentItemId: requestItem.equipmentItemId,
            quantity: remaining,
            status: AssignmentStatus.ASSIGNED,
            active: true,
            assignedById: approvingAdminId,
            assignedAt: now,
            serialNumber: requestItem.serialNumber ?? null,
            clothingSize: requestItem.clothingSize,
            shoeSize: requestItem.shoeSize,
          },
        });
      }

      // Update request item status
      await tx.requestItem.update({
        where: { id: parsed.data.requestItemId },
        data: {
          status: RequestItemStatus.ACCEPTED,
          recipientAcceptedAt: now,
          recipientNotes: parsed.data.recipientNotes || null,
        },
      });

      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.REQUEST_ITEM,
        entityId: parsed.data.requestItemId,
        action: "TRANSFER_ITEM_ACCEPTED",
        metadataJson: {
          requestId: requestItem.requestId,
          fromUserId: requestItem.request.requesterId,
          toUserId: session.user.id,
        },
      });
    } else {
      // Reject: Keep items with approving admin, and mark them as ASSIGNED.
      const approvingAdminId =
        requestItem.resolvedById ?? requestItem.request.resolvedById ?? null;
      if (!approvingAdminId) {
        throw new Error("מאשר ההעברה לא נמצא.");
      }
      let remaining = requestItem.quantity;

      const pending = await tx.assignment.findMany({
        where: {
          userId: approvingAdminId,
          equipmentItemId: requestItem.equipmentItemId,
          status: AssignmentStatus.PENDING_APPROVAL,
          active: true,
          ...(requestItem.serialNumber ? { serialNumber: requestItem.serialNumber } : { serialNumber: null }),
        },
        orderBy: [{ assignedAt: "asc" }],
      });

      for (const a of pending) {
        if (remaining <= 0) break;
        if (a.quantity <= remaining) {
          await tx.assignment.update({
            where: { id: a.id },
            data: { status: AssignmentStatus.ASSIGNED, assignedAt: now },
          });
          remaining -= a.quantity;
        } else {
          await tx.assignment.update({ where: { id: a.id }, data: { quantity: a.quantity - remaining } });
          await tx.assignment.create({
            data: {
              userId: approvingAdminId,
              equipmentItemId: requestItem.equipmentItemId,
              quantity: remaining,
              status: AssignmentStatus.ASSIGNED,
              active: true,
              assignedById: approvingAdminId,
              assignedAt: now,
              serialNumber: a.serialNumber,
              clothingSize: a.clothingSize,
              shoeSize: a.shoeSize,
            },
          });
          remaining = 0;
        }
      }

      if (remaining > 0) {
        // Legacy fallback: recreate for admin if older flow deleted rows
        await tx.assignment.create({
          data: {
            userId: approvingAdminId,
            equipmentItemId: requestItem.equipmentItemId,
            quantity: remaining,
            status: AssignmentStatus.ASSIGNED,
            active: true,
            assignedById: approvingAdminId,
            assignedAt: now,
            serialNumber: requestItem.serialNumber ?? null,
            clothingSize: requestItem.clothingSize,
            shoeSize: requestItem.shoeSize,
          },
        });
      }

      await tx.requestItem.update({
        where: { id: parsed.data.requestItemId },
        data: {
          status: RequestItemStatus.REJECTED_BY_RECIPIENT,
          recipientNotes: parsed.data.recipientNotes,
        },
      });

      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.REQUEST_ITEM,
        entityId: parsed.data.requestItemId,
        action: "TRANSFER_ITEM_REJECTED",
        metadataJson: {
          requestId: requestItem.requestId,
          notes: parsed.data.recipientNotes,
        },
      });
    }

    // Check if all items are resolved and update request status
    const allItems = await tx.requestItem.findMany({
      where: { requestId: requestItem.requestId },
    });

    const awaitingCount = allItems.filter(i => i.status === RequestItemStatus.AWAITING_ACCEPTANCE).length;
    const pendingCount = allItems.filter(i => i.status === RequestItemStatus.PENDING).length;
    const acceptedCount = allItems.filter(i => i.status === RequestItemStatus.ACCEPTED).length;
    const rejectedCount = allItems.filter(i => 
      i.status === RequestItemStatus.REJECTED_BY_RECIPIENT || 
      i.status === RequestItemStatus.DENIED
    ).length;

    // If no items awaiting acceptance and no items pending, close the request
    if (awaitingCount === 0 && pendingCount === 0) {
      let newStatus = "FULFILLED";
      if (acceptedCount === 0) {
        newStatus = "DENIED"; // All rejected
      } else if (rejectedCount > 0) {
        newStatus = "PARTIALLY_FULFILLED"; // Some accepted, some rejected
      }

      await tx.request.update({
        where: { id: requestItem.requestId },
        data: {
          status: newStatus as any,
          resolvedAt: new Date(),
        },
      });
    }
  }, {
    maxWait: 10000,
    timeout: 15000,
  });

  revalidatePath("/requests");
  revalidatePath("/personal");
}

