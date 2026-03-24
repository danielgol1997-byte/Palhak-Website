import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAdminExportSession } from "../../_lib/adminExportAuth";
import {
  buildMatrixColumns,
  buildMatrixDataRow,
  fetchEquipmentBySoldierUsers,
  parseEquipmentLayout,
} from "../../_lib/equipmentBySoldierExport";
import { autosizeColumns, styleHeaderRow, uniqueSheetName } from "../../_lib/xlsxStyle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const detailHeaders = ["פריט", "כמות", "סטטוס", "מספר סידורי", "תאריך שיוך", "הוקצה ע״י", "מידה (בגד)", "מידה (נעל)"];

const EXCEL_MAX_SHEETS = 255;

export async function GET(request: Request) {
  const auth = await requireAdminExportSession();
  if (!auth.ok) return auth.response;

  const layout = parseEquipmentLayout(request);
  const users = await fetchEquipmentBySoldierUsers();

  const wb = new ExcelJS.Workbook();
  wb.creator = "Palhak";
  wb.created = new Date();

  if (layout === "matrix") {
    const columns = buildMatrixColumns(users);
    const ws = wb.addWorksheet("ציוד — מטריצה");
    const headerRow = ["שם חייל", "מספר אישי", ...columns.map((c) => c.header)];
    styleHeaderRow(ws, headerRow);
    for (const u of users) {
      ws.addRow(buildMatrixDataRow(u, columns));
    }
    autosizeColumns(ws);
  } else if (users.length > EXCEL_MAX_SHEETS) {
    const ws = wb.addWorksheet("ציוד - כולם");
    styleHeaderRow(ws, ["שם חייל", "מספר אישי", ...detailHeaders]);
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
    const usedNames = new Set<string>();
    for (const u of users) {
      const raw = `${u.name}${u.personalNumber ? ` (${u.personalNumber})` : ""}`;
      const sheetName = uniqueSheetName(raw, usedNames);

      const ws = wb.addWorksheet(sheetName);
      styleHeaderRow(ws, detailHeaders);

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
      "content-disposition": "attachment; filename=\"equipment-by-soldier-google-sheets.xlsx\"",
      "cache-control": "no-store",
    },
  });
}
