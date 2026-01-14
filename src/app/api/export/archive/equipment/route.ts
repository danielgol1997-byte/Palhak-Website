import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseTableQuery } from "@/lib/tableQuery";
import { applyFiltersToWhere } from "@/lib/archiveWhere";
import { toCsv } from "@/lib/csv";
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
      { action: { contains: q.q, mode: "insensitive" } },
      { entityId: { contains: q.q, mode: "insensitive" } },
      { actor: { name: { contains: q.q, mode: "insensitive" } } },
    ];
  }

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 5000,
    select: {
      id: true,
      createdAt: true,
      entity: true,
      entityId: true,
      action: true,
      actor: { select: { name: true, email: true } },
    },
  });

  const csv = toCsv(
    rows.map((r) => ({
      מזהה: r.id,
      "נוצר בתאריך": r.createdAt.toISOString(),
      ישות: r.entity,
      "מזהה ישות": r.entityId,
      פעולה: r.action,
      "שם מבצע": r.actor?.name ?? "",
      "מייל מבצע": r.actor?.email ?? "",
    })),
    ["מזהה", "נוצר בתאריך", "ישות", "מזהה ישות", "פעולה", "שם מבצע", "מייל מבצע"],
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"archive-equipment.csv\"",
    },
  });
}


