"use server";

import { prisma } from "@/lib/prisma";
import { requireWriteRole } from "@/lib/auth";
import { AuditEntity, Prisma, Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function createEmptyBoxAction(userId: string): Promise<{ success: boolean; error?: string }> {
  const session = await requireWriteRole(Role.ADMIN);
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

/**
 * Hand a whole box over to another person: the box and everything inside it stay
 * as they are, only the name on it changes. Used when a soldier leaves the unit
 * and a new one takes over his box.
 *
 * The new owner must be active. If he already has a box it must be empty (it is
 * removed and replaced); a box with equipment in it is never overwritten.
 */
export async function reassignBoxAction(fromUserId: string, toUserId: string): Promise<{ success: boolean; error?: string }> {
  const session = await requireWriteRole(Role.ADMIN);
  if (!session?.user?.id) return { success: false, error: "לא מורשה" };
  if (!fromUserId || !toUserId) return { success: false, error: "נתונים לא תקינים." };
  if (fromUserId === toUserId) return { success: false, error: "הקרטון כבר רשום על המשתמש הזה." };

  try {
    await prisma.$transaction(async (tx) => {
      const box = await tx.box.findUnique({
        where: { userId: fromUserId },
        select: { id: true, user: { select: { name: true } }, items: { select: { quantity: true } } },
      });
      if (!box) throw new Error("לא נמצא קרטון על שם המשתמש הזה.");

      const target = await tx.user.findUnique({
        where: { id: toUserId },
        select: { id: true, name: true, active: true, box: { select: { id: true, _count: { select: { items: true } } } } },
      });
      if (!target) throw new Error("המשתמש שאליו מעבירים את הקרטון לא נמצא.");
      if (!target.active) throw new Error(`${target.name} אינו פעיל, ולכן לא ניתן להעביר אליו קרטון.`);

      if (target.box) {
        if (target.box._count.items > 0) {
          throw new Error(`ל${target.name} כבר יש קרטון עם ציוד. יש לרוקן אותו או להעביר אליו פריטים בודדים.`);
        }
        await tx.box.delete({ where: { id: target.box.id } });
      }

      await tx.box.update({ where: { id: box.id }, data: { userId: toUserId } });

      await writeAuditLog(tx, {
        actorId: session.user.id,
        action: "REASSIGN_BOX",
        entity: AuditEntity.BOX,
        entityId: box.id,
        metadataJson: {
          fromUserId,
          fromUserName: box.user.name,
          toUserId,
          toUserName: target.name,
          itemRows: box.items.length,
          units: box.items.reduce((s, i) => s + i.quantity, 0),
          replacedEmptyBoxId: target.box?.id ?? null,
        } as unknown as Prisma.InputJsonValue,
      });
    });

    revalidatePath("/admin/boxes");
    revalidatePath(`/admin/users/${fromUserId}`);
    revalidatePath(`/admin/users/${toUserId}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בהעברת הקרטון" };
  }
}
