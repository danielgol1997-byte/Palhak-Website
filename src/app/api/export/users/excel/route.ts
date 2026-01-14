import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireAdminExportSession } from "../../_lib/adminExportAuth";
import { autosizeColumns, styleHeaderRow } from "../../_lib/xlsxStyle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const wb = new ExcelJS.Workbook();
  wb.creator = "Palhak";
  wb.created = new Date();

  const ws = wb.addWorksheet("משתמשים");
  const headers = [
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
  styleHeaderRow(ws, headers);

  users.forEach((u) => {
    const departments = u.userDepartments.map((ud) => ud.department.name).join(", ");
    const positions = u.userPositions.map((up) => `${up.position.department.name}: ${up.position.name}`).join(", ");
    ws.addRow([
      u.name,
      u.firstName ?? "",
      u.lastName ?? "",
      u.email,
      u.phoneNumber ?? "",
      u.personalNumber ?? "",
      u.role,
      departments,
      positions,
      u.shirtSize ?? "",
      u.pantsSize ?? "",
      u.shoeSize ?? "",
      u.createdAt.toISOString(),
      u.onboardedAt ? u.onboardedAt.toISOString() : "",
    ]);
  });

  autosizeColumns(ws);

  const buf = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": "attachment; filename=\"users.xlsx\"",
      "cache-control": "no-store",
    },
  });
}


