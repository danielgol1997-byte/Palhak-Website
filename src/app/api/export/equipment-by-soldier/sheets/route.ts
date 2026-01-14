import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireAdminExportSession } from "../../_lib/adminExportAuth";
import { autosizeColumns, safeSheetName, styleHeaderRow } from "../../_lib/xlsxStyle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const wb = new ExcelJS.Workbook();
  wb.creator = "Palhak";
  wb.created = new Date();

  const headers = ["פריט", "כמות", "סטטוס", "מספר סידורי", "תאריך שיוך", "הוקצה ע״י", "מידה (בגד)", "מידה (נעל)"];

  const usedNames = new Map<string, number>();

  for (const u of users) {
    const base = safeSheetName(`${u.name}${u.personalNumber ? ` (${u.personalNumber})` : ""}`);
    const n = (usedNames.get(base) ?? 0) + 1;
    usedNames.set(base, n);
    const sheetName = n === 1 ? base : safeSheetName(`${base} ${n}`);

    const ws = wb.addWorksheet(sheetName);
    styleHeaderRow(ws, headers);

    for (const a of u.assignments) {
      ws.addRow([
        a.equipmentItem.name,
        a.quantity,
        a.status,
        a.serialNumber ?? "",
        a.assignedAt ? a.assignedAt.toISOString() : "",
        a.assignedBy?.name ?? "",
        a.clothingSize ?? "",
        a.shoeSize ?? "",
      ]);
    }

    autosizeColumns(ws);
  }

  const buf = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": "attachment; filename=\"equipment-by-soldier-google-sheets.xlsx\"",
      "cache-control": "no-store",
    },
  });
}


