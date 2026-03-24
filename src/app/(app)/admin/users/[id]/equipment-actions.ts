"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { AssignmentStatus, AuditEntity, Priority, RequestItemStatus, RequestStatus, RequestType, Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const AssignEquipmentSchema = z.object({
  userId: z.string().min(1),
  equipmentItemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1000),
  serialNumber: z.string().optional(),
  adminNotes: z.string().min(1, "הערות הן שדה חובה"),
});

export async function adminAssignEquipmentAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(Role.ADMIN);
  
  const parsed = AssignEquipmentSchema.safeParse({
    userId: formData.get("userId"),
    equipmentItemId: formData.get("equipmentItemId"),
    quantity: formData.get("quantity"),
    serialNumber: formData.get("serialNumber") || undefined,
    adminNotes: formData.get("adminNotes"),
  });
  
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { success: false, error: firstError?.message || "נתונים לא תקינים." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: parsed.data.userId },
        select: { id: true, name: true, active: true },
      });
      if (!user) throw new Error("משתמש לא נמצא.");
      if (!user.active) throw new Error("לא ניתן להקצות ציוד למשתמש לא פעיל.");

      const equipmentItem = await tx.equipmentItem.findUnique({
        where: { id: parsed.data.equipmentItemId },
        select: { id: true, name: true, active: true, isWeapon: true, isSight: true },
      });
      if (!equipmentItem || !equipmentItem.active) throw new Error("פריט ציוד לא נמצא או לא פעיל.");

      const requiresSerial = equipmentItem.isWeapon || equipmentItem.isSight;
      if (requiresSerial && !parsed.data.serialNumber) {
        throw new Error("נדרש מספר סידורי עבור נשק או צלמ.");
      }

      const yamah = await tx.storageLocation.findFirst({
        where: { name: "ימ״ח", active: true },
      });
      if (!yamah) throw new Error("מיקום אחסון לא נמצא.");

      const storageInv = await tx.storageInventory.findUnique({
        where: {
          locationId_equipmentItemId: {
            locationId: yamah.id,
            equipmentItemId: parsed.data.equipmentItemId,
          },
        },
      });

      const availableInStorage = storageInv?.quantity ?? 0;
      if (availableInStorage < parsed.data.quantity) {
        throw new Error(`אין מספיק ${equipmentItem.name} במלאי. זמין: ${availableInStorage}`);
      }

      await tx.storageInventory.update({
        where: {
          locationId_equipmentItemId: {
            locationId: yamah.id,
            equipmentItemId: parsed.data.equipmentItemId,
          },
        },
        data: {
          quantity: availableInStorage - parsed.data.quantity,
        },
      });

      let assignment;
      
      if (parsed.data.serialNumber) {
        assignment = await tx.assignment.create({
          data: {
            userId: parsed.data.userId,
            equipmentItemId: parsed.data.equipmentItemId,
            quantity: parsed.data.quantity,
            status: "ASSIGNED",
            active: true,
            assignedById: session.user.id,
            assignedAt: new Date(),
            serialNumber: parsed.data.serialNumber,
            clothingSize: null,
            shoeSize: null,
          },
        });
      } else {
        const existingAssignment = await tx.assignment.findFirst({
          where: {
            userId: parsed.data.userId,
            equipmentItemId: parsed.data.equipmentItemId,
            active: true,
            status: "ASSIGNED",
            serialNumber: null,
          },
        });

        if (existingAssignment) {
          assignment = await tx.assignment.update({
            where: { id: existingAssignment.id },
            data: {
              quantity: existingAssignment.quantity + parsed.data.quantity,
            },
          });
        } else {
          assignment = await tx.assignment.create({
            data: {
              userId: parsed.data.userId,
              equipmentItemId: parsed.data.equipmentItemId,
              quantity: parsed.data.quantity,
              status: "ASSIGNED",
              active: true,
              assignedById: session.user.id,
              assignedAt: new Date(),
              serialNumber: null,
              clothingSize: null,
              shoeSize: null,
            },
          });
        }
      }

      await tx.request.create({
        data: {
          requesterId: parsed.data.userId,
          type: RequestType.ADMIN_ASSIGNMENT,
          priority: Priority.MEDIUM,
          status: RequestStatus.FULFILLED,
          adminNotes: parsed.data.adminNotes,
          resolvedById: session.user.id,
          resolvedAt: new Date(),
          items: {
            create: {
              equipmentItemId: parsed.data.equipmentItemId,
              quantity: parsed.data.quantity,
              status: "FULFILLED",
              serialNumber: parsed.data.serialNumber || null,
            },
          },
        },
      });

      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.ASSIGNMENT,
        entityId: assignment.id,
        action: "ADMIN_DIRECT_ASSIGNMENT",
        beforeJson: null,
        afterJson: assignment,
        metadataJson: {
          equipmentItemName: equipmentItem.name,
          userName: user.name,
          adminNotes: parsed.data.adminNotes,
        },
      });
    }, {
      maxWait: 10000,
      timeout: 15000,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "אירעה שגיאה בלתי צפויה.";
    return { success: false, error: message };
  }

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/requests");
  revalidatePath("/admin/storage");
  return { success: true };
}


