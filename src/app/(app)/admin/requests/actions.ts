"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { AssignmentStatus, Prisma, Priority, Role, RequestItemStatus, RequestType } from "@prisma/client";
import { AuditEntity } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const MarkViewedSchema = z.object({
  id: z.string().min(1),
});

export async function markRequestViewedAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = MarkViewedSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const request = await tx.request.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, viewedAt: true },
    });

    if (!request) throw new Error("בקשה לא נמצאה.");
    if (request.viewedAt) return; // Already viewed

    await tx.request.update({
      where: { id: parsed.data.id },
      data: { viewedAt: new Date() },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.REQUEST,
      entityId: parsed.data.id,
      action: "REQUEST_VIEWED",
      beforeJson: null,
      afterJson: null,
    });
  });

  revalidatePath("/admin/requests");
  revalidatePath("/requests");
}

const UpdatePrioritySchema = z.object({
  id: z.string().min(1),
  priority: z.nativeEnum(Priority),
});

export async function updateRequestPriorityAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = UpdatePrioritySchema.safeParse({
    id: formData.get("id"),
    priority: formData.get("priority"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.request.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        priority: true,
        status: true,
        type: true,
        requesterId: true,
      },
    });
    if (!before) throw new Error("בקשה לא נמצאה.");

    const after = await tx.request.update({
      where: { id: parsed.data.id },
      data: { priority: parsed.data.priority },
      select: {
        id: true,
        priority: true,
        status: true,
        type: true,
        requesterId: true,
      },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.REQUEST,
      entityId: parsed.data.id,
      action: "REQUEST_PRIORITY_UPDATED",
      beforeJson: before,
      afterJson: after,
    });
  });

  revalidatePath("/admin/requests");
  revalidatePath("/requests");
}

const UpdateRequestNotesSchema = z.object({
  id: z.string().min(1),
  notes: z.string(),
});

export async function updateRequestNotesAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = UpdateRequestNotesSchema.safeParse({
    id: formData.get("id"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.request.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, adminNotes: true },
    });
    if (!before) throw new Error("בקשה לא נמצאה.");

    const after = await tx.request.update({
      where: { id: parsed.data.id },
      data: { adminNotes: parsed.data.notes || null },
      select: { id: true, adminNotes: true },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.REQUEST,
      entityId: parsed.data.id,
      action: "REQUEST_NOTES_UPDATED",
      beforeJson: before,
      afterJson: after,
    });
  });

  revalidatePath("/admin/requests");
  revalidatePath("/requests");
}

const HandleRequestItemSchema = z.object({
  requestId: z.string().min(1),
  requestItemId: z.string().min(1),
  action: z.enum(["FULFILL", "DENY", "CANCEL", "RESET"]),
  quantity: z.number().int().positive().optional(),
  serialNumber: z.string().optional(),
});

function statusFromRequestType(t: any): "MISSING" | "DAMAGED" | "STOLEN" | "USED" | null {
  switch (t) {
    case "MISSING":
      return "MISSING";
    case "DAMAGED":
      return "DAMAGED";
    case "STOLEN":
      return "STOLEN";
    case "USED":
      return "USED";
    default:
      return null;
  }
}

async function getYamahLocationId(tx: Prisma.TransactionClient) {
  const yamah = await tx.storageLocation.findFirst({
    where: { name: "ימ״ח", active: true },
    select: { id: true },
  });
  if (!yamah) throw new Error("מיקום אחסון לא נמצא.");
  return yamah.id;
}

async function adjustStorageInventory(tx: Prisma.TransactionClient, equipmentItemId: string, delta: number) {
  if (delta === 0) return;
  const yamahId = await getYamahLocationId(tx);

  const existing = await tx.storageInventory.findUnique({
    where: {
      locationId_equipmentItemId: { locationId: yamahId, equipmentItemId },
    },
    select: { quantity: true },
  });

  const currentQty = existing?.quantity ?? 0;
  const nextQty = currentQty + delta;
  if (nextQty < 0) throw new Error("אין מספיק מלאי לביצוע הפעולה.");

  if (existing) {
    await tx.storageInventory.update({
      where: { locationId_equipmentItemId: { locationId: yamahId, equipmentItemId } },
      data: { quantity: nextQty },
    });
  } else {
    await tx.storageInventory.create({
      data: { locationId: yamahId, equipmentItemId, quantity: nextQty },
    });
  }
}

