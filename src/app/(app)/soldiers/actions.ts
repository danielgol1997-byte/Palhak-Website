"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { AssignmentStatus, AuditEntity, Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";

const AddSchema = z.object({
  userId: z.string().min(1),
  equipmentItemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1000),
  status: z.nativeEnum(AssignmentStatus),
});

export async function adminAddAssignmentAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = AddSchema.safeParse({
    userId: formData.get("userId"),
    equipmentItemId: formData.get("equipmentItemId"),
    quantity: formData.get("quantity"),
    status: formData.get("status"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const [user, item] = await Promise.all([
      tx.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } }),
      tx.equipmentItem.findUnique({ where: { id: parsed.data.equipmentItemId }, select: { id: true, active: true } }),
    ]);
    if (!user) throw new Error("חייל לא נמצא.");
    if (!item?.active) throw new Error("פריט לא תקין.");

    const created = await tx.assignment.create({
      data: {
        userId: parsed.data.userId,
        equipmentItemId: parsed.data.equipmentItemId,
        quantity: parsed.data.quantity,
        status: parsed.data.status,
        active: true,
        assignedById: session.user.id,
        assignedAt: new Date(),
      },
      select: { id: true, userId: true, equipmentItemId: true, quantity: true, status: true, active: true },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.ASSIGNMENT,
      entityId: created.id,
      action: "ASSIGNMENT_CREATED_ADMIN",
      beforeJson: null,
      afterJson: created,
    });
  });

  revalidatePath(`/soldiers/${parsed.data.userId}`);
  revalidatePath("/soldiers");
}

const UpdateSchema = z.object({
  assignmentId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1000),
  status: z.nativeEnum(AssignmentStatus),
  active: z.string().transform((v) => v === "true").or(z.boolean()),
});

export async function adminUpdateAssignmentAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = UpdateSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    quantity: formData.get("quantity"),
    status: formData.get("status"),
    active: formData.get("active"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  let userIdForRevalidate: string | null = null;

  await prisma.$transaction(async (tx) => {
    const before = await tx.assignment.findUnique({
      where: { id: parsed.data.assignmentId },
      select: { id: true, userId: true, equipmentItemId: true, quantity: true, status: true, active: true },
    });
    if (!before) throw new Error("שיוך לא נמצא.");
    userIdForRevalidate = before.userId;

    const after = await tx.assignment.update({
      where: { id: parsed.data.assignmentId },
      data: {
        quantity: parsed.data.quantity,
        status: parsed.data.status,
        active: parsed.data.active,
        assignedById: session.user.id,
      },
      select: { id: true, userId: true, equipmentItemId: true, quantity: true, status: true, active: true },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.ASSIGNMENT,
      entityId: parsed.data.assignmentId,
      action: "ASSIGNMENT_UPDATED_ADMIN",
      beforeJson: before,
      afterJson: after,
    });
  });

  if (userIdForRevalidate) {
    revalidatePath(`/soldiers/${userIdForRevalidate}`);
    revalidatePath("/soldiers");
  }
}

const RemoveSchema = z.object({
  assignmentId: z.string().min(1),
});

export async function adminRemoveAssignmentAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = RemoveSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  let userIdForRevalidate: string | null = null;

  await prisma.$transaction(async (tx) => {
    const before = await tx.assignment.findUnique({
      where: { id: parsed.data.assignmentId },
      select: { id: true, userId: true, equipmentItemId: true, quantity: true, status: true, active: true },
    });
    if (!before) throw new Error("שיוך לא נמצא.");
    userIdForRevalidate = before.userId;

    const after = await tx.assignment.update({
      where: { id: parsed.data.assignmentId },
      data: { active: false, assignedById: session.user.id },
      select: { id: true, active: true, userId: true, equipmentItemId: true, quantity: true, status: true },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.ASSIGNMENT,
      entityId: parsed.data.assignmentId,
      action: "ASSIGNMENT_DEACTIVATED_ADMIN",
      beforeJson: before,
      afterJson: after,
    });
  });

  if (userIdForRevalidate) {
    revalidatePath(`/soldiers/${userIdForRevalidate}`);
    revalidatePath("/soldiers");
  }
}