const UnassignEquipmentSchema = z.object({
  userId: z.string().min(1),
  assignmentId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1000),
  adminNotes: z.string().min(1, "הערות הן שדה חובה"),
});

export async function adminUnassignEquipmentAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(Role.ADMIN);
  
  const parsed = UnassignEquipmentSchema.safeParse({
    userId: formData.get("userId"),
    assignmentId: formData.get("assignmentId"),
    quantity: formData.get("quantity"),
    adminNotes: formData.get("adminNotes"),
  });
  
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { success: false, error: firstError?.message || "נתונים לא תקינים." };
  }

  try {
    await prisma.$transaction(async (tx) => {
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
      if (assignment.userId !== parsed.data.userId) throw new Error("הקצאה לא שייכת למשתמש זה.");
      if (parsed.data.quantity > assignment.quantity) throw new Error("לא ניתן לבטל יותר מהכמות המוקצית.");

      const yamah = await tx.storageLocation.findFirst({
        where: { name: "ימ״ח", active: true },
      });
      if (!yamah) throw new Error("מיקום אחסון לא נמצא.");

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
            quantity: storageInv.quantity + parsed.data.quantity,
          },
        });
      } else {
        await tx.storageInventory.create({
          data: {
            locationId: yamah.id,
            equipmentItemId: assignment.equipmentItemId,
            quantity: parsed.data.quantity,
          },
        });
      }

      if (parsed.data.quantity < assignment.quantity) {
        await tx.assignment.update({
          where: { id: assignment.id },
          data: {
            quantity: assignment.quantity - parsed.data.quantity,
          },
        });
      } else {
        await tx.assignment.delete({
          where: { id: assignment.id },
        });
      }

      await tx.request.create({
        data: {
          requesterId: parsed.data.userId,
          type: RequestType.ADMIN_ASSIGNMENT,
          priority: Priority.MEDIUM,
          status: RequestStatus.FULFILLED,
          adminNotes: parsed.data.adminNotes,
          resolvedById: session.user.id,
          resolvedAt: new Date(),
          items: {
            create: {
              equipmentItemId: assignment.equipmentItemId,
              quantity: -parsed.data.quantity,
              status: "FULFILLED",
              serialNumber: assignment.serialNumber,
            },
          },
        },
      });

      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.ASSIGNMENT,
        entityId: assignment.id,
        action: "ADMIN_DIRECT_UNASSIGNMENT",
        beforeJson: { quantity: assignment.quantity },
        afterJson: parsed.data.quantity < assignment.quantity 
          ? { quantity: assignment.quantity - parsed.data.quantity }
          : null,
        metadataJson: {
          equipmentItemName: assignment.equipmentItem.name,
          userName: assignment.user.name,
          quantityUnassigned: parsed.data.quantity,
          adminNotes: parsed.data.adminNotes,
        },
      });
    }, {
      maxWait: 10000,
      timeout: 15000,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "אירעה שגיאה בלתי צפויה.";
    return { success: false, error: message };
  }

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/requests");
  revalidatePath("/admin/storage");
  return { success: true };
}

const MoveToBoxSchema = z.object({
  userId: z.string().min(1),
  assignmentId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1000),
});

