import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAdminExportSession } from "../../_lib/adminExportAuth";
import { autosizeColumns, styleHeaderRow } from "../../_lib/xlsxStyle";
import { getYamahRowsWithTotals } from "../_lib/inventoryRows";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminExportSession();
  if (!auth.ok) return auth.response;

  const rows = await getYamahRowsWithTotals();

  const wb = new ExcelJS.Workbook();
  wb.creator = "Palhak";
  wb.created = new Date();

  const ws = wb.addWorksheet("מלאי");
  const headers = ["פריט", "חלוקה", "במלאי", "מוקצה (תקין)", "בלאי", "שומש", "אבד/נגנב", "סה״כ"];
  styleHeaderRow(ws, headers);

  rows.forEach((r) => {
    ws.addRow([
      r.equipmentItemName,
      r.division,
      r.inStorage,
      r.assignedHealthy,
      r.damaged,
      r.used,
      r.stolenOrLost,
      r.total,
    ]);
  });

  autosizeColumns(ws);

  const buf = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": "attachment; filename=\"inventory.xlsx\"",
      "cache-control": "no-store",
    },
  });
}