/**
 * Reverse any side-effects that were applied when this RequestItem left PENDING.
 * This enables changing decisions on already-closed requests (approve->deny, etc.)
 * while keeping assignments + inventory consistent.
 */
async function reverseRequestItemSideEffects(tx: Prisma.TransactionClient, request: any, requestItem: any) {
  // NOTE: tx is a Prisma.TransactionClient when called inside prisma.$transaction.
  // This function is intentionally typed broadly for request/requestItem to avoid over-select churn.
  const markStatus = statusFromRequestType(request.type);
  const isDeclaration =
    request.type === RequestType.DAMAGED ||
    request.type === RequestType.STOLEN ||
    request.type === RequestType.USED ||
    request.type === RequestType.MISSING;
  const isReturn = request.type === RequestType.RETURN_EQUIPMENT;
  const isTransfer = request.type === RequestType.TRANSFER;

  // Nothing to reverse if we never applied effects
  if (requestItem.status === RequestItemStatus.PENDING) return;
  if (!requestItem.resolvedAt && requestItem.status === RequestItemStatus.FULFILLED && !isTransfer) {
    // Best-effort fallback: allow reversal even if legacy rows are missing timestamps.
  }

  // 1) Declarations: we moved some ASSIGNED assignments to markStatus
  if (isDeclaration && markStatus) {
    // Move back up to requestItem.quantity from markStatus -> ASSIGNED
    let remaining = requestItem.quantity;
    const whereClause: any = {
      userId: request.requesterId,
      equipmentItemId: requestItem.equipmentItemId,
      status: markStatus,
      active: true,
    };
    if (requestItem.serialNumber) whereClause.serialNumber = requestItem.serialNumber;

    const affected = await tx.assignment.findMany({
      where: whereClause,
      orderBy: [{ assignedAt: "desc" }],
    });

    for (const a of affected) {
      if (remaining <= 0) break;
      // For declarations we previously may have split quantities; reverse by toggling status
      if (a.quantity <= remaining) {
        await tx.assignment.update({ where: { id: a.id }, data: { status: AssignmentStatus.ASSIGNED } });
        remaining -= a.quantity;
      } else {
        // Split: keep some marked, move remaining back to ASSIGNED
        await tx.assignment.update({ where: { id: a.id }, data: { quantity: a.quantity - remaining } });
        await tx.assignment.create({
          data: {
            userId: a.userId,
            equipmentItemId: a.equipmentItemId,
            quantity: remaining,
            status: AssignmentStatus.ASSIGNED,
            active: true,
            assignedById: a.assignedById,
            assignedAt: new Date(),
            serialNumber: a.serialNumber,
            clothingSize: a.clothingSize,
            shoeSize: a.shoeSize,
          },
        });
        remaining = 0;
      }
    }

    if (remaining > 0) {
      // Legacy safety net: don't block reset if data drift exists, but signal clearly.
      // We avoid throwing because admin may need to fix inconsistent legacy rows.
    }

    return;
  }

  // 2) Transfer: we should never delete; we move assignments into/out of PENDING_APPROVAL and between users.
  if (isTransfer) {
    const senderId = request.requesterId;
    const recipientId = request.recipientId;
    const approvingAdminId = requestItem.resolvedById ?? request.resolvedById;

    if (!recipientId) throw new Error("מקבל להעברה לא נמצא.");
    if (!approvingAdminId) throw new Error("מאשר ההעברה לא נמצא.");

    // AWAITING_ACCEPTANCE: restore sender's in-transit items back to ASSIGNED
    if (requestItem.status === RequestItemStatus.AWAITING_ACCEPTANCE) {
      let remaining = requestItem.quantity;
      const pending = await tx.assignment.findMany({
        where: {
          userId: approvingAdminId,
          equipmentItemId: requestItem.equipmentItemId,
          status: AssignmentStatus.PENDING_APPROVAL,
          active: true,
          ...(requestItem.serialNumber ? { serialNumber: requestItem.serialNumber } : {}),
        },
        orderBy: [{ assignedAt: "asc" }],
      });

      for (const a of pending) {
        if (remaining <= 0) break;
        if (a.quantity <= remaining) {
          await tx.assignment.update({
            where: { id: a.id },
            data: {
              userId: senderId,
              status: AssignmentStatus.ASSIGNED,
              assignedById: approvingAdminId,
              assignedAt: new Date(),
            },
          });
          remaining -= a.quantity;
        } else {
          await tx.assignment.update({ where: { id: a.id }, data: { quantity: a.quantity - remaining } });
          await tx.assignment.create({
            data: {
              userId: senderId,
              equipmentItemId: requestItem.equipmentItemId,
              quantity: remaining,
              status: AssignmentStatus.ASSIGNED,
              active: true,
              assignedById: approvingAdminId,
              assignedAt: new Date(),
              serialNumber: a.serialNumber,
              clothingSize: a.clothingSize,
              shoeSize: a.shoeSize,
            },
          });
          remaining = 0;
        }
      }
      return;
    }

    // ACCEPTED: move assignments back from recipient to sender
    if (requestItem.status === RequestItemStatus.ACCEPTED) {
      let remaining = requestItem.quantity;

      // Prefer deterministic matching by assignedAt==recipientAcceptedAt when available
      const matchAssignedAt = requestItem.recipientAcceptedAt ?? undefined;
      const recipientAssignments = await tx.assignment.findMany({
        where: {
          userId: recipientId,
          equipmentItemId: requestItem.equipmentItemId,
          status: AssignmentStatus.ASSIGNED,
          active: true,
          ...(requestItem.serialNumber ? { serialNumber: requestItem.serialNumber } : { serialNumber: null }),
          ...(matchAssignedAt ? { assignedAt: matchAssignedAt } : {}),
        },
        orderBy: [{ assignedAt: "desc" }],
      });

      for (const a of recipientAssignments) {
        if (remaining <= 0) break;
        if (a.quantity <= remaining) {
          await tx.assignment.update({
            where: { id: a.id },
            data: { userId: approvingAdminId, status: AssignmentStatus.ASSIGNED },
          });
          remaining -= a.quantity;
        } else {
          // Split: keep some with recipient, move some back
          await tx.assignment.update({ where: { id: a.id }, data: { quantity: a.quantity - remaining } });
          await tx.assignment.create({
            data: {
              userId: approvingAdminId,
              equipmentItemId: requestItem.equipmentItemId,
              quantity: remaining,
              status: AssignmentStatus.ASSIGNED,
              active: true,
              assignedById: a.assignedById,
              assignedAt: new Date(),
              serialNumber: a.serialNumber,
              clothingSize: a.clothingSize,
              shoeSize: a.shoeSize,
            },
          });
          remaining = 0;
        }
      }

      if (remaining > 0) {
        // Fallback for legacy transfers where recipient assignment was merged: best-effort create for approving admin.
        await tx.assignment.create({
          data: {
            userId: approvingAdminId,
            equipmentItemId: requestItem.equipmentItemId,
            quantity: remaining,
            status: AssignmentStatus.ASSIGNED,
            active: true,
            assignedById: requestItem.resolvedById,
            assignedAt: new Date(),
            serialNumber: requestItem.serialNumber ?? null,
            clothingSize: requestItem.clothingSize,
            shoeSize: requestItem.shoeSize,
          },
        });
      }
      return;
    }

    // REJECTED_BY_RECIPIENT: sender should already have it; nothing to reverse beyond clearing item fields.
    return;
  }

  // 3) Return: we removed assignments from requester and increased storage
  if (isReturn) {
    // Reverse: decrease storage, recreate assignment for requester
    await adjustStorageInventory(tx, requestItem.equipmentItemId, -requestItem.quantity);
    await tx.assignment.create({
      data: {
        userId: request.requesterId,
        equipmentItemId: requestItem.equipmentItemId,
        quantity: requestItem.quantity,
        status: AssignmentStatus.ASSIGNED,
        active: true,
        assignedById: requestItem.resolvedById,
        assignedAt: new Date(),
        serialNumber: requestItem.serialNumber ?? null,
        clothingSize: requestItem.clothingSize,
        shoeSize: requestItem.shoeSize,
      },
    });
    return;
  }

  // 4) New equipment / admin assignment: we decreased storage and created assignment(s)
  // Reverse: increase storage and delete assignment(s) created for this fulfillment.
  if (requestItem.status === RequestItemStatus.FULFILLED) {
    // Prefer exact match using resolver + timestamp when available
    const resolverId = requestItem.resolvedById ?? undefined;
    const resolvedAt = requestItem.resolvedAt ?? undefined;

    const candidates = await tx.assignment.findMany({
      where: {
        userId: request.requesterId,
        equipmentItemId: requestItem.equipmentItemId,
        status: AssignmentStatus.ASSIGNED,
        active: true,
        ...(requestItem.serialNumber ? { serialNumber: requestItem.serialNumber } : { serialNumber: null }),
        ...(resolverId ? { assignedById: resolverId } : {}),
        ...(resolvedAt ? { assignedAt: resolvedAt } : {}),
      },
      orderBy: [{ assignedAt: "desc" }],
    });

    let remaining = requestItem.quantity;
    for (const a of candidates) {
      if (remaining <= 0) break;
      if (a.quantity <= remaining) {
        await tx.assignment.delete({ where: { id: a.id } });
        remaining -= a.quantity;
      } else {
        await tx.assignment.update({ where: { id: a.id }, data: { quantity: a.quantity - remaining } });
        remaining = 0;
      }
    }

    if (remaining > 0) {
      // Safety first: for non-serialized items, legacy fulfillments may have "merged" quantities into
      // older Assignment rows, which is not safely reversible without a linkage.
      // We refuse to guess to avoid corrupting unrelated assignments.
      if (!requestItem.serialNumber) {
        throw new Error(
          "לא ניתן לבטל אספקה ישנה בצורה בטוחה (הכמות מוזגה להקצאה קיימת). נא לטפל ידנית בהקצאות/מלאי או לבצע אספקה חדשה לאחר תיקון."
        );
      }
    }

    // Only after assignments were removed successfully, restore storage
    await adjustStorageInventory(tx, requestItem.equipmentItemId, requestItem.quantity);
  }
}

