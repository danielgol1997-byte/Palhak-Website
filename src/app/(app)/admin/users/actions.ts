"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { isPrivilegedOperator, PRIVILEGED_OPERATOR_ROLES } from "@/lib/rbac";
import { AuditEntity, Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const UpdateActiveSchema = z.object({
  userId: z.string().min(1),
  active: z.string().transform((v) => v === "true").or(z.boolean()),
});

export async function adminUpdateUserActiveAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const parsed = UpdateActiveSchema.safeParse({
    userId: formData.get("userId"),
    active: formData.get("active"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, role: true, active: true, name: true, email: true },
    });
    if (!before) throw new Error("משתמש לא נמצא.");
    if (isPrivilegedOperator(before.role) && !isPrivilegedOperator(session.user.role)) {
      throw new Error("לא ניתן לערוך משתמש זה.");
    }

    if (
      isPrivilegedOperator(before.role) &&
      !parsed.data.active &&
      isPrivilegedOperator(session.user.role)
    ) {
      const privilegedActive = await tx.user.count({
        where: { active: true, role: { in: [...PRIVILEGED_OPERATOR_ROLES] } },
      });
      if (privilegedActive <= 1) {
        throw new Error("לא ניתן לבטל את מפעיל המערכת האחרון.");
      }
    }

    const after = await tx.user.update({
      where: { id: parsed.data.userId },
      data: { active: parsed.data.active },
      select: { id: true, role: true, active: true, name: true, email: true },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.USER,
      entityId: parsed.data.userId,
      action: "USER_ACTIVE_UPDATED",
      beforeJson: before,
      afterJson: after,
    });
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${parsed.data.userId}`);
}

const UpdateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(Role),
});

export async function superAdminUpdateUserRoleAction(formData: FormData) {
  const session = await requireRole(Role.SUPER_ADMIN);
  const parsed = UpdateRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  // Prevent users from changing their own role
  if (parsed.data.userId === session.user.id) {
    throw new Error("לא ניתן לשנות את התפקיד שלך בעצמך.");
  }

  await prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, role: true, active: true, name: true, email: true },
    });
    if (!before) throw new Error("משתמש לא נמצא.");

    // Cannot demote the last privileged operator (super admin or יובל על חלל)
    if (
      isPrivilegedOperator(before.role) &&
      !isPrivilegedOperator(parsed.data.role)
    ) {
      const privilegedCount = await tx.user.count({
        where: { role: { in: [...PRIVILEGED_OPERATOR_ROLES] }, active: true },
      });
      if (privilegedCount <= 1) {
        throw new Error("לא ניתן להסיר את מפעיל המערכת האחרון.");
      }
    }

    const after = await tx.user.update({
      where: { id: parsed.data.userId },
      data: { role: parsed.data.role },
      select: { id: true, role: true, active: true, name: true, email: true },
    });

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.USER,
      entityId: parsed.data.userId,
      action: "USER_ROLE_UPDATED",
      beforeJson: before,
      afterJson: after,
      metadataJson: {
        previousRole: before.role,
        newRole: after.role,
        actorName: session.user.name,
        targetName: before.name,
      },
    });
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${parsed.data.userId}`);
}

const UpdateDeptPosSchema = z.object({
  userId: z.string().min(1),
  departments: z.array(z.string().min(1)).default([]),
  positions: z.array(z.string().min(1)).default([]),
});

