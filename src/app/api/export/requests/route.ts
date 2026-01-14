import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { parseTableQuery } from "@/lib/tableQuery";
import { requestStatusLabel, requestTypeLabel, priorityLabel } from "@/lib/he";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "לא מחובר." }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = parseTableQuery(Object.fromEntries(url.searchParams.entries()));

  const isAdmin = session.user.role !== Role.USER;

  const where = {
    ...(isAdmin ? {} : { requesterId: session.user.id }),
    ...(q.q
      ? {
          OR: [
            { equipmentItem: { name: { contains: q.q, mode: "insensitive" as const } } },
            { requester: { name: { contains: q.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

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
      quantity: true,
      requester: { select: { name: true, email: true } },
      equipmentItem: { select: { name: true } },
    },
  });

  const csv = toCsv(
    rows.map((r) => ({
      מזהה: r.id,
      "נוצר בתאריך": r.createdAt.toISOString(),
      "שם חייל": r.requester.name,
      "מייל חייל": r.requester.email,
      פריט: r.equipmentItem.name,
      כמות: r.quantity,
      סוג: requestTypeLabel(r.type),
      סטטוס: requestStatusLabel(r.status),
      עדיפות: priorityLabel(r.priority),
    })),
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
      "content-disposition": "attachment; filename=\"requests.csv\"",
    },
  });
}


