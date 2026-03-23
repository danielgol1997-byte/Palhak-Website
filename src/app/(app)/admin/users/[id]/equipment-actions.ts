"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { AuditEntity, Priority, RequestStatus, RequestType, Role } from "@prisma/client";
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

