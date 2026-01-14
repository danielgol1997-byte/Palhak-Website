"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, requireRole } from "@/lib/auth";
import {
  AssignmentStatus,
  AuditEntity,
  ClothingSize,
  ShoeSize,
  Priority,
  RequestStatus,
  RequestType,
  Role,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const CreateRequestSchema = z.object({
  type: z.nativeEnum(RequestType),
  userNotes: z.string().optional(),
  recipientId: z.string().optional(),
  items: z.array(
    z.object({
      equipmentItemId: z.string().min(1),
      quantity: z.coerce.number().int().min(1).max(1000),
      clothingSize: z.nativeEnum(ClothingSize).nullable().optional(),
      shoeSize: z.nativeEnum(ShoeSize).nullable().optional(),
      serialNumber: z.string().nullable().optional(),
    })
  ).min(1),
}).superRefine((data, ctx) => {
  // For declarations, userNotes is required
  const isDeclaration = data.type === RequestType.DAMAGED || 
                        data.type === RequestType.STOLEN || 
                        data.type === RequestType.MISSING;
  
  // For transfers, recipientId is required
  if (data.type === RequestType.TRANSFER && !data.recipientId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "יש לבחור מקבל להעברה",
      path: ["recipientId"],
    });
  }
  
  if (isDeclaration && (!data.userNotes || data.userNotes.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "הערות הן שדה חובה עבור הצהרות",
      path: ["userNotes"],
    });
  }
});

export async function createRequestAction(formData: FormData) {
  const session = await requireSession();
  
  const itemsJson = formData.get("items");
  if (!itemsJson || typeof itemsJson !== "string") {
    throw new Error("נתונים לא תקינים.");
  }

  const parsed = CreateRequestSchema.safeParse({
    type: formData.get("type"),
    userNotes: formData.get("userNotes") || undefined,
    recipientId: formData.get("recipientId") || undefined,
    items: JSON.parse(itemsJson),
  });
  
  // #region agent log
  const fs = require('fs');
  const itemsRaw = formData.get("items");
  const itemsParsed = itemsRaw ? JSON.parse(itemsRaw as string) : null;
  const errorsStr = parsed.success ? null : (parsed.error?.errors ? JSON.stringify(parsed.error.errors).slice(0,500) : 'no errors array');
  const fullErrorObj = parsed.success ? null : JSON.stringify(parsed.error, null, 2).slice(0, 1000);
  fs.appendFileSync('/Users/daniel/Desktop/Cursor projects/Palhak website/.cursor/debug.log', JSON.stringify({location:'actions.ts:71',message:'Parsed request data',data:{success:parsed.success,type:formData.get("type"),itemsJsonLength:itemsRaw?.length,itemsParsedLength:itemsParsed?.length,itemsParsedSample:JSON.stringify(itemsParsed?.[0]),recipientId:formData.get("recipientId"),errors:errorsStr,fullError:fullErrorObj},timestamp:Date.now(),sessionId:'debug-session',runId:'submit',hypothesisId:'N'})+'\n');
  // #endregion
  
  if (!parsed.success) {
    const firstError = parsed.error?.errors?.[0];
    // #region agent log
    const allErrorsStr = parsed.error?.errors ? JSON.stringify(parsed.error.errors) : 'no errors';
    fs.appendFileSync('/Users/daniel/Desktop/Cursor projects/Palhak website/.cursor/debug.log', JSON.stringify({location:'actions.ts:80',message:'Validation failed',data:{errorMessage:firstError?.message,errorPath:JSON.stringify(firstError?.path),allErrors:allErrorsStr},timestamp:Date.now(),sessionId:'debug-session',runId:'submit',hypothesisId:'S'})+'\n');
    // #endregion
    throw new Error(firstError?.message || "נתונים לא תקינים.");
  }

  const requesterId = session.user.id;

  await prisma.$transaction(async (tx) => {
    // Validate all items first
    for (const item of parsed.data.items) {
      const equipmentItem = await tx.equipmentItem.findUnique({
        where: { id: item.equipmentItemId },
        select: { id: true, active: true, name: true },
      });
      if (!equipmentItem?.active) throw new Error(`פריט "${equipmentItem?.name || item.equipmentItemId}" לא תקין.`);

      // Only validate for declarations and returns - they must have the item
      if (parsed.data.type !== RequestType.NEW_EQUIPMENT) {
        const assignedQty = await tx.assignment.aggregate({
          where: {
            userId: requesterId,
            equipmentItemId: item.equipmentItemId,
            status: AssignmentStatus.ASSIGNED,
            active: true,
          },
          _sum: { quantity: true },
        });
        const hasAssigned = (assignedQty._sum.quantity ?? 0) > 0;
        
        if (!hasAssigned) {
          const errorMsg = parsed.data.type === RequestType.RETURN_EQUIPMENT 
            ? `לא ניתן להחזיר ציוד שלא מוקצה לך: ${equipmentItem.name}.`
            : `ניתן לדווח רק על ציוד שקיים אצלך: ${equipmentItem.name}.`;
          throw new Error(errorMsg);
        }
      }
    }

    // For new equipment requests with serialized items, split into individual items
    const requestItemsToCreate = [];
    for (const item of parsed.data.items) {
      const equipmentItem = await tx.equipmentItem.findUnique({
        where: { id: item.equipmentItemId },
        select: { isWeapon: true, isSight: true },
      });
      
      const requiresSerial = equipmentItem?.isWeapon || equipmentItem?.isSight;
      const isNewEquipment = parsed.data.type === RequestType.NEW_EQUIPMENT;
      
      // Split serialized items into individual units for new equipment
      if (requiresSerial && isNewEquipment && item.quantity > 1) {
        for (let i = 0; i < item.quantity; i++) {
          requestItemsToCreate.push({
            equipmentItemId: item.equipmentItemId,
            quantity: 1,
            clothingSize: item.clothingSize,
            shoeSize: item.shoeSize,
            serialNumber: item.serialNumber,
          });
        }
      } else {
        requestItemsToCreate.push({
          equipmentItemId: item.equipmentItemId,
          quantity: item.quantity,
          clothingSize: item.clothingSize,
          shoeSize: item.shoeSize,
          serialNumber: item.serialNumber,
        });
      }
    }

    // Create single request with items (serialized items split into individual entries)
    const request = await tx.request.create({
      data: {
        requesterId,
        type: parsed.data.type,
        priority: Priority.MEDIUM,
        status: RequestStatus.OPEN,
        userNotes: parsed.data.userNotes,
        recipientId: parsed.data.recipientId,
        items: {
          create: requestItemsToCreate,
        },
      },
      select: {
        id: true,
        requesterId: true,
        type: true,
        priority: true,
        status: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            equipmentItemId: true,
            quantity: true,
            clothingSize: true,
            shoeSize: true,
          },
        },
      },
    });

    await writeAuditLog(tx, {
      actorId: requesterId,
      entity: AuditEntity.REQUEST,
      entityId: request.id,
      action: "REQUEST_CREATED",
      beforeJson: null,
      afterJson: request,
    });
  }, {
    maxWait: 10000, // 10 seconds max wait for transaction to start
    timeout: 15000, // 15 seconds max transaction duration
  });

  revalidatePath("/requests");
  revalidatePath("/admin/requests");
}

