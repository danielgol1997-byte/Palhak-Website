import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { parseTableQuery } from "@/lib/tableQuery";
import { transferStatusLabel } from "@/lib/he";
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
    ...(isAdmin
      ? {}
      : {
          OR: [{ fromUserId: session.user.id }, { toUserId: session.user.id }],
        }),
    ...(q.q
      ? {
          OR: [
            { fromUser: { name: { contains: q.q, mode: "insensitive" as const } } },
            { toUser: { name: { contains: q.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const rows = await prisma.transfer.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 5000,
    select: {
      id: true,
      createdAt: true,
      status: true,
      approvedAt: true,
      receivedAt: true,
      rejectedAt: true,
      cancelledAt: true,
      fromUser: { select: { name: true, email: true } },
      toUser: { select: { name: true, email: true } },
      items: {
        select: {
          quantity: true,
          equipmentItem: { select: { name: true } },
          unitTemplate: { select: { name: true } },
        },
      },
    },
  });

  const csv = toCsv(
    rows.map((t) => ({
      מזהה: t.id,
      "נוצר בתאריך": t.createdAt.toISOString(),
      "שם שולח": t.fromUser.name,
      "מייל שולח": t.fromUser.email,
      "שם מקבל": t.toUser.name,
      "מייל מקבל": t.toUser.email,
      סטטוס: transferStatusLabel(t.status),
      "אושר בתאריך": t.approvedAt?.toISOString() ?? "",
      "התקבל בתאריך": t.receivedAt?.toISOString() ?? "",
      "נדחה בתאריך": t.rejectedAt?.toISOString() ?? "",
      "בוטל בתאריך": t.cancelledAt?.toISOString() ?? "",
      פריטים: t.items
        .map((i) => `${i.equipmentItem.name}×${i.quantity}${i.unitTemplate?.name ? ` (${i.unitTemplate.name})` : ""}`)
        .join("; "),
    })),
    [
      "מזהה",
      "נוצר בתאריך",
      "שם שולח",
      "מייל שולח",
      "שם מקבל",
      "מייל מקבל",
      "סטטוס",
      "אושר בתאריך",
      "התקבל בתאריך",
      "נדחה בתאריך",
      "בוטל בתאריך",
      "פריטים",
    ],
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"transfers.csv\"",
    },
  });
}


