"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { AuditEntity, Prisma, Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function createEmptyBoxAction(userId: string): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(Role.ADMIN);
  if (!session?.user?.id) return { success: false, error: "לא מורשה" };

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, active: true } });
    if (!user) return { success: false, error: "משתמש לא נמצא" };
    if (!user.active) return { success: false, error: "משתמש לא פעיל" };

    const existing = await prisma.box.findUnique({ where: { userId } });
    if (existing) return { success: false, error: "למשתמש זה כבר קיים קרטון" };

    await prisma.$transaction(async (tx) => {
      await tx.box.create({ data: { userId } });

      await writeAuditLog(tx, {
        actorId: session.user.id,
        action: "CREATE_EMPTY_BOX",
        entity: AuditEntity.BOX,
        entityId: userId,
        metadataJson: { targetUserName: user.name } as unknown as Prisma.InputJsonValue,
      });
    });

    revalidatePath("/admin/boxes");
    return { success: true };
  } catch {
    return { success: false, error: "שגיאה ביצירת קרטון" };
  }
}
