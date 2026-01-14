"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role, AuditEntity, Division } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const CreateSchema = z.object({
  name: z.string().trim().min(1),
  divisions: z.array(z.nativeEnum(Division)).default([]),
});

export async function createDepartmentAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);

  const parsed = CreateSchema.safeParse({
    name: formData.get("name"),
    divisions: formData.getAll("divisions"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    // Get max sort order to put new department at the end
    const last = await tx.department.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = (last?.sortOrder ?? -1) + 1;

    const created = await tx.department.create({
      data: {
        name: parsed.data.name,
        sortOrder: sortOrder,
        active: true,
      },
      select: { id: true, name: true, active: true, sortOrder: true },
    });

    if (parsed.data.divisions.length) {
      await tx.departmentDivision.createMany({
        data: parsed.data.divisions.map((division) => ({
          departmentId: created.id,
          division,
        })),
        skipDuplicates: true,
      });
    }

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.DEPARTMENT,
      entityId: created.id,
      action: "DEPARTMENT_CREATED",
      beforeJson: null,
      afterJson: {
        ...created,
        divisions: parsed.data.divisions,
      },
    });
  });

  revalidatePath("/admin/departments");
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  active: z
    .string()
    .transform((v) => v === "true")
    .or(z.boolean()),
  divisions: z.array(z.nativeEnum(Division)).default([]),
});

export async function updateDepartmentAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);

  const parsed = UpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    active: formData.get("active"),
    divisions: formData.getAll("divisions"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.department.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        name: true,
        active: true,
        sortOrder: true,
        divisions: { select: { division: true } },
      },
    });
    if (!before) throw new Error("מחלקה לא נמצאה.");

    const updated = await tx.department.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        active: parsed.data.active,
      },
      select: { id: true, name: true, active: true, sortOrder: true },
    });

    await tx.departmentDivision.deleteMany({
      where: { departmentId: parsed.data.id },
    });
    if (parsed.data.divisions.length) {
      await tx.departmentDivision.createMany({
        data: parsed.data.divisions.map((division) => ({
          departmentId: parsed.data.id,
          division,
        })),
        skipDuplicates: true,
      });
    }

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.DEPARTMENT,
      entityId: parsed.data.id,
      action: "DEPARTMENT_UPDATED",
      beforeJson: {
        ...before,
        divisions: before.divisions.map((d) => d.division),
      },
      afterJson: {
        ...updated,
        divisions: parsed.data.divisions,
      },
    });
  });

  revalidatePath("/admin/departments");
}

export async function deleteDepartmentAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const id = formData.get("id") as string;
  if (!id) throw new Error("מזהה מחלקה חסר.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.department.findUnique({
      where: { id },
      include: {
        positions: true,
        userDepartments: true,
      },
    });

    if (!before) throw new Error("מחלקה לא נמצאה.");
    
    // Check if department has positions or users
    if (before.positions.length > 0) {
      throw new Error("לא ניתן למחוק מחלקה עם תפקידים משויכים. מחק קודם את התפקידים.");
    }
    if (before.userDepartments.length > 0) {
      throw new Error("לא ניתן למחוק מחלקה עם משתמשים משויכים. הסר קודם את שיוך המשתמשים.");
    }

    await tx.department.delete({ where: { id } });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.DEPARTMENT,
      entityId: id,
      action: "DEPARTMENT_DELETED",
      beforeJson: before,
      afterJson: null,
    });
  });

  revalidatePath("/admin/departments");
}

export async function reorderDepartmentsAction(ids: string[]) {
  const session = await requireRole(Role.ADMIN);

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx.department.update({
        where: { id: ids[i] },
        data: { sortOrder: i },
      });
    }

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.DEPARTMENT,
      entityId: "SYSTEM",
      action: "DEPARTMENTS_REORDERED",
      metadataJson: { ids },
    });
  });

  revalidatePath("/admin/departments");
}


