"use server";
// One-time recovery endpoint: rebuilds Box + BoxItem records from existing
// ASSIGNED assignments that match the box template.
// Safe to call multiple times – it skips any assignment already covered by a
// BoxItem (checks remaining template capacity before moving).

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { AuditEntity, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ message: "לא מחובר." }, { status: 401 });
  if (session.user.role === Role.USER)
    return NextResponse.json({ message: "אין הרשאה." }, { status: 403 });

  try {
    // ── 1. Load box template ──────────────────────────────────────────────
    const tpl = await prisma.boxTemplate.findFirst({
      include: { items: { include: { alternatives: true } } },
    });
    if (!tpl)
      return NextResponse.json(
        { message: "תבנית קרטון לא הוגדרה – אין מה לשחזר." },
        { status: 400 }
      );

    // Map every equipment item id → templateItem (including alternatives)
    const itemToTpl = new Map<
      string,
      (typeof tpl.items)[number]
    >();
    for (const ti of tpl.items) {
      itemToTpl.set(ti.equipmentItemId, ti);
      for (const alt of ti.alternatives) {
        itemToTpl.set(alt.equipmentItemId, ti);
      }
    }

    // ── 2. Get all active ASSIGNED assignments whose item is in the template
    const assignments = await prisma.assignment.findMany({
      where: {
        active: true,
        status: "ASSIGNED",
        equipmentItemId: { in: Array.from(itemToTpl.keys()) },
      },
      include: {
        equipmentItem: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });

    if (assignments.length === 0)
      return NextResponse.json({
        success: true,
        message: "אין הקצאות לשחזור לקרטונים.",
        moved: 0,
        skipped: 0,
        users: 0,
      });

    // ── 3. Process each assignment inside a single transaction ───────────
    const stats = { moved: 0, skipped: 0, usersAffected: new Set<string>() };

    await prisma.$transaction(
      async (tx) => {
        for (const assignment of assignments) {
          const ti = itemToTpl.get(assignment.equipmentItemId)!;

          // Find or create this user's box
          let box = await tx.box.findUnique({
            where: { userId: assignment.userId },
          });
          if (!box) box = await tx.box.create({ data: { userId: assignment.userId } });

          // Check remaining capacity for this template slot
          const allGroupIds = [
            ti.equipmentItemId,
            ...ti.alternatives.map((a) => a.equipmentItemId),
          ];
          const groupItems = await tx.boxItem.findMany({
            where: { boxId: box.id, equipmentItemId: { in: allGroupIds } },
          });
          const alreadyInBox = groupItems.reduce((s, bi) => s + bi.quantity, 0);
          const capacity = ti.quantity - alreadyInBox;

          if (capacity <= 0) {
            stats.skipped++;
            continue; // box slot already full
          }

          const qty = Math.min(assignment.quantity, capacity);

          // Remove assignment (fully or partially)
          if (qty < assignment.quantity) {
            await tx.assignment.update({
              where: { id: assignment.id },
              data: { quantity: assignment.quantity - qty },
            });
          } else {
            await tx.assignment.delete({ where: { id: assignment.id } });
          }

          // Add to BoxItem
          const existingBoxItem = assignment.serialNumber
            ? null
            : await tx.boxItem.findFirst({
                where: {
                  boxId: box.id,
                  equipmentItemId: assignment.equipmentItemId,
                  serialNumber: null,
                },
              });

          if (existingBoxItem) {
            await tx.boxItem.update({
              where: { id: existingBoxItem.id },
              data: { quantity: existingBoxItem.quantity + qty },
            });
          } else {
            await tx.boxItem.create({
              data: {
                boxId: box.id,
                equipmentItemId: assignment.equipmentItemId,
                quantity: qty,
                serialNumber: assignment.serialNumber ?? null,
                movedById: session.user.id,
              },
            });
          }

          await writeAuditLog(tx, {
            actorId: session.user.id,
            entity: AuditEntity.BOX,
            entityId: box.id,
            action: "RECOVER_TO_BOX",
            metadataJson: {
              equipmentItemId: assignment.equipmentItemId,
              equipmentItemName: assignment.equipmentItem.name,
              userName: assignment.user.name,
              quantity: qty,
              serialNumber: assignment.serialNumber,
            },
          });

          stats.moved++;
          stats.usersAffected.add(assignment.userId);
        }
      },
      { timeout: 60_000 }
    );

    return NextResponse.json({
      success: true,
      message: `שוחזרו ${stats.moved} הקצאות לקרטונים עבור ${stats.usersAffected.size} משתמשים.`,
      moved: stats.moved,
      skipped: stats.skipped,
      users: stats.usersAffected.size,
    });
  } catch (error) {
    console.error("❌ Error recovering boxes:", error);
    return NextResponse.json(
      {
        success: false,
        message: "שגיאה בשחזור קרטונים",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
