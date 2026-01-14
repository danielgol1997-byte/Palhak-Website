import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireAdminExportSession } from "../../_lib/adminExportAuth";
import { autosizeColumns, styleHeaderRow, uniqueSheetName } from "../../_lib/xlsxStyle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminExportSession();
  if (!auth.ok) return auth.response;

  const users = await prisma.user.findMany({
    where: { active: true, role: "USER" },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
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
          equipmentItem: { select: { name: true, isWeapon: true, isSight: true, isClothing: true, isShoe: true } },
        },
      },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Palhak";
  wb.created = new Date();

  const headers = ["פריט", "כמות", "סטטוס", "מספר סידורי", "תאריך שיוך", "הוקצה ע״י", "מידה (בגד)", "מידה (נעל)"];

  const usedNames = new Set<string>();
  const EXCEL_MAX_SHEETS = 255;

  // If we exceed Excel sheet limits, fall back to a single "All" sheet (still filterable).
  if (users.length > EXCEL_MAX_SHEETS) {
    const ws = wb.addWorksheet("ציוד - כולם");
    styleHeaderRow(ws, ["שם חייל", "מספר אישי", ...headers]);
    for (const u of users) {
      for (const a of u.assignments) {
        ws.addRow([
          u.name,
          u.personalNumber ?? "",
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
    }
    autosizeColumns(ws);
  } else if (users.length === 0) {
    const ws = wb.addWorksheet("אין נתונים");
    styleHeaderRow(ws, ["הודעה"]);
    ws.addRow(["אין משתמשים פעילים לייצוא."]);
    autosizeColumns(ws);
  } else {
    for (const u of users) {
      const raw = `${u.name}${u.personalNumber ? ` (${u.personalNumber})` : ""}`;
      const sheetName = uniqueSheetName(raw, usedNames);

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
  }

  const buf = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": "attachment; filename=\"equipment-by-soldier.xlsx\"",
      "cache-control": "no-store",
    },
  });
}