export async function adminUpdateUserDepartmentsPositionsAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);

  const parsed = UpdateDeptPosSchema.safeParse({
    userId: formData.get("userId"),
    departments: formData.getAll("departments"),
    positions: formData.getAll("positions"),
  });
  if (!parsed.success) throw new Error("נתונים לא תקינים.");

  await prisma.$transaction(async (tx) => {
    const beforeUser = await tx.user.findUnique({
      where: { id: parsed.data.userId },
      select: {
        id: true,
        role: true,
        userDepartments: { select: { departmentId: true } },
        userPositions: { select: { positionId: true } },
      },
    });
    if (!beforeUser) throw new Error("משתמש לא נמצא.");
    if (isPrivilegedOperator(beforeUser.role) && !isPrivilegedOperator(session.user.role)) {
      throw new Error("לא ניתן לערוך משתמש זה.");
    }

    // Validate positions belong to selected departments
    if (parsed.data.positions.length) {
      const pos = await tx.position.findMany({
        where: { id: { in: parsed.data.positions } },
        select: { id: true, departmentId: true },
      });
      if (pos.length !== parsed.data.positions.length) throw new Error("תפקידים לא תקינים.");
      const deptSet = new Set(parsed.data.departments);
      if (pos.some((p) => !deptSet.has(p.departmentId))) {
        throw new Error("נבחר תפקיד שלא שייך למחלקות שנבחרו.");
      }
    }

    await tx.userDepartment.deleteMany({ where: { userId: parsed.data.userId } });
    await tx.userPosition.deleteMany({ where: { userId: parsed.data.userId } });

    if (parsed.data.departments.length) {
      await tx.userDepartment.createMany({
        data: parsed.data.departments.map((departmentId) => ({
          userId: parsed.data.userId,
          departmentId,
        })),
        skipDuplicates: true,
      });
    }

    if (parsed.data.positions.length) {
      await tx.userPosition.createMany({
        data: parsed.data.positions.map((positionId) => ({
          userId: parsed.data.userId,
          positionId,
        })),
        skipDuplicates: true,
      });
    }

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.USER,
      entityId: parsed.data.userId,
      action: "USER_DEPARTMENTS_POSITIONS_UPDATED",
      beforeJson: {
        departments: beforeUser.userDepartments.map((d) => d.departmentId),
        positions: beforeUser.userPositions.map((p) => p.positionId),
      },
      afterJson: {
        departments: parsed.data.departments,
        positions: parsed.data.positions,
      },
    });
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${parsed.data.userId}`);
}



const CreateUserSchema = z.object({
  name: z.string().trim().min(1, "שם חובה"),
  email: z.string().trim().email("כתובת אימייל לא תקינה").transform((v) => v.toLowerCase()),
  personalNumber: z.string().trim().optional().transform((v) => v || undefined),
  phoneNumber: z.string().trim().optional().transform((v) => v || undefined),
  firstName: z.string().trim().optional().transform((v) => v || undefined),
  lastName: z.string().trim().optional().transform((v) => v || undefined),
});

export async function adminCreateUserAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; userId?: string }> {
  const session = await requireRole(Role.ADMIN);

  const parsed = CreateUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    personalNumber: formData.get("personalNumber") || undefined,
    phoneNumber: formData.get("phoneNumber") || undefined,
    firstName: formData.get("firstName") || undefined,
    lastName: formData.get("lastName") || undefined,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, error: first?.message || "נתונים לא תקינים." };
  }

  try {
    const userId = await prisma.$transaction(async (tx) => {
      // Duplicate email check
      const existing = await tx.user.findUnique({
        where: { email: parsed.data.email },
        select: { id: true },
      });
      if (existing) throw new Error("כבר קיים משתמש עם כתובת אימייל זו.");

      // Duplicate personalNumber check
      if (parsed.data.personalNumber) {
        const existingPN = await tx.user.findUnique({
          where: { personalNumber: parsed.data.personalNumber },
          select: { id: true },
        });
        if (existingPN) throw new Error("כבר קיים משתמש עם מספר אישי זה.");
      }

      const user = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          personalNumber: parsed.data.personalNumber ?? null,
          phoneNumber: parsed.data.phoneNumber ?? null,
          firstName: parsed.data.firstName ?? null,
          lastName: parsed.data.lastName ?? null,
          active: true,
          // onboardedAt is intentionally null — user will complete onboarding on first login
        },
      });

      await writeAuditLog(tx, {
        actorId: session.user.id,
        entity: AuditEntity.USER,
        entityId: user.id,
        action: "ADMIN_CREATE_USER",
        afterJson: {
          name: user.name,
          email: user.email,
          personalNumber: user.personalNumber,
        },
      });

      return user.id;
    });

    revalidatePath("/admin/users");
    return { success: true, userId };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "אירעה שגיאה בלתי צפויה.",
    };
  }
}