export async function moveToBoxAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(Role.ADMIN);
  const parsed = MoveToBoxSchema.safeParse({
    userId: formData.get("userId"),
    assignmentId: formData.get("assignmentId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) return { success: false, error: "נתונים לא תקינים." };

  try {
    await prisma.$transaction(async (tx) => {
      const assignment = await tx.assignment.findUnique({
        where: { id: parsed.data.assignmentId },
        include: {
          equipmentItem: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
      });
      if (!assignment) throw new Error("הקצאה לא נמצאה.");
      if (assignment.userId !== parsed.data.userId) throw new Error("הקצאה לא שייכת למשתמש זה.");
      if (parsed.data.quantity > assignment.quantity) throw new Error("לא ניתן להעביר יותר מהכמות המוקצית.");

      const tpl = await tx.boxTemplate.findFirst({
        include: { items: { include: { alternatives: true } } },
      });
      if (!tpl) throw new Error("תבנית קרטון לא הוגדרה.");

      const templateItem = tpl.items.find((i) => {
        if (i.equipmentItemId === assignment.equipmentItemId) return true;
        return i.alternatives.some((a) => a.equipmentItemId === assignment.equipmentItemId);
      });
      if (!templateItem) throw new Error("פריט זה לא מוגדר בתבנית הקרטון.");

      const allGroupItemIds = [
        templateItem.equipmentItemId,
        ...templateItem.alternatives.map((a) => a.equipmentItemId),
      ];

      let box = await tx.box.findUnique({ where: { userId: parsed.data.userId } });
      if (!box) box = await tx.box.create({ data: { userId: parsed.data.userId } });

      const groupBoxItems = await tx.boxItem.findMany({
        where: { boxId: box.id, equipmentItemId: { in: allGroupItemIds } },
      });
      const totalInBox = groupBoxItems.reduce((s, bi) => s + bi.quantity, 0);
      const remainingCapacity = templateItem.quantity - totalInBox;
      if (parsed.data.quantity > remainingCapacity) {
        throw new Error(remainingCapacity <= 0 ? "הקרטון מלא עבור פריט זה." : `הקרטון יכול להכיל עוד ${remainingCapacity} יחידות מפריט זה.`);
      }

      if (parsed.data.quantity < assignment.quantity) {
        await tx.assignment.update({ where: { id: assignment.id }, data: { quantity: assignment.quantity - parsed.data.quantity } });
      } else {
        await tx.assignment.delete({ where: { id: assignment.id } });
      }

      const existingBoxItem = assignment.serialNumber
        ? null
        : await tx.boxItem.findFirst({ where: { boxId: box.id, equipmentItemId: assignment.equipmentItemId, serialNumber: null } });

      if (assignment.serialNumber) {
        await tx.boxItem.create({ data: { boxId: box.id, equipmentItemId: assignment.equipmentItemId, quantity: parsed.data.quantity, serialNumber: assignment.serialNumber, movedById: session.user.id } });
      } else if (existingBoxItem) {
        await tx.boxItem.update({ where: { id: existingBoxItem.id }, data: { quantity: existingBoxItem.quantity + parsed.data.quantity } });
      } else {
        await tx.boxItem.create({ data: { boxId: box.id, equipmentItemId: assignment.equipmentItemId, quantity: parsed.data.quantity, serialNumber: null, movedById: session.user.id } });
      }

      await writeAuditLog(tx, {
        actorId: session.user.id, entity: AuditEntity.BOX, entityId: box.id, action: "MOVE_TO_BOX",
        metadataJson: { equipmentItemId: assignment.equipmentItemId, equipmentItemName: assignment.equipmentItem.name, userName: assignment.user.name, quantity: parsed.data.quantity, serialNumber: assignment.serialNumber },
      });
    }, { maxWait: 10000, timeout: 15000 });
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "אירעה שגיאה בלתי צפויה." };
  }

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath("/admin/boxes");
  revalidatePath("/admin/storage");
  return { success: true };
}

const TransferAssignmentSchema = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  assignmentId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1000),
  adminNotes: z.string().min(1, "הערות הן שדה חובה"),
});

