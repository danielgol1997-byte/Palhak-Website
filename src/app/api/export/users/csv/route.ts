import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { requireAdminExportSession } from "../../_lib/adminExportAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminExportSession();
  if (!auth.ok) return auth.response;

  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: [{ name: "asc" }],
    select: {
      name: true,
      email: true,
      phoneNumber: true,
      personalNumber: true,
      role: true,
      createdAt: true,
      onboardedAt: true,
      firstName: true,
      lastName: true,
      shirtSize: true,
      pantsSize: true,
      shoeSize: true,
      userDepartments: { select: { department: { select: { name: true } } } },
      userPositions: { select: { position: { select: { name: true, department: { select: { name: true } } } } } },
    },
  });

  const header = [
    "שם",
    "שם פרטי",
    "שם משפחה",
    "מייל",
    "טלפון",
    "מספר אישי",
    "תפקיד מערכת",
    "מחלקות",
    "תפקידים",
    "מידת חולצה",
    "מידת מכנס",
    "מידת נעל",
    "נוצר בתאריך",
    "הושלם Onboarding",
  ];

  const rows = users.map((u) => ({
    שם: u.name,
    "שם פרטי": u.firstName ?? "",
    "שם משפחה": u.lastName ?? "",
    מייל: u.email,
    טלפון: u.phoneNumber ?? "",
    "מספר אישי": u.personalNumber ?? "",
    "תפקיד מערכת": u.role,
    מחלקות: u.userDepartments.map((ud) => ud.department.name).join(", "),
    תפקידים: u.userPositions.map((up) => `${up.position.department.name}: ${up.position.name}`).join(", "),
    "מידת חולצה": u.shirtSize ?? "",
    "מידת מכנס": u.pantsSize ?? "",
    "מידת נעל": u.shoeSize ?? "",
    "נוצר בתאריך": u.createdAt.toISOString(),
    "הושלם Onboarding": u.onboardedAt ? u.onboardedAt.toISOString() : "",
  }));

  const csv = toCsv(rows as any, header);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"users.csv\"",
      "cache-control": "no-store",
    },
  });
}


