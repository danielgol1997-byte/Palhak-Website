import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { requireAdminExportSession } from "../../_lib/adminExportAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminExportSession();
  if (!auth.ok) return auth.response;

  const users = await prisma.user.findMany({
    where: { active: true, role: "USER" },
    orderBy: [{ name: "asc" }],
    select: {
      name: true,
      personalNumber: true,
      assignments: {
        where: { active: true },
        orderBy: [{ assignedAt: "desc" }],
        select: {
          quantity: true,
          status: true,
          serialNumber: true,
          clothingSize: true,
          shoeSize: true,
          assignedAt: true,
          assignedBy: { select: { name: true } },
          equipmentItem: { select: { name: true } },
        },
      },
    },
  });

  const header = [
    "שם חייל",
    "מספר אישי",
    "פריט",
    "כמות",
    "סטטוס",
    "מספר סידורי",
    "תאריך שיוך",
    "הוקצה ע״י",
    "מידה (בגד)",
    "מידה (נעל)",
  ];

  const rows = users.flatMap((u) =>
    u.assignments.map((a) => ({
      "שם חייל": u.name,
      "מספר אישי": u.personalNumber ?? "",
      פריט: a.equipmentItem.name,
      כמות: a.quantity,
      סטטוס: a.status,
      "מספר סידורי": a.serialNumber ?? "",
      "תאריך שיוך": a.assignedAt ? a.assignedAt.toISOString() : "",
      "הוקצה ע״י": a.assignedBy?.name ?? "",
      "מידה (בגד)": a.clothingSize ?? "",
      "מידה (נעל)": a.shoeSize ?? "",
    })),
  );

  const csv = toCsv(rows as any, header);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"equipment-by-soldier.csv\"",
      "cache-control": "no-store",
    },
  });
}


