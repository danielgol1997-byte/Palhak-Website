"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { AuditEntity, RequestItemStatus } from "@prisma/client";
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

    if (parsed.data.action === "ACCEPT") {
      // Accept: Create assignment for recipient
      // Note: Items were already unassigned from sender when admin approved the transfer
      
      // Check if recipient already has this item (for non-serialized, combine quantities)
      if (requestItem.serialNumber) {
        // Serialized: always create new assignment
        await tx.assignment.create({
          data: {
            userId: session.user.id,
            equipmentItemId: requestItem.equipmentItemId,
            quantity: requestItem.quantity,
            status: "ASSIGNED",
            active: true,
            assignedById: requestItem.resolvedById,
            assignedAt: new Date(),
            serialNumber: requestItem.serialNumber,
            clothingSize: requestItem.clothingSize,
            shoeSize: requestItem.shoeSize,
          },
        });
      } else {
        // Non-serialized: check for existing assignment and combine
        const existingAssignment = await tx.assignment.findFirst({
          where: {
            userId: session.user.id,
            equipmentItemId: requestItem.equipmentItemId,
            status: "ASSIGNED",
            active: true,
            serialNumber: null,
          },
        });

        if (existingAssignment) {
          // Update existing
          await tx.assignment.update({
            where: { id: existingAssignment.id },
            data: {
              quantity: existingAssignment.quantity + requestItem.quantity,
            },
          });
        } else {
          // Create new
          await tx.assignment.create({
            data: {
              userId: session.user.id,
              equipmentItemId: requestItem.equipmentItemId,
              quantity: requestItem.quantity,
              status: "ASSIGNED",
              active: true,
              assignedById: requestItem.resolvedById,
              assignedAt: new Date(),
              serialNumber: null,
              clothingSize: requestItem.clothingSize,
              shoeSize: requestItem.shoeSize,
            },
          });
        }
      }

      // Update request item status
      await tx.requestItem.update({
        where: { id: parsed.data.requestItemId },
        data: {
          status: RequestItemStatus.ACCEPTED,
          recipientAcceptedAt: new Date(),
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
      // Reject: Update status and add notes
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