const CancelSchema = z.object({
  id: z.string().min(1),
});

export async function cancelRequestAction(formData: FormData) {
  const session = await requireSession();
  const parsed = CancelSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.request.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        requesterId: true,
        status: true,
        priority: true,
        type: true,
      },
    });
    if (!before) throw new Error("בקשה לא נמצאה.");

    const isAdmin = session.user.role !== Role.USER;
    if (!isAdmin && before.requesterId !== session.user.id) {
      throw new Error("אין הרשאה.");
    }
    const cancellableByUser: RequestStatus[] = [RequestStatus.OPEN, RequestStatus.IN_PROGRESS];
    if (!isAdmin && !cancellableByUser.includes(before.status)) {
      throw new Error("לא ניתן לבטל בקשה במצב זה.");
    }
    const notCancellable: RequestStatus[] = [RequestStatus.FULFILLED, RequestStatus.DENIED];
    if (notCancellable.includes(before.status)) {
      throw new Error("לא ניתן לבטל בקשה במצב זה.");
    }

    // Update all pending request items to cancelled
    await tx.requestItem.updateMany({
      where: {
        requestId: parsed.data.id,
        status: "PENDING",
      },
      data: {
        status: "CANCELLED",
      },
    });

    const after = await tx.request.update({
      where: { id: parsed.data.id },
      data: { status: RequestStatus.CANCELLED },
      select: {
        id: true,
        requesterId: true,
        status: true,
        priority: true,
        type: true,
      },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.REQUEST,
      entityId: parsed.data.id,
      action: "REQUEST_CANCELLED",
      beforeJson: before,
      afterJson: after,
    });
  });

  revalidatePath("/requests");
  revalidatePath("/admin/requests");
}

const AdminUpdateSchema = z.object({
  id: z.string().min(1),
  priority: z.nativeEnum(Priority),
  status: z.nativeEnum(RequestStatus),
});

