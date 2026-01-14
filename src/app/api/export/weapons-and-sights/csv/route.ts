import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { requireAdminExportSession } from "../../_lib/adminExportAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminExportSession();
  if (!auth.ok) return auth.response;

  const [weaponAssignments, sightAssignments] = await Promise.all([
    prisma.assignment.findMany({
      where: { active: true, status: "ASSIGNED", equipmentItem: { isWeapon: true, active: true } },
      orderBy: [{ assignedAt: "desc" }],
      select: {
        serialNumber: true,
        assignedAt: true,
        user: { select: { name: true, personalNumber: true } },
        equipmentItem: { select: { name: true } },
      },
    }),
    prisma.assignment.findMany({
      where: { active: true, status: "ASSIGNED", equipmentItem: { isSight: true, active: true } },
      orderBy: [{ assignedAt: "desc" }],
      select: {
        serialNumber: true,
        assignedAt: true,
        user: { select: { name: true, personalNumber: true } },
        equipmentItem: { select: { name: true } },
      },
    }),
  ]);

  const header = ["קטגוריה", "סוג", "מספר סידורי", "משויך ל", "מספר אישי", "תאריך שיוך"];

  const rows = [
    ...weaponAssignments.map((a) => ({
      קטגוריה: "נשק",
      סוג: a.equipmentItem.name,
      "מספר סידורי": a.serialNumber ?? "",
      "משויך ל": a.user?.name ?? "",
      "מספר אישי": a.user?.personalNumber ?? "",
      "תאריך שיוך": a.assignedAt ? a.assignedAt.toISOString() : "",
    })),
    ...sightAssignments.map((a) => ({
      קטגוריה: "צלמ",
      סוג: a.equipmentItem.name,
      "מספר סידורי": a.serialNumber ?? "",
      "משויך ל": a.user?.name ?? "",
      "מספר אישי": a.user?.personalNumber ?? "",
      "תאריך שיוך": a.assignedAt ? a.assignedAt.toISOString() : "",
    })),
  ];

  const csv = toCsv(rows as any, header);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"guns-and-sights.csv\"",
      "cache-control": "no-store",
    },
  });
}