export async function adminTransferAssignmentAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(Role.ADMIN);

  const parsed = TransferAssignmentSchema.safeParse({
    fromUserId: formData.get("fromUserId"),
    toUserId: formData.get("toUserId"),
    assignmentId: formData.get("assignmentId"),
    quantity: formData.get("quantity"),
    adminNotes: formData.get("adminNotes"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, error: first?.message || "נתונים לא תקינים." };
  }

  if (parsed.data.fromUserId === parsed.data.toUserId) {
    return { success: false, error: "לא ניתן להעביר ציוד לאותו משתמש." };
  }

  const auditAssignmentId = parsed.data.assignmentId;

  try {
    await prisma.$transaction(
      async (tx) => {
        const assignment = await tx.assignment.findUnique({
          where: { id: parsed.data.assignmentId },
          include: {
            equipmentItem: { select: { id: true, name: true, isWeapon: true, isSight: true } },
            user: { select: { id: true, name: true } },
          },
        });

        if (!assignment) throw new Error("הקצאה לא נמצאה.");
        if (assignment.userId !== parsed.data.fromUserId) throw new Error("הקצאה לא שייכת למשתמש המקור.");
        if (!assignment.active || assignment.status !== AssignmentStatus.ASSIGNED) {
          throw new Error("הקצאה לא פעילה להעברה.");
        }
        if (parsed.data.quantity > assignment.quantity) {
          throw new Error("לא ניתן להעביר יותר מהכמות המוקצית.");
        }

        if (assignment.serialNumber && parsed.data.quantity !== assignment.quantity) {
          throw new Error("בפריט עם מספר סידורי יש להעביר את כל הכמות.");
        }

        const toUser = await tx.user.findUnique({
          where: { id: parsed.data.toUserId },
          select: { id: true, name: true, active: true },
        });
        if (!toUser?.active) throw new Error("משתמש היעד לא נמצא או לא פעיל.");

        const fromUser = await tx.user.findUnique({
          where: { id: parsed.data.fromUserId },
          select: { name: true },
        });
        if (!fromUser) throw new Error("משתמש המקור לא נמצא.");

        if (assignment.serialNumber) {
          const dup = await tx.assignment.findFirst({
            where: {
              userId: parsed.data.toUserId,
              equipmentItemId: assignment.equipmentItemId,
              serialNumber: assignment.serialNumber,
              active: true,
              status: AssignmentStatus.ASSIGNED,
            },
          });
          if (dup) throw new Error("לנמען כבר רשומת שיוך עם אותו מספר סידורי לפריט זה.");
        }

        const now = new Date();
        const q = parsed.data.quantity;
        const adminNoteFull = parsed.data.adminNotes.trim();

        if (assignment.serialNumber) {
          await tx.assignment.update({
            where: { id: assignment.id },
            data: {
              userId: parsed.data.toUserId,
              assignedById: session.user.id,
              assignedAt: now,
            },
          });
        } else {
          const existingOnTarget = await tx.assignment.findFirst({
            where: {
              userId: parsed.data.toUserId,
              equipmentItemId: assignment.equipmentItemId,
              active: true,
              status: AssignmentStatus.ASSIGNED,
              serialNumber: null,
            },
          });

          if (q < assignment.quantity) {
            await tx.assignment.update({
              where: { id: assignment.id },
              data: { quantity: assignment.quantity - q },
            });
            if (existingOnTarget) {
              await tx.assignment.update({
                where: { id: existingOnTarget.id },
                data: { quantity: existingOnTarget.quantity + q },
              });
            } else {
              await tx.assignment.create({
                data: {
                  userId: parsed.data.toUserId,
                  equipmentItemId: assignment.equipmentItemId,
                  quantity: q,
                  status: AssignmentStatus.ASSIGNED,
                  active: true,
                  assignedById: session.user.id,
                  assignedAt: now,
                  serialNumber: null,
                  clothingSize: assignment.clothingSize,
                  shoeSize: assignment.shoeSize,
                },
              });
            }
          } else if (existingOnTarget && existingOnTarget.id !== assignment.id) {
            await tx.assignment.update({
              where: { id: existingOnTarget.id },
              data: { quantity: existingOnTarget.quantity + q },
            });
            await tx.assignment.delete({ where: { id: assignment.id } });
          } else {
            await tx.assignment.update({
              where: { id: assignment.id },
              data: {
                userId: parsed.data.toUserId,
                assignedById: session.user.id,
                assignedAt: now,
              },
            });
          }
        }

        await tx.request.create({
          data: {
            requesterId: parsed.data.toUserId,
            recipientId: parsed.data.fromUserId,
            type: RequestType.ADMIN_EQUIPMENT_TRANSFER,
            priority: Priority.MEDIUM,
            status: RequestStatus.FULFILLED,
            adminNotes: `העברה מ${fromUser.name} אל ${toUser.name}. ${adminNoteFull}`,
            resolvedById: session.user.id,
            resolvedAt: now,
            items: {
              create: {
                equipmentItemId: assignment.equipmentItemId,
                quantity: q,
                status: "FULFILLED",
                serialNumber: assignment.serialNumber,
                clothingSize: assignment.clothingSize,
                shoeSize: assignment.shoeSize,
              },
            },
          },
        });

        await writeAuditLog(tx, {
          actorId: session.user.id,
          entity: AuditEntity.ASSIGNMENT,
          entityId: auditAssignmentId,
          action: "ADMIN_TRANSFER_ASSIGNMENT",
          beforeJson: { userId: assignment.userId, quantity: assignment.quantity },
          metadataJson: {
            fromUserId: parsed.data.fromUserId,
            fromUserName: fromUser.name,
            toUserId: parsed.data.toUserId,
            toUserName: toUser.name,
            equipmentItemName: assignment.equipmentItem.name,
            quantity: q,
            adminNotes: adminNoteFull,
          },
        });
      },
      { maxWait: 10000, timeout: 15000 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "אירעה שגיאה בלתי צפויה.";
    return { success: false, error: message };
  }

  revalidatePath(`/admin/users/${parsed.data.fromUserId}`);
  revalidatePath(`/admin/users/${parsed.data.toUserId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/requests");
  return { success: true };
}

const RestoreFromBoxSchema = z.object({
  userId: z.string().min(1),
  boxItemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1000),
});

export async function restoreFromBoxAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(Role.ADMIN);
  const parsed = RestoreFromBoxSchema.safeParse({
    userId: formData.get("userId"),
    boxItemId: formData.get("boxItemId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) return { success: false, error: "נתונים לא תקינים." };

  try {
    await prisma.$transaction(async (tx) => {
      const boxItem = await tx.boxItem.findUnique({
        where: { id: parsed.data.boxItemId },
        include: { box: { select: { id: true, userId: true } }, equipmentItem: { select: { id: true, name: true } } },
      });
      if (!boxItem) throw new Error("פריט קרטון לא נמצא.");
      if (boxItem.box.userId !== parsed.data.userId) throw new Error("פריט זה לא שייך למשתמש זה.");
      if (parsed.data.quantity > boxItem.quantity) throw new Error("לא ניתן לשחזר יותר מהכמות בקרטון.");

      if (parsed.data.quantity < boxItem.quantity) {
        await tx.boxItem.update({ where: { id: boxItem.id }, data: { quantity: boxItem.quantity - parsed.data.quantity } });
      } else {
        await tx.boxItem.delete({ where: { id: boxItem.id } });
      }

      if (boxItem.serialNumber) {
        await tx.assignment.create({ data: { userId: parsed.data.userId, equipmentItemId: boxItem.equipmentItemId, quantity: parsed.data.quantity, status: "ASSIGNED", active: true, assignedById: session.user.id, assignedAt: new Date(), serialNumber: boxItem.serialNumber } });
      } else {
        const existing = await tx.assignment.findFirst({ where: { userId: parsed.data.userId, equipmentItemId: boxItem.equipmentItemId, active: true, status: "ASSIGNED", serialNumber: null } });
        if (existing) {
          await tx.assignment.update({ where: { id: existing.id }, data: { quantity: existing.quantity + parsed.data.quantity } });
        } else {
          await tx.assignment.create({ data: { userId: parsed.data.userId, equipmentItemId: boxItem.equipmentItemId, quantity: parsed.data.quantity, status: "ASSIGNED", active: true, assignedById: session.user.id, assignedAt: new Date() } });
        }
      }

      const user = await tx.user.findUnique({ where: { id: parsed.data.userId }, select: { name: true } });
      await writeAuditLog(tx, {
        actorId: session.user.id, entity: AuditEntity.BOX, entityId: boxItem.box.id, action: "RESTORE_FROM_BOX",
        metadataJson: { equipmentItemId: boxItem.equipmentItemId, equipmentItemName: boxItem.equipmentItem.name, userName: user?.name, quantity: parsed.data.quantity, serialNumber: boxItem.serialNumber },
      });
    }, { maxWait: 10000, timeout: 15000 });
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "אירעה שגיאה בלתי צפויה." };
  }

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath("/admin/boxes");
  revalidatePath("/admin/storage");
  return { success: true };
}


// ─────────────────────────────────────────────────────────────────────────────
// Remove a box item and return it to ימ״ח storage
// ─────────────────────────────────────────────────────────────────────────────
const RemoveFromBoxSchema = z.object({
  userId: z.string().min(1),
  boxItemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1000),
});

export async function removeFromBoxAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(Role.ADMIN);

  const parsed = RemoveFromBoxSchema.safeParse({
    userId: formData.get("userId"),
    boxItemId: formData.get("boxItemId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) return { success: false, error: "נתונים לא תקינים." };

  try {
    await prisma.$transaction(async (tx) => {
      const boxItem = await tx.boxItem.findUnique({
        where: { id: parsed.data.boxItemId },
        include: {
          box: { select: { id: true, userId: true } },
          equipmentItem: { select: { id: true, name: true } },
        },
      });
      if (!boxItem) throw new Error("פריט קרטון לא נמצא.");
      if (boxItem.box.userId !== parsed.data.userId) throw new Error("פריט זה לא שייך למשתמש זה.");
      if (parsed.data.quantity > boxItem.quantity) throw new Error("לא ניתן להסיר יותר מהכמות בקרטון.");

      const yamah = await tx.storageLocation.findFirst({ where: { name: "ימ״ח", active: true } });
      if (!yamah) throw new Error("מיקום אחסון ימ״ח לא נמצא.");

      if (parsed.data.quantity < boxItem.quantity) {
        await tx.boxItem.update({ where: { id: boxItem.id }, data: { quantity: boxItem.quantity - parsed.data.quantity } });
      } else {
        await tx.boxItem.delete({ where: { id: boxItem.id } });
      }

      const existingStorage = await tx.storageInventory.findUnique({
        where: { locationId_equipmentItemId: { locationId: yamah.id, equipmentItemId: boxItem.equipmentItemId } },
      });
      if (existingStorage) {
        await tx.storageInventory.update({
          where: { locationId_equipmentItemId: { locationId: yamah.id, equipmentItemId: boxItem.equipmentItemId } },
          data: { quantity: existingStorage.quantity + parsed.data.quantity },
        });
      } else {
        await tx.storageInventory.create({
          data: { locationId: yamah.id, equipmentItemId: boxItem.equipmentItemId, quantity: parsed.data.quantity },
        });
      }

      const user = await tx.user.findUnique({ where: { id: parsed.data.userId }, select: { name: true } });
      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.BOX,
        entityId: boxItem.box.id,
        action: "REMOVE_FROM_BOX_TO_STORAGE",
        metadataJson: {
          equipmentItemId: boxItem.equipmentItemId,
          equipmentItemName: boxItem.equipmentItem.name,
          userName: user?.name,
          quantity: parsed.data.quantity,
          serialNumber: boxItem.serialNumber,
        },
      });
    }, { maxWait: 10000, timeout: 15000 });
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "אירעה שגיאה בלתי צפויה." };
  }

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath("/admin/boxes");
  revalidatePath("/admin/storage");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Transfer a box item to another user's box
// ─────────────────────────────────────────────────────────────────────────────
const TransferBoxItemSchema = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  boxItemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1000),
});

export async function transferBoxItemAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(Role.ADMIN);

  const parsed = TransferBoxItemSchema.safeParse({
    fromUserId: formData.get("fromUserId"),
    toUserId: formData.get("toUserId"),
    boxItemId: formData.get("boxItemId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) return { success: false, error: "נתונים לא תקינים." };
  if (parsed.data.fromUserId === parsed.data.toUserId) {
    return { success: false, error: "לא ניתן להעביר לאותו משתמש." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const boxItem = await tx.boxItem.findUnique({
        where: { id: parsed.data.boxItemId },
        include: {
          box: { select: { id: true, userId: true } },
          equipmentItem: { select: { id: true, name: true } },
        },
      });
      if (!boxItem) throw new Error("פריט קרטון לא נמצא.");
      if (boxItem.box.userId !== parsed.data.fromUserId) throw new Error("פריט זה לא שייך למשתמש המקור.");
      if (parsed.data.quantity > boxItem.quantity) throw new Error("לא ניתן להעביר יותר מהכמות בקרטון.");

      const toUser = await tx.user.findUnique({ where: { id: parsed.data.toUserId }, select: { id: true, name: true, active: true } });
      if (!toUser?.active) throw new Error("משתמש היעד לא נמצא או לא פעיל.");

      const tpl = await tx.boxTemplate.findFirst({ include: { items: { include: { alternatives: true } } } });
      if (!tpl) throw new Error("תבנית קרטון לא הוגדרה.");

      const templateItem = tpl.items.find((i) => {
        if (i.equipmentItemId === boxItem.equipmentItemId) return true;
        return i.alternatives.some((a) => a.equipmentItemId === boxItem.equipmentItemId);
      });
      if (!templateItem) throw new Error("פריט זה לא מוגדר בתבנית הקרטון.");

      const groupIds = [templateItem.equipmentItemId, ...templateItem.alternatives.map((a) => a.equipmentItemId)];

      let targetBox = await tx.box.findUnique({ where: { userId: parsed.data.toUserId } });
      if (!targetBox) targetBox = await tx.box.create({ data: { userId: parsed.data.toUserId } });

      const targetGroupItems = await tx.boxItem.findMany({
        where: { boxId: targetBox.id, equipmentItemId: { in: groupIds } },
      });
      const totalInTargetBox = targetGroupItems.reduce((s, bi) => s + bi.quantity, 0);
      const remainingCapacity = templateItem.quantity - totalInTargetBox;
      if (parsed.data.quantity > remainingCapacity) {
        throw new Error(
          remainingCapacity <= 0
            ? "הקרטון של משתמש היעד מלא עבור פריט זה."
            : `הקרטון של משתמש היעד יכול להכיל עוד ${remainingCapacity} יחידות בלבד.`,
        );
      }

      if (parsed.data.quantity < boxItem.quantity) {
        await tx.boxItem.update({ where: { id: boxItem.id }, data: { quantity: boxItem.quantity - parsed.data.quantity } });
      } else {
        await tx.boxItem.delete({ where: { id: boxItem.id } });
      }

      const existingTarget = boxItem.serialNumber
        ? null
        : await tx.boxItem.findFirst({
            where: { boxId: targetBox.id, equipmentItemId: boxItem.equipmentItemId, serialNumber: null },
          });

      if (boxItem.serialNumber) {
        await tx.boxItem.create({
          data: { boxId: targetBox.id, equipmentItemId: boxItem.equipmentItemId, quantity: parsed.data.quantity, serialNumber: boxItem.serialNumber, movedById: session.user.id },
        });
      } else if (existingTarget) {
        await tx.boxItem.update({ where: { id: existingTarget.id }, data: { quantity: existingTarget.quantity + parsed.data.quantity } });
      } else {
        await tx.boxItem.create({
          data: { boxId: targetBox.id, equipmentItemId: boxItem.equipmentItemId, quantity: parsed.data.quantity, serialNumber: null, movedById: session.user.id },
        });
      }

      const fromUser = await tx.user.findUnique({ where: { id: parsed.data.fromUserId }, select: { name: true } });
      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.BOX,
        entityId: boxItem.box.id,
        action: "TRANSFER_BOX_ITEM",
        metadataJson: {
          equipmentItemId: boxItem.equipmentItemId,
          equipmentItemName: boxItem.equipmentItem.name,
          fromUserId: parsed.data.fromUserId,
          fromUserName: fromUser?.name,
          toUserId: parsed.data.toUserId,
          toUserName: toUser.name,
          quantity: parsed.data.quantity,
          serialNumber: boxItem.serialNumber,
        },
      });
    }, { maxWait: 10000, timeout: 15000 });
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "אירעה שגיאה בלתי צפויה." };
  }

  revalidatePath(`/admin/users/${parsed.data.fromUserId}`);
  revalidatePath(`/admin/users/${parsed.data.toUserId}`);
  revalidatePath("/admin/boxes");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Add an item directly to a user's box, deducting from ימ״ח storage
// ─────────────────────────────────────────────────────────────────────────────
const AddToBoxDirectSchema = z.object({
  userId: z.string().min(1),
  equipmentItemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1000),
  serialNumber: z.string().optional(),
  adminNotes: z.string().min(1, "הערות הן שדה חובה"),
});

export async function addToBoxDirectAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(Role.ADMIN);

  const parsed = AddToBoxDirectSchema.safeParse({
    userId: formData.get("userId"),
    equipmentItemId: formData.get("equipmentItemId"),
    quantity: formData.get("quantity"),
    serialNumber: formData.get("serialNumber") || undefined,
    adminNotes: formData.get("adminNotes"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, error: first?.message || "נתונים לא תקינים." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: parsed.data.userId }, select: { name: true, active: true } });
      if (!user?.active) throw new Error("משתמש לא נמצא או לא פעיל.");

      const equipmentItem = await tx.equipmentItem.findUnique({
        where: { id: parsed.data.equipmentItemId },
        select: { id: true, name: true },
      });
      if (!equipmentItem) throw new Error("פריט ציוד לא נמצא.");

      // Validate item fits in the box template
      const tpl = await tx.boxTemplate.findFirst({ include: { items: { include: { alternatives: true } } } });
      if (!tpl) throw new Error("תבנית קרטון לא הוגדרה.");

      const templateItem = tpl.items.find((i) => {
        if (i.equipmentItemId === parsed.data.equipmentItemId) return true;
        return i.alternatives.some((a) => a.equipmentItemId === parsed.data.equipmentItemId);
      });
      if (!templateItem) throw new Error("פריט זה לא מוגדר בתבנית הקרטון ולא ניתן להוסיפו.");

      const groupIds = [templateItem.equipmentItemId, ...templateItem.alternatives.map((a) => a.equipmentItemId)];

      // Get or create box
      let box = await tx.box.findUnique({ where: { userId: parsed.data.userId } });
      if (!box) box = await tx.box.create({ data: { userId: parsed.data.userId } });

      // Check box capacity for this item group
      const currentBoxItems = await tx.boxItem.findMany({
        where: { boxId: box.id, equipmentItemId: { in: groupIds } },
      });
      const currentQty = currentBoxItems.reduce((s, i) => s + i.quantity, 0);
      const remaining = templateItem.quantity - currentQty;
      if (parsed.data.quantity > remaining) {
        throw new Error(
          remaining <= 0
            ? "הקרטון מלא עבור פריט זה."
            : `ניתן להוסיף עוד ${remaining} יחידות בלבד לקרטון עבור פריט זה.`,
        );
      }

      // Validate serial number uniqueness if provided
      if (parsed.data.serialNumber) {
        const dup = await tx.boxItem.findFirst({
          where: { boxId: box.id, equipmentItemId: parsed.data.equipmentItemId, serialNumber: parsed.data.serialNumber },
        });
        if (dup) throw new Error("מספר סידורי זה כבר קיים בקרטון.");
        if (parsed.data.quantity !== 1) throw new Error("בפריט עם מספר סידורי יש לבחור כמות 1.");
      }

      // Check ימ״ח stock
      const yamah = await tx.storageLocation.findFirst({ where: { name: "ימ״ח", active: true } });
      if (!yamah) throw new Error("מיקום אחסון ימ״ח לא נמצא.");

      const stockRow = await tx.storageInventory.findUnique({
        where: { locationId_equipmentItemId: { locationId: yamah.id, equipmentItemId: parsed.data.equipmentItemId } },
      });
      const currentStock = stockRow?.quantity ?? 0;
      if (currentStock < parsed.data.quantity) {
        throw new Error(`אין מספיק מלאי בימ״ח. זמין: ${currentStock}.`);
      }

      // Deduct from ימ״ח
      await tx.storageInventory.update({
        where: { locationId_equipmentItemId: { locationId: yamah.id, equipmentItemId: parsed.data.equipmentItemId } },
        data: { quantity: currentStock - parsed.data.quantity },
      });

      // Add to box
      if (parsed.data.serialNumber) {
        await tx.boxItem.create({
          data: {
            boxId: box.id,
            equipmentItemId: parsed.data.equipmentItemId,
            quantity: 1,
            serialNumber: parsed.data.serialNumber,
            movedById: session.user.id,
          },
        });
      } else {
        const existingBoxItem = await tx.boxItem.findFirst({
          where: { boxId: box.id, equipmentItemId: parsed.data.equipmentItemId, serialNumber: null },
        });
        if (existingBoxItem) {
          await tx.boxItem.update({
            where: { id: existingBoxItem.id },
            data: { quantity: existingBoxItem.quantity + parsed.data.quantity },
          });
        } else {
          await tx.boxItem.create({
            data: {
              boxId: box.id,
              equipmentItemId: parsed.data.equipmentItemId,
              quantity: parsed.data.quantity,
              serialNumber: null,
              movedById: session.user.id,
            },
          });
        }
      }

      // Create an ADMIN_ASSIGNMENT request record so it appears in the ניהול שרירותי tab
      const requestRecord = await tx.request.create({
        data: {
          type: RequestType.ADMIN_ASSIGNMENT,
          status: RequestStatus.FULFILLED,
          priority: Priority.MEDIUM,
          requesterId: parsed.data.userId,
          resolvedById: session.user.id,
          resolvedAt: new Date(),
          adminNotes: `[הוספה ישירות לקרטון] ${parsed.data.adminNotes.trim()}`,
        },
      });

      await tx.requestItem.create({
        data: {
          requestId: requestRecord.id,
          equipmentItemId: parsed.data.equipmentItemId,
          quantity: parsed.data.quantity,
          serialNumber: parsed.data.serialNumber ?? null,
          status: RequestItemStatus.FULFILLED,
          resolvedById: session.user.id,
          resolvedAt: new Date(),
        },
      });

      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.BOX,
        entityId: box.id,
        action: "ADD_TO_BOX_DIRECT",
        metadataJson: {
          equipmentItemId: parsed.data.equipmentItemId,
          equipmentItemName: equipmentItem.name,
          userName: user.name,
          quantity: parsed.data.quantity,
          serialNumber: parsed.data.serialNumber,
        },
      });
    }, { maxWait: 10000, timeout: 15000 });
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "אירעה שגיאה בלתי צפויה." };
  }

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath("/admin/boxes");
  revalidatePath("/admin/storage");
  revalidatePath("/admin/requests");
  return { success: true };
}
