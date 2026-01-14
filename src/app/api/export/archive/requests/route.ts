import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseTableQuery } from "@/lib/tableQuery";
import { applyFiltersToWhere } from "@/lib/archiveWhere";
import { toCsv } from "@/lib/csv";
import { priorityLabel, requestStatusLabel, requestTypeLabel } from "@/lib/he";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "לא מחובר." }, { status: 401 });
  if (session.user.role === Role.USER) return NextResponse.json({ message: "אין הרשאה." }, { status: 403 });

  const url = new URL(req.url);
  const q = parseTableQuery(Object.fromEntries(url.searchParams.entries()));

  let where: any = {};
  where = applyFiltersToWhere(where, q.filters);

  if (q.q) {
    where.OR = [
      { items: { some: { equipmentItem: { name: { contains: q.q, mode: "insensitive" } } } } },
      { requester: { name: { contains: q.q, mode: "insensitive" } } },
    ];
  }

  const rows = await prisma.request.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 5000,
    select: {
      id: true,
      createdAt: true,
      type: true,
      status: true,
      priority: true,
      requester: { select: { name: true, email: true } },
      items: {
        select: {
          quantity: true,
          equipmentItem: { select: { name: true } },
        },
      },
    },
  });

  const csv = toCsv(
    rows.flatMap((r) =>
      r.items.map((item) => ({
        מזהה: r.id,
        "נוצר בתאריך": r.createdAt.toISOString(),
        "שם חייל": r.requester.name,
        "מייל חייל": r.requester.email,
        פריט: item.equipmentItem.name,
        כמות: item.quantity,
        סוג: requestTypeLabel(r.type),
        סטטוס: requestStatusLabel(r.status),
        עדיפות: priorityLabel(r.priority),
      })),
    ),
    [
      "מזהה",
      "נוצר בתאריך",
      "שם חייל",
      "מייל חייל",
      "פריט",
      "כמות",
      "סוג",
      "סטטוס",
      "עדיפות",
    ],
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"archive-requests.csv\"",
    },
  });
}