export async function handleRequestItemAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const quantityStr = formData.get("quantity");
  const parsed = HandleRequestItemSchema.safeParse({
    requestId: formData.get("requestId"),
    requestItemId: formData.get("requestItemId"),
    action: formData.get("action"),
    quantity: quantityStr ? parseInt(quantityStr as string) : undefined,
    serialNumber: formData.get("serialNumber") || undefined,
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const request = await tx.request.findUnique({
      where: { id: parsed.data.requestId },
      include: {
        items: {
          include: {
            equipmentItem: {
              select: {
                id: true,
                name: true,
                isWeapon: true,
                isSight: true,
              },
            },
          },
        },
      },
    });
    if (!request) throw new Error("בקשה לא נמצאה.");

    const requestItem = request.items.find((item) => item.id === parsed.data.requestItemId);
    if (!requestItem) throw new Error("פריט לא נמצא.");

    // Allow RESET action on any status except PENDING
    if (parsed.data.action === "RESET") {
      if (requestItem.status === "PENDING") {
        throw new Error("פריט כבר במצב ממתין.");
      }

      // Reverse side-effects regardless of the current non-pending status
      await reverseRequestItemSideEffects(tx, request, requestItem);

      // Reset the item status to PENDING
      await tx.requestItem.update({
        where: { id: parsed.data.requestItemId },
        data: {
          status: "PENDING",
          resolvedAt: null,
          resolvedById: null,
          recipientNotes: null,
          recipientAcceptedAt: null,
          ...(request.type === RequestType.NEW_EQUIPMENT || request.type === RequestType.ADMIN_ASSIGNMENT
            ? { serialNumber: null }
            : {}),
        },
      });

      // Update the request status back to appropriate state
      const updatedRequest = await tx.request.findUnique({
        where: { id: parsed.data.requestId },
        include: { items: true },
      });

      if (updatedRequest) {
        const pendingCount = updatedRequest.items.filter((i) => i.status === "PENDING").length;
        const fulfilledCount = updatedRequest.items.filter((i) => i.status === "FULFILLED").length;

        let newRequestStatus = updatedRequest.status;
        if (pendingCount > 0 && fulfilledCount > 0) {
          newRequestStatus = "PARTIALLY_FULFILLED";
        } else if (pendingCount > 0) {
          newRequestStatus = "IN_PROGRESS";
        }

        if (newRequestStatus !== updatedRequest.status) {
          const updateData: any = {
            status: newRequestStatus,
          };
          
          // If reopening a closed request (moving back to in-progress), clear resolution info
          if (newRequestStatus === "IN_PROGRESS" || newRequestStatus === "OPEN") {
            updateData.resolvedById = null;
            updateData.resolvedAt = null;
          }
          
          await tx.request.update({
            where: { id: parsed.data.requestId },
            data: updateData,
          });
        }
      }

      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.REQUEST_ITEM,
        entityId: parsed.data.requestItemId,
        action: "REQUEST_ITEM_RESET",
        beforeJson: { status: requestItem.status },
        afterJson: { status: "PENDING" },
        metadataJson: {
          requestId: parsed.data.requestId,
          requestType: request.type,
          requesterId: request.requesterId,
          equipmentItemId: requestItem.equipmentItemId,
          quantity: requestItem.quantity,
          fromStatus: requestItem.status,
          toStatus: "PENDING",
          didReverseSideEffects: true,
        },
      });
    } else {
      // For DENY/CANCEL/FULFILL we allow changing decisions on already-processed items:
      // reverse previous side effects first, then apply the new decision.
      if (requestItem.status !== "PENDING") {
        await reverseRequestItemSideEffects(tx, request, requestItem);
      }

      let newItemStatus: "FULFILLED" | "DENIED" | "CANCELLED";
      
      if (parsed.data.action === "FULFILL") {
        // Check if weapon or sight requires serial number
        const requiresSerialNumber = requestItem.equipmentItem.isWeapon || requestItem.equipmentItem.isSight;
        if (requiresSerialNumber && !parsed.data.serialNumber) {
          const itemType = requestItem.equipmentItem.isWeapon ? "נשק" : "צלמ";
          throw new Error(`נדרש מספר סידורי עבור ${itemType}.`);
        }
        
        // Determine quantity to fulfill (default to full amount if not specified)
        const quantityToFulfill = parsed.data.quantity ?? requestItem.quantity;
        
        if (quantityToFulfill > requestItem.quantity) {
          throw new Error("לא ניתן לספק יותר מהכמות המבוקשת.");
        }
        
        newItemStatus = "FULFILLED";
        
        const now = new Date();

        // Check if this is a status declaration (DAMAGED, STOLEN, USED, or MISSING)
        const markStatus = statusFromRequestType(request.type);
        const isDeclaration =
          request.type === RequestType.DAMAGED ||
          request.type === RequestType.STOLEN ||
          request.type === RequestType.USED ||
          request.type === RequestType.MISSING;
        const isReturn = request.type === RequestType.RETURN_EQUIPMENT;
        
        if (isDeclaration && markStatus) {
          // For declarations (DAMAGED/STOLEN), just update existing assignment status
          // NO storage deduction, NO new assignment creation
          let remaining = quantityToFulfill;
          
          // If a serial number is provided, filter to that specific assignment
          const whereClause: any = {
            userId: request.requesterId,
            equipmentItemId: requestItem.equipmentItemId,
            status: "ASSIGNED",
            active: true,
          };
          if (requestItem.serialNumber) {
            whereClause.serialNumber = requestItem.serialNumber;
          }
          
          const existingAssignments = await tx.assignment.findMany({
            where: whereClause,
            orderBy: [{ assignedAt: "asc" }],
          });

          const total = existingAssignments.reduce((acc, r) => acc + r.quantity, 0);
          if (total < remaining) {
            const serialInfo = requestItem.serialNumber ? ` (צ: ${requestItem.serialNumber})` : '';
            throw new Error(`החייל לא מחזיק ${remaining} יחידות של ${requestItem.equipmentItem.name}${serialInfo}. יש לו רק ${total}.`);
          }

          for (const assignment of existingAssignments) {
            if (remaining <= 0) break;
            if (assignment.quantity <= remaining) {
              await tx.assignment.update({
                where: { id: assignment.id },
                data: { 
                  status: markStatus,
                  assignedById: session.user.id,
                  serialNumber: parsed.data.serialNumber || assignment.serialNumber,
                  clothingSize: requestItem.clothingSize || assignment.clothingSize,
                  shoeSize: requestItem.shoeSize || assignment.shoeSize,
                },
              });
              remaining -= assignment.quantity;
            } else {
              // Split the assignment: keep some as ASSIGNED, mark some as DAMAGED/STOLEN
              await tx.assignment.update({
                where: { id: assignment.id },
                data: { quantity: assignment.quantity - remaining },
              });
              await tx.assignment.create({
                data: {
                  userId: request.requesterId,
                  equipmentItemId: requestItem.equipmentItemId,
                  quantity: remaining,
                  status: markStatus,
                  active: true,
                  assignedById: session.user.id,
                  assignedAt: now,
                  serialNumber: parsed.data.serialNumber || null,
                  clothingSize: requestItem.clothingSize,
                  shoeSize: requestItem.shoeSize,
                },
              });
              remaining = 0;
            }
          }
        } else if (request.type === RequestType.TRANSFER) {
          // For TRANSFER: unassign from sender, set status to AWAITING_ACCEPTANCE
          // Do NOT create assignment to recipient yet - that happens when they accept
          if (!request.recipientId) throw new Error("מקבל להעברה לא נמצא.");
          
          let remaining = quantityToFulfill;
          
          // Find sender assignments and move the transferred quantity to approving admin (in-transit)
          const whereClause: any = {
            userId: request.requesterId,
            equipmentItemId: requestItem.equipmentItemId,
            status: "ASSIGNED",
            active: true,
          };
          if (requestItem.serialNumber) {
            whereClause.serialNumber = requestItem.serialNumber;
          }
          
          const senderAssignments = await tx.assignment.findMany({
            where: whereClause,
            orderBy: [{ assignedAt: "asc" }],
          });

          const total = senderAssignments.reduce((acc, r) => acc + r.quantity, 0);
          if (total < remaining) {
            const serialInfo = requestItem.serialNumber ? ` (צ: ${requestItem.serialNumber})` : '';
            throw new Error(`החייל לא מחזיק ${remaining} יחידות של ${requestItem.equipmentItem.name}${serialInfo}. יש לו רק ${total}.`);
          }

          // Move quantity from sender to approving admin (do not delete)
          for (const assignment of senderAssignments) {
            if (remaining <= 0) break;
            if (assignment.quantity <= remaining) {
              await tx.assignment.update({
                where: { id: assignment.id },
                data: {
                  userId: session.user.id,
                  status: AssignmentStatus.PENDING_APPROVAL,
                  assignedById: session.user.id,
                  assignedAt: now,
                },
              });
              remaining -= assignment.quantity;
            } else {
              // Split: leave some with sender as ASSIGNED, move some to PENDING_APPROVAL
              await tx.assignment.update({
                where: { id: assignment.id },
                data: { quantity: assignment.quantity - remaining },
              });
              await tx.assignment.create({
                data: {
                  userId: session.user.id,
                  equipmentItemId: assignment.equipmentItemId,
                  quantity: remaining,
                  status: AssignmentStatus.PENDING_APPROVAL,
                  active: true,
                  assignedById: session.user.id,
                  assignedAt: now,
                  serialNumber: assignment.serialNumber,
                  clothingSize: assignment.clothingSize,
                  shoeSize: assignment.shoeSize,
                },
              });
              remaining = 0;
            }
          }
          
          // Set item status to AWAITING_ACCEPTANCE (not FULFILLED)
          newItemStatus = "FULFILLED"; // This will be overridden below
          
        } else if (isReturn) {
          // For RETURN_EQUIPMENT: remove assignments and return to storage
          const yamah = await tx.storageLocation.findFirst({
            where: { name: "ימ״ח", active: true },
          });
          if (!yamah) throw new Error("מיקום אחסון לא נמצא.");

          let remaining = quantityToFulfill;
          
          // If a serial number is provided, filter to that specific assignment
          const whereClause: any = {
            userId: request.requesterId,
            equipmentItemId: requestItem.equipmentItemId,
            status: "ASSIGNED",
            active: true,
          };
          if (requestItem.serialNumber) {
            whereClause.serialNumber = requestItem.serialNumber;
          }
          
          const existingAssignments = await tx.assignment.findMany({
            where: whereClause,
            orderBy: [{ assignedAt: "asc" }],
          });

          const total = existingAssignments.reduce((acc, r) => acc + r.quantity, 0);
          if (total < remaining) {
            const serialInfo = requestItem.serialNumber ? ` (צ: ${requestItem.serialNumber})` : '';
            throw new Error(`החייל לא מחזיק ${remaining} יחידות של ${requestItem.equipmentItem.name}${serialInfo}. יש לו רק ${total}.`);
          }

          // Remove assignments and save serial number
          let serialNumberToSave = parsed.data.serialNumber;
          for (const assignment of existingAssignments) {
            if (remaining <= 0) break;
            
            // Capture serial number from assignment if not provided
            if (!serialNumberToSave && assignment.serialNumber) {
              serialNumberToSave = assignment.serialNumber;
            }
            
            if (assignment.quantity <= remaining) {
              await tx.assignment.delete({
                where: { id: assignment.id },
              });
              remaining -= assignment.quantity;
            } else {
              // Reduce the quantity
              await tx.assignment.update({
                where: { id: assignment.id },
                data: { quantity: assignment.quantity - remaining },
              });
              remaining = 0;
            }
          }

          // Return to storage
          const storageInv = await tx.storageInventory.findUnique({
            where: {
              locationId_equipmentItemId: {
                locationId: yamah.id,
                equipmentItemId: requestItem.equipmentItemId,
              },
            },
          });

          if (storageInv) {
            await tx.storageInventory.update({
              where: {
                locationId_equipmentItemId: {
                  locationId: yamah.id,
                  equipmentItemId: requestItem.equipmentItemId,
                },
              },
              data: {
                quantity: storageInv.quantity + quantityToFulfill,
              },
            });
          } else {
            await tx.storageInventory.create({
              data: {
                locationId: yamah.id,
                equipmentItemId: requestItem.equipmentItemId,
                quantity: quantityToFulfill,
              },
            });
          }

          // Update the request item with the serial number for history
          if (serialNumberToSave) {
            await tx.requestItem.update({
              where: { id: requestItem.id },
              data: { serialNumber: serialNumberToSave },
            });
          }
        } else {
          // For NEW_EQUIPMENT requests: deduct storage and create new assignment
          // Deduct storage and create a *traceable* assignment row (no merging),
          // so future reversals are deterministic.
          await adjustStorageInventory(tx, requestItem.equipmentItemId, -quantityToFulfill);

          await tx.assignment.create({
            data: {
              userId: request.requesterId,
              equipmentItemId: requestItem.equipmentItemId,
              quantity: quantityToFulfill,
              status: AssignmentStatus.ASSIGNED,
              active: true,
              assignedById: session.user.id,
              assignedAt: now,
              serialNumber: parsed.data.serialNumber ?? null,
              clothingSize: requestItem.clothingSize,
              shoeSize: requestItem.shoeSize,
            },
          });
        }

        // Handle partial fulfillment
        if (quantityToFulfill < requestItem.quantity) {
            // For TRANSFER, set status to AWAITING_ACCEPTANCE instead of FULFILLED
            const partialStatus = request.type === RequestType.TRANSFER ? "AWAITING_ACCEPTANCE" : "FULFILLED";
            
            // Create a new RequestItem for the fulfilled portion
            await tx.requestItem.create({
              data: {
                requestId: parsed.data.requestId,
                equipmentItemId: requestItem.equipmentItemId,
                quantity: quantityToFulfill,
                status: partialStatus as any,
                serialNumber: parsed.data.serialNumber,
                resolvedAt: now,
                resolvedById: session.user.id,
              },
            });

            // Update the original item to reduce quantity and keep as PENDING
            await tx.requestItem.update({
              where: { id: parsed.data.requestItemId },
              data: { 
                quantity: requestItem.quantity - quantityToFulfill,
                status: "PENDING"
              },
            });
          } else {
            // Full fulfillment - just update status and serial number
            // For TRANSFER, set status to AWAITING_ACCEPTANCE instead of FULFILLED
            const finalStatus = request.type === RequestType.TRANSFER ? "AWAITING_ACCEPTANCE" : newItemStatus;
            
            await tx.requestItem.update({
              where: { id: parsed.data.requestItemId },
              data: { 
                status: finalStatus as any,
                serialNumber: parsed.data.serialNumber,
                resolvedAt: now,
                resolvedById: session.user.id,
                ...(request.type === RequestType.TRANSFER
                  ? { recipientAcceptedAt: null, recipientNotes: null }
                  : {}),
              },
            });
          }
      } else if (parsed.data.action === "DENY") {
        newItemStatus = "DENIED";
        // Update request item status
        await tx.requestItem.update({
          where: { id: parsed.data.requestItemId },
          data: {
            status: newItemStatus,
            resolvedAt: new Date(),
            resolvedById: session.user.id,
            recipientAcceptedAt: null,
            recipientNotes: null,
          },
        });
      } else {
        newItemStatus = "CANCELLED";
        // Update request item status
        await tx.requestItem.update({
          where: { id: parsed.data.requestItemId },
          data: {
            status: newItemStatus,
            resolvedAt: new Date(),
            resolvedById: session.user.id,
            recipientAcceptedAt: null,
            recipientNotes: null,
          },
        });
      }

      // Check if all items are handled and update request status accordingly
      const updatedRequest = await tx.request.findUnique({
        where: { id: parsed.data.requestId },
        include: { items: true },
      });

      if (updatedRequest) {
        const pendingCount = updatedRequest.items.filter((i) => i.status === "PENDING").length;
        const fulfilledCount = updatedRequest.items.filter((i) => i.status === "FULFILLED").length;
        const awaitingAcceptanceCount = updatedRequest.items.filter((i) => i.status === "AWAITING_ACCEPTANCE").length;
        const deniedCount = updatedRequest.items.filter((i) => i.status === "DENIED").length;
        const cancelledCount = updatedRequest.items.filter((i) => i.status === "CANCELLED").length;
        const totalCount = updatedRequest.items.length;
        const processedCount = fulfilledCount + deniedCount + cancelledCount;

        let newRequestStatus = updatedRequest.status;
        
        // For transfers, if items are awaiting acceptance, keep as IN_PROGRESS
        if (awaitingAcceptanceCount > 0) {
          newRequestStatus = "IN_PROGRESS";
        // If all items are processed (none pending), close the request
        } else if (pendingCount === 0) {
          if (fulfilledCount === totalCount) {
            // All fulfilled
            newRequestStatus = "FULFILLED";
          } else if (deniedCount === totalCount) {
            // All denied
            newRequestStatus = "DENIED";
          } else if (cancelledCount === totalCount) {
            // All cancelled
            newRequestStatus = "CANCELLED";
          } else if (fulfilledCount > 0) {
            // Mix with some fulfilled
            newRequestStatus = "PARTIALLY_FULFILLED";
          } else {
            // Mix without fulfilled (denied + cancelled)
            newRequestStatus = "CANCELLED";
          }
        } 
        // If some items are processed but some are still pending, mark as in progress
        else if (processedCount > 0) {
          if (fulfilledCount > 0) {
            newRequestStatus = "PARTIALLY_FULFILLED";
          } else {
            newRequestStatus = "IN_PROGRESS";
          }
        }
        // If no items are processed yet and status is not OPEN, set to OPEN
        else if (processedCount === 0 && updatedRequest.status !== "OPEN") {
          newRequestStatus = "OPEN";
        }

        if (newRequestStatus !== updatedRequest.status) {
          const updateData: any = {
            status: newRequestStatus,
          };
          
          // If moving to a closed status, record who resolved it and when
          const closedStatuses = ["FULFILLED", "PARTIALLY_FULFILLED", "DENIED", "CANCELLED"];
          if (closedStatuses.includes(newRequestStatus) && !updatedRequest.resolvedById) {
            updateData.resolvedById = session.user.id;
            updateData.resolvedAt = new Date();
          }
          
          await tx.request.update({
            where: { id: parsed.data.requestId },
            data: updateData,
          });
        }
      }

      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.REQUEST_ITEM,
        entityId: parsed.data.requestItemId,
        action: `REQUEST_ITEM_${parsed.data.action}ED`,
        beforeJson: { status: requestItem.status, quantity: requestItem.quantity },
        afterJson: { status: newItemStatus, quantityFulfilled: parsed.data.action === "FULFILL" ? parsed.data.quantity : undefined },
        metadataJson: {
          requestId: parsed.data.requestId,
          requestType: request.type,
          requesterId: request.requesterId,
          recipientId: request.recipientId ?? null,
          equipmentItemId: requestItem.equipmentItemId,
          quantity: requestItem.quantity,
          action: parsed.data.action,
          fromStatus: requestItem.status,
          // Note: for TRANSFER the stored status is AWAITING_ACCEPTANCE; this field is still useful.
          didReverseSideEffects: requestItem.status !== "PENDING",
        },
      });
    }
  }, {
    maxWait: 10000, // 10 seconds max wait for transaction to start
    timeout: 15000, // 15 seconds max transaction duration
  });

  // Fetch the updated request with all items
  const updatedRequest = await prisma.request.findUnique({
    where: { id: parsed.data.requestId },
    select: {
      id: true,
      type: true,
      status: true,
      priority: true,
      userNotes: true,
      adminNotes: true,
      viewedAt: true,
      resolvedAt: true,
      createdAt: true,
      updatedAt: true,
      requester: {
        select: {
          id: true,
          name: true,
        },
      },
      resolvedBy: {
        select: {
          id: true,
          name: true,
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          status: true,
          serialNumber: true,
          clothingSize: true,
          shoeSize: true,
          equipmentItem: {
            select: {
              id: true,
              name: true,
              isWeapon: true,
              isSight: true,
              isClothing: true,
              isShoe: true,
              category: {
                select: {
                  division: true,
                },
              },
            },
          },
        },
      },
    },
  });

  revalidatePath("/admin/requests");
  revalidatePath("/requests");

  return { updatedRequest };
}