export async function adminUpdateRequestAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = AdminUpdateSchema.safeParse({
    id: formData.get("id"),
    priority: formData.get("priority"),
    status: formData.get("status"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.request.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        requesterId: true,
        status: true,
        priority: true,
        type: true,
      },
    });
    if (!before) throw new Error("בקשה לא נמצאה.");

    const after = await tx.request.update({
      where: { id: parsed.data.id },
      data: { priority: parsed.data.priority, status: parsed.data.status },
      select: {
        id: true,
        requesterId: true,
        status: true,
        priority: true,
        type: true,
      },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.REQUEST,
      entityId: parsed.data.id,
      action: "REQUEST_UPDATED",
      beforeJson: before,
      afterJson: after,
    });
  });

  revalidatePath("/requests");
  revalidatePath("/admin/requests");
}

const DenySchema = z.object({
  id: z.string().min(1),
});

export async function denyRequestAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = DenySchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.request.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, status: true, requesterId: true, type: true, priority: true },
    });
    if (!before) throw new Error("בקשה לא נמצאה.");
    const notDeniable: RequestStatus[] = [RequestStatus.FULFILLED, RequestStatus.CANCELLED];
    if (notDeniable.includes(before.status)) {
      throw new Error("לא ניתן לדחות בקשה במצב זה.");
    }

    // Update all pending request items to DENIED status
    await tx.requestItem.updateMany({
      where: {
        requestId: parsed.data.id,
        status: "PENDING",
      },
      data: {
        status: "DENIED",
      },
    });

    const after = await tx.request.update({
      where: { id: parsed.data.id },
      data: { 
        status: RequestStatus.DENIED,
        resolvedAt: new Date(),
        resolvedById: session.user.id,
      },
      select: { id: true, status: true, requesterId: true, type: true, priority: true },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.REQUEST,
      entityId: parsed.data.id,
      action: "REQUEST_DENIED",
      beforeJson: before,
      afterJson: after,
    });
  }, { maxWait: 10000, timeout: 15000 });

  revalidatePath("/requests");
  revalidatePath("/admin/requests");
}

const FulfillSchema = z.object({
  id: z.string().min(1),
});

function statusFromRequestType(t: RequestType): AssignmentStatus | null {
  switch (t) {
    case RequestType.MISSING:
      return AssignmentStatus.MISSING;
    case RequestType.DAMAGED:
      return AssignmentStatus.DAMAGED;
    case RequestType.STOLEN:
      return AssignmentStatus.STOLEN;
    default:
      return null;
  }
}

