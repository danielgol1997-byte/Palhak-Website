"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Priority, Role, RequestType } from "@prisma/client";
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

      // If the item was FULFILLED, we need to reverse what was done
      if (requestItem.status === "FULFILLED") {
        const isDeclaration = request.type === RequestType.DAMAGED || request.type === RequestType.STOLEN || request.type === RequestType.USED;
        const markStatus = statusFromRequestType(request.type);

        if (isDeclaration && markStatus) {
          // For declarations, reverse the status change (set back to ASSIGNED)
          const affectedAssignments = await tx.assignment.findMany({
            where: {
              userId: request.requesterId,
              equipmentItemId: requestItem.equipmentItemId,
              status: markStatus,
              active: true,
            },
            orderBy: [{ assignedAt: "desc" }],
            take: requestItem.quantity,
          });

          for (const assignment of affectedAssignments) {
            await tx.assignment.update({
              where: { id: assignment.id },
              data: { status: "ASSIGNED" },
            });
          }
        } else {
          // For NEW_EQUIPMENT, restore inventory and remove assignment
          const yamah = await tx.storageLocation.findFirst({
            where: { name: "ימ״ח", active: true },
          });
          if (!yamah) throw new Error("מיקום אחסון לא נמצא.");

          // Restore inventory
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
                quantity: storageInv.quantity + requestItem.quantity,
              },
            });
          } else {
            await tx.storageInventory.create({
              data: {
                locationId: yamah.id,
                equipmentItemId: requestItem.equipmentItemId,
                quantity: requestItem.quantity,
              },
            });
          }

          // Find and remove the most recent assignment that matches this request
          // We need to find assignments created by this fulfillment
          const recentAssignments = await tx.assignment.findMany({
            where: {
              userId: request.requesterId,
              equipmentItemId: requestItem.equipmentItemId,
              status: "ASSIGNED",
              active: true,
              assignedById: session.user.id,
            },
            orderBy: [{ assignedAt: "desc" }],
            take: 10, // Get recent ones to find the right one
          });

          // Try to find one that matches the quantity
          let remaining = requestItem.quantity;
          for (const assignment of recentAssignments) {
            if (remaining <= 0) break;
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
        }
      }

      // Reset the item status to PENDING
      await tx.requestItem.update({
        where: { id: parsed.data.requestItemId },
        data: { status: "PENDING" },
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
        metadataJson: { requestId: parsed.data.requestId },
      });
    } else {
      // For other actions, item must be PENDING
      if (requestItem.status !== "PENDING") {
        throw new Error("פריט זה כבר טופל.");
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
        
        // Check if this is a status declaration (DAMAGED, STOLEN, or USED)
        const markStatus = statusFromRequestType(request.type);
        const isDeclaration = request.type === RequestType.DAMAGED || request.type === RequestType.STOLEN || request.type === RequestType.USED;
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
                  assignedAt: new Date(),
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
          
          // Find and remove assignments from sender
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

          // Remove assignments from sender
          for (const assignment of senderAssignments) {
            if (remaining <= 0) break;
            if (assignment.quantity <= remaining) {
              // Delete entire assignment
              await tx.assignment.delete({
                where: { id: assignment.id },
              });
              remaining -= assignment.quantity;
            } else {
              // Reduce quantity
              await tx.assignment.update({
                where: { id: assignment.id },
                data: { quantity: assignment.quantity - remaining },
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
          const yamah = await tx.storageLocation.findFirst({
            where: { name: "ימ״ח", active: true },
          });
          if (!yamah) throw new Error("מיקום אחסון לא נמצא.");

          const storageInv = await tx.storageInventory.findUnique({
            where: {
              locationId_equipmentItemId: {
                locationId: yamah.id,
                equipmentItemId: requestItem.equipmentItemId,
              },
            },
          });

          const availableInStorage = storageInv?.quantity ?? 0;
          if (availableInStorage < quantityToFulfill) {
            throw new Error(`אין מספיק ${requestItem.equipmentItem.name} במלאי. זמין: ${availableInStorage}`);
          }

          await tx.storageInventory.update({
            where: {
              locationId_equipmentItemId: {
                locationId: yamah.id,
                equipmentItemId: requestItem.equipmentItemId,
              },
            },
            data: {
              quantity: availableInStorage - quantityToFulfill,
            },
          });

          // Check if user already has this item (for non-serialized items, combine quantities)
          if (parsed.data.serialNumber) {
            // Serialized items: always create new assignment (each serial is unique)
            await tx.assignment.create({
              data: {
                userId: request.requesterId,
                equipmentItemId: requestItem.equipmentItemId,
                quantity: quantityToFulfill,
                status: "ASSIGNED",
                active: true,
                assignedById: session.user.id,
                assignedAt: new Date(),
                serialNumber: parsed.data.serialNumber,
                clothingSize: requestItem.clothingSize,
                shoeSize: requestItem.shoeSize,
              },
            });
          } else {
            // Non-serialized items: check for existing assignment and combine
            const existingAssignment = await tx.assignment.findFirst({
              where: {
                userId: request.requesterId,
                equipmentItemId: requestItem.equipmentItemId,
                active: true,
                status: "ASSIGNED",
                serialNumber: null,
              },
            });

            if (existingAssignment) {
              // Update existing assignment by adding quantity
              await tx.assignment.update({
                where: { id: existingAssignment.id },
                data: {
                  quantity: existingAssignment.quantity + quantityToFulfill,
                },
              });
            } else {
              // Create new assignment
              await tx.assignment.create({
                data: {
                  userId: request.requesterId,
                  equipmentItemId: requestItem.equipmentItemId,
                  quantity: quantityToFulfill,
                  status: "ASSIGNED",
                  active: true,
                  assignedById: session.user.id,
                  assignedAt: new Date(),
                  serialNumber: null,
                  clothingSize: requestItem.clothingSize,
                  shoeSize: requestItem.shoeSize,
                },
              });
            }
          }
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
                resolvedAt: new Date(),
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
                resolvedAt: new Date(),
                resolvedById: session.user.id,
              },
            });
          }
      } else if (parsed.data.action === "DENY") {
        newItemStatus = "DENIED";
        // Update request item status
        await tx.requestItem.update({
          where: { id: parsed.data.requestItemId },
          data: { status: newItemStatus },
        });
      } else {
        newItemStatus = "CANCELLED";
        // Update request item status
        await tx.requestItem.update({
          where: { id: parsed.data.requestItemId },
          data: { status: newItemStatus },
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
        metadataJson: { requestId: parsed.data.requestId },
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
