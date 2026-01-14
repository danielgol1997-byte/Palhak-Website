import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { AuditEntity, AssignmentStatus } from "@prisma/client";

const BodySchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  personalNumber: z
    .string()
    .trim()
    .regex(/^\d+$/, "מספר אישי לא תקין."),
  departments: z.array(z.string().min(1)).min(1),
  positions: z.array(z.string().min(1)).min(1),
  baseline: z
    .array(
      z.object({
        division: z.enum(["COMBAT", "LOGISTICS", "MEDICAL"]),
        equipmentItemId: z.string().min(1),
        quantity: z.coerce.number().int().min(1),
      }),
    )
    .default([]),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "לא מחובר." }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "נתונים לא תקינים." }, { status: 400 });
  }

  const userId = session.user.id;
  const { firstName, lastName, personalNumber, departments, positions, baseline } = parsed.data;

  // Validate positions belong to selected departments.
  const pos = await prisma.position.findMany({
    where: { id: { in: positions } },
    select: { id: true, departmentId: true, name: true },
  });
  if (pos.length !== positions.length) {
    return NextResponse.json({ message: "תפקידים לא תקינים." }, { status: 400 });
  }
  const deptSet = new Set(departments);
  if (pos.some((p) => !deptSet.has(p.departmentId))) {
    return NextResponse.json(
      { message: "נבחר תפקיד שלא שייך למחלקות שנבחרו." },
      { status: 400 },
    );
  }

  // Allowed divisions derived from DepartmentDivision mapping for selected departments.
  const deptDivisions = await prisma.departmentDivision.findMany({
    where: { departmentId: { in: departments } },
    select: { division: true },
  });
  const allowedDivisionSet = new Set(deptDivisions.map((d) => d.division));
  if (baseline.some((b) => !allowedDivisionSet.has(b.division))) {
    return NextResponse.json(
      { message: "ציוד בסיס כולל חלוקה לא מורשית." },
      { status: 400 },
    );
  }

  const baselineByItem = new Map<string, { quantity: number; divisions: Set<string> }>();
  for (const row of baseline) {
    const cur = baselineByItem.get(row.equipmentItemId);
    if (!cur) {
      baselineByItem.set(row.equipmentItemId, {
        quantity: row.quantity,
        divisions: new Set([row.division]),
      });
    } else {
      cur.quantity += row.quantity;
      cur.divisions.add(row.division);
    }
  }

  const itemIds = Array.from(baselineByItem.keys());
  if (itemIds.length) {
    const items = await prisma.equipmentItem.findMany({
      where: { id: { in: itemIds }, active: true, category: { active: true } },
      select: { id: true, category: { select: { division: true } } },
    });
    const itemMap = new Map(items.map((i) => [i.id, i.category.division] as const));
    for (const id of itemIds) {
      const division = itemMap.get(id);
      if (!division) {
        return NextResponse.json({ message: "פריטים לא תקינים." }, { status: 400 });
      }
      if (!allowedDivisionSet.has(division)) {
        return NextResponse.json(
          { message: "נבחר פריט מחלוקה לא מורשית." },
          { status: 400 },
        );
      }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
    const beforeUser = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        personalNumber: true,
        onboardedAt: true,
        role: true,
        active: true,
        userDepartments: { select: { departmentId: true } },
        userPositions: { select: { positionId: true } },
      },
    });

    const existingPersonal = await tx.user.findFirst({
      where: { personalNumber, NOT: { id: userId } },
      select: { id: true },
    });
      if (existingPersonal) {
        throw new Error("מספר אישי כבר קיים במערכת.");
      }

    await tx.userDepartment.deleteMany({ where: { userId } });
    await tx.userPosition.deleteMany({ where: { userId } });

    await tx.userDepartment.createMany({
      data: departments.map((departmentId) => ({ userId, departmentId })),
      skipDuplicates: true,
    });
    await tx.userPosition.createMany({
      data: positions.map((positionId) => ({ userId, positionId })),
      skipDuplicates: true,
    });

    const now = new Date();
    await tx.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        personalNumber,
        name: `${firstName} ${lastName}`.trim(),
        onboardedAt: now,
      },
    });

    await writeAuditLog(tx, {
      actorId: userId,
      entity: AuditEntity.USER,
      entityId: userId,
      action: "ONBOARDING_SUBMIT",
      beforeJson: beforeUser
        ? {
            firstName: beforeUser.firstName,
            lastName: beforeUser.lastName,
            onboardedAt: beforeUser.onboardedAt,
            departments: beforeUser.userDepartments.map((d) => d.departmentId),
            positions: beforeUser.userPositions.map((p) => p.positionId),
          }
        : null,
      afterJson: {
        firstName,
        lastName,
        onboardedAt: now,
        departments,
        positions,
      },
    });

    if (itemIds.length) {
      const existing = await tx.assignment.findMany({
        where: {
          userId,
          equipmentItemId: { in: itemIds },
          status: AssignmentStatus.PENDING_APPROVAL,
          active: true,
        },
        select: { id: true, equipmentItemId: true, quantity: true, status: true, active: true },
      });
      const existingMap = new Map(existing.map((a) => [a.equipmentItemId, a] as const));

      for (const [equipmentItemId, agg] of baselineByItem.entries()) {
        const row = existingMap.get(equipmentItemId);
        if (!row) {
          const created = await tx.assignment.create({
            data: {
              userId,
              equipmentItemId,
              quantity: agg.quantity,
              status: AssignmentStatus.PENDING_APPROVAL,
              active: true,
              assignedById: null,
              assignedAt: now,
            },
            select: { id: true },
          });
          await writeAuditLog(tx, {
            actorId: userId,
            entity: AuditEntity.ASSIGNMENT,
            entityId: created.id,
            action: "ASSIGNMENT_CREATED_PENDING_APPROVAL",
            beforeJson: null,
            afterJson: {
              userId,
              equipmentItemId,
              quantity: agg.quantity,
              status: "PENDING_APPROVAL",
            },
            metadataJson: { source: "onboarding" },
          });
        } else {
          const updated = await tx.assignment.update({
            where: { id: row.id },
            data: { quantity: row.quantity + agg.quantity },
            select: { quantity: true },
          });
          await writeAuditLog(tx, {
            actorId: userId,
            entity: AuditEntity.ASSIGNMENT,
            entityId: row.id,
            action: "ASSIGNMENT_QUANTITY_UPDATED_PENDING_APPROVAL",
            beforeJson: { quantity: row.quantity },
            afterJson: { quantity: updated.quantity },
            metadataJson: { source: "onboarding" },
          });
        }
      }
    }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : null;
    if (msg === "מספר אישי כבר קיים במערכת.") {
      return NextResponse.json({ message: msg }, { status: 409 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}


