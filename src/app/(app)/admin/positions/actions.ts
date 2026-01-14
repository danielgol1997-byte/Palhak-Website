"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role, AuditEntity } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const CreateSchema = z.object({
  departmentId: z.string().min(1),
  name: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
});

export async function createPositionAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = CreateSchema.safeParse({
    departmentId: formData.get("departmentId"),
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const created = await tx.position.create({
      data: {
        departmentId: parsed.data.departmentId,
        name: parsed.data.name,
        sortOrder: parsed.data.sortOrder,
        active: true,
      },
      select: { id: true, departmentId: true, name: true, active: true, sortOrder: true },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.POSITION,
      entityId: created.id,
      action: "POSITION_CREATED",
      beforeJson: null,
      afterJson: created,
    });
  });

  revalidatePath("/admin/positions");
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  departmentId: z.string().min(1),
  name: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().min(0).max(100000),
  active: z.string().transform((v) => v === "true").or(z.boolean()),
});

export async function updatePositionAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = UpdateSchema.safeParse({
    id: formData.get("id"),
    departmentId: formData.get("departmentId"),
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder"),
    active: formData.get("active"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.position.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, departmentId: true, name: true, active: true, sortOrder: true },
    });
    if (!before) throw new Error("תפקיד לא נמצא.");

    const updated = await tx.position.update({
      where: { id: parsed.data.id },
      data: {
        departmentId: parsed.data.departmentId,
        name: parsed.data.name,
        sortOrder: parsed.data.sortOrder,
        active: parsed.data.active,
      },
      select: { id: true, departmentId: true, name: true, active: true, sortOrder: true },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.POSITION,
      entityId: parsed.data.id,
      action: "POSITION_UPDATED",
      beforeJson: before,
      afterJson: updated,
    });
  });

  revalidatePath("/admin/positions");
}