export async function fulfillRequestAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = FulfillSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const reqBefore = await tx.request.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        requesterId: true,
        status: true,
        priority: true,
        type: true,
        items: {
          select: {
            id: true,
            equipmentItemId: true,
            quantity: true,
            equipmentItem: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    if (!reqBefore) throw new Error("בקשה לא נמצאה.");
    if (reqBefore.status === RequestStatus.FULFILLED) throw new Error("הבקשה כבר סופקה.");
    const notFulfillable: RequestStatus[] = [RequestStatus.DENIED, RequestStatus.CANCELLED];
    if (notFulfillable.includes(reqBefore.status)) {
      throw new Error("לא ניתן לספק בקשה במצב זה.");
    }

    const now = new Date();
    const markStatus = statusFromRequestType(reqBefore.type);

    // Get storage location (Yamah)
    const yamah = await tx.storageLocation.findFirst({
      where: { name: "ימ״ח", active: true },
    });
    if (!yamah) throw new Error("מיקום אחסון לא נמצא.");

    const createdAssignmentIds: string[] = [];

    // Process each item in the request
    for (const requestItem of reqBefore.items) {
      // If this is a damage/loss/stolen report, mark existing assignments
      if (markStatus) {
        let remaining = requestItem.quantity;
        const existingAssignments = await tx.assignment.findMany({
          where: {
            userId: reqBefore.requesterId,
            equipmentItemId: requestItem.equipmentItemId,
            status: AssignmentStatus.ASSIGNED,
            active: true,
          },
          orderBy: [{ assignedAt: "asc" }],
          select: { id: true, quantity: true, status: true, active: true, userId: true, equipmentItemId: true },
        });

        const total = existingAssignments.reduce((acc, r) => acc + r.quantity, 0);
        if (total < remaining) throw new Error(`אין כמות מספקת של ${requestItem.equipmentItem.name} אצל החייל.`);

        for (const assignment of existingAssignments) {
          if (remaining <= 0) break;

          if (assignment.quantity <= remaining) {
            const before = assignment;
            const after = await tx.assignment.update({
              where: { id: assignment.id },
              data: { status: markStatus, assignedById: session.user.id },
              select: { id: true, quantity: true, status: true, active: true, userId: true, equipmentItemId: true },
            });
            await writeAuditLog(tx, {
              actorId: session.user.id,
              entity: AuditEntity.ASSIGNMENT,
              entityId: assignment.id,
              action: "ASSIGNMENT_STATUS_CHANGED",
              beforeJson: before,
              afterJson: after,
              metadataJson: { source: "request_fulfill", requestId: reqBefore.id },
            });
            remaining -= assignment.quantity;
          } else {
            // Split assignment
            const beforeReduce = assignment;
            const updatedAssignment = await tx.assignment.update({
              where: { id: assignment.id },
              data: { quantity: assignment.quantity - remaining, assignedById: session.user.id },
              select: { id: true, quantity: true, status: true, active: true, userId: true, equipmentItemId: true },
            });
            await writeAuditLog(tx, {
              actorId: session.user.id,
              entity: AuditEntity.ASSIGNMENT,
              entityId: assignment.id,
              action: "ASSIGNMENT_QUANTITY_UPDATED",
              beforeJson: beforeReduce,
              afterJson: updatedAssignment,
              metadataJson: { source: "request_fulfill_split", requestId: reqBefore.id },
            });

            const createdMarked = await tx.assignment.create({
              data: {
                userId: reqBefore.requesterId,
                equipmentItemId: requestItem.equipmentItemId,
                quantity: remaining,
                status: markStatus,
                active: true,
                assignedById: session.user.id,
                assignedAt: now,
              },
              select: { id: true, quantity: true, status: true, active: true, userId: true, equipmentItemId: true },
            });
            await writeAuditLog(tx, {
              actorId: session.user.id,
              entity: AuditEntity.ASSIGNMENT,
              entityId: createdMarked.id,
              action: "ASSIGNMENT_CREATED",
              beforeJson: null,
              afterJson: createdMarked,
              metadataJson: { source: "request_fulfill_split", requestId: reqBefore.id },
            });

            remaining = 0;
          }
        }
      }

      // Check storage inventory and deduct
      const storageInv = await tx.storageInventory.findUnique({
        where: {
          locationId_equipmentItemId: {
            locationId: yamah.id,
            equipmentItemId: requestItem.equipmentItemId,
          },
        },
        select: { quantity: true },
      });

      const availableInStorage = storageInv?.quantity ?? 0;
      if (availableInStorage < requestItem.quantity) {
        throw new Error(`אין מספיק ${requestItem.equipmentItem.name} במלאי (זמין: ${availableInStorage}, נדרש: ${requestItem.quantity}).`);
      }

      // Deduct from storage
      await tx.storageInventory.update({
        where: {
          locationId_equipmentItemId: {
            locationId: yamah.id,
            equipmentItemId: requestItem.equipmentItemId,
          },
        },
        data: {
          quantity: availableInStorage - requestItem.quantity,
        },
      });

      // Create new assignment
      const createdAssignment = await tx.assignment.create({
        data: {
          userId: reqBefore.requesterId,
          equipmentItemId: requestItem.equipmentItemId,
          quantity: requestItem.quantity,
          status: AssignmentStatus.ASSIGNED,
          active: true,
          assignedById: session.user.id,
          assignedAt: now,
        },
        select: { id: true, userId: true, equipmentItemId: true, quantity: true, status: true, active: true, assignedById: true, assignedAt: true },
      });

      createdAssignmentIds.push(createdAssignment.id);

      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.ASSIGNMENT,
        entityId: createdAssignment.id,
        action: "ASSIGNMENT_CREATED",
        beforeJson: null,
        afterJson: createdAssignment,
        metadataJson: { source: "request_fulfill", requestId: reqBefore.id, requestItemId: requestItem.id },
      });
    }

    // Update request status
    const reqAfter = await tx.request.update({
      where: { id: reqBefore.id },
      data: { status: RequestStatus.FULFILLED },
      select: {
        id: true,
        requesterId: true,
        status: true,
        priority: true,
        type: true,
      },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.REQUEST,
      entityId: reqBefore.id,
      action: "REQUEST_FULFILLED",
      beforeJson: reqBefore,
      afterJson: reqAfter,
      metadataJson: { createdAssignmentIds },
    });
  }, {
    maxWait: 10000, // 10 seconds max wait for transaction to start
    timeout: 15000, // 15 seconds max transaction duration
  });

  revalidatePath("/requests");
  revalidatePath("/admin/requests");
}
