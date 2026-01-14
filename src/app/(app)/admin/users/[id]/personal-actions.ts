"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { AuditEntity, Role, ClothingSize, ShoeSize } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const UpdatePersonalDetailsSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  personalNumber: z.string().optional(),
  phoneNumber: z.string().optional(),
  role: z.nativeEnum(Role),
  active: z.string().transform((v) => v === "true").or(z.boolean()),
  shirtSize: z.nativeEnum(ClothingSize).or(z.literal("")).optional(),
  pantsSize: z.nativeEnum(ClothingSize).or(z.literal("")).optional(),
  shoeSize: z.nativeEnum(ShoeSize).or(z.literal("")).optional(),
  departmentId: z.string().transform(v => v || undefined).optional(),
  positionId: z.string().transform(v => v || undefined).optional(),
});

export async function adminUpdateUserPersonalDetailsAction(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  
  const parsed = UpdatePersonalDetailsSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    email: formData.get("email"),
    personalNumber: formData.get("personalNumber") || undefined,
    phoneNumber: formData.get("phoneNumber") || undefined,
    role: formData.get("role"),
    active: formData.get("active"),
    shirtSize: formData.get("shirtSize") || undefined,
    pantsSize: formData.get("pantsSize") || undefined,
    shoeSize: formData.get("shoeSize") || undefined,
    departmentId: formData.get("departmentId") || undefined,
    positionId: formData.get("positionId") || undefined,
  });
  
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    throw new Error(firstError?.message || "נתונים לא תקינים.");
  }

  await prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: parsed.data.userId },
      select: {
        id: true,
        name: true,
        email: true,
        personalNumber: true,
        phoneNumber: true,
        role: true,
        active: true,
        shirtSize: true,
        pantsSize: true,
        shoeSize: true,
        userDepartments: { select: { departmentId: true } },
        userPositions: { select: { positionId: true } },
      },
    });
    
    if (!before) throw new Error("משתמש לא נמצא.");

    // Update user basic info
    await tx.user.update({
      where: { id: parsed.data.userId },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        personalNumber: parsed.data.personalNumber || null,
        phoneNumber: parsed.data.phoneNumber || null,
        role: parsed.data.role,
        active: parsed.data.active,
        shirtSize: parsed.data.shirtSize || null,
        pantsSize: parsed.data.pantsSize || null,
        shoeSize: parsed.data.shoeSize || null,
      },
    });

    // Update department (single)
    await tx.userDepartment.deleteMany({ where: { userId: parsed.data.userId } });
    if (parsed.data.departmentId) {
      await tx.userDepartment.create({
        data: {
          userId: parsed.data.userId,
          departmentId: parsed.data.departmentId,
        },
      });
    }

    // Update position (single)
    await tx.userPosition.deleteMany({ where: { userId: parsed.data.userId } });
    if (parsed.data.positionId) {
      await tx.userPosition.create({
        data: {
          userId: parsed.data.userId,
          positionId: parsed.data.positionId,
        },
      });
    }

    await writeAuditLog(tx, {
      actorId: session.user.id,
      entity: AuditEntity.USER,
      entityId: parsed.data.userId,
      action: "USER_PERSONAL_DETAILS_UPDATED",
      beforeJson: before,
      afterJson: {
        name: parsed.data.name,
        email: parsed.data.email,
        personalNumber: parsed.data.personalNumber,
        phoneNumber: parsed.data.phoneNumber,
        role: parsed.data.role,
        active: parsed.data.active,
      },
    });
  }, {
    maxWait: 10000,
    timeout: 15000,
  });

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath("/admin/users");
}

