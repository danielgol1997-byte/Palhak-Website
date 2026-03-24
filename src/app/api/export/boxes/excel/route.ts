import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAdminExportSession } from "../../_lib/adminExportAuth";
import { autosizeColumns, styleHeaderRow } from "../../_lib/xlsxStyle";
import {
  boxFillRatioToArgb,
  fetchBoxMatrixExport,
} from "../../_lib/boxMatrixExport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_ALIGN: Partial<ExcelJS.Alignment> = {
  vertical: "middle",
  horizontal: "right",
  readingOrder: "rtl",
};

export async function GET() {
  const auth = await requireAdminExportSession();
  if (!auth.ok) return auth.response;

  const data = await fetchBoxMatrixExport();
  if (!data) {
    return NextResponse.json(
      { error: "אין תבנית קרטון מוגדרת." },
      { status: 404 },
    );
  }

  const { slots, users } = data;
  const headers = [
    "שם",
    "מספר אישי",
    "מילוי (בקרטון/נדרש)",
    ...slots.map((s) => s.header),
  ];

  const wb = new ExcelJS.Workbook();
  wb.creator = "Palhak";
  wb.created = new Date();

  const ws = wb.addWorksheet("קרטונים");
  styleHeaderRow(ws, headers);

  for (const u of users) {
    const rowValues: (string | number)[] = [
      u.name,
      u.personalNumber,
      `${u.inBoxTotal}/${u.totalRequired}`,
      ...u.slotQty.map((q) => (q > 0 ? q : "")),
    ];
    const row = ws.addRow(rowValues);
    const fillArgb = boxFillRatioToArgb(u.fillRatio);
    row.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fillArgb },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE4E4E7" } },
        left: { style: "thin", color: { argb: "FFE4E4E7" } },
        bottom: { style: "thin", color: { argb: "FFE4E4E7" } },
        right: { style: "thin", color: { argb: "FFE4E4E7" } },
      };
      cell.alignment = { ...DATA_ALIGN };
    });
  }

  autosizeColumns(ws);

  const buf = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="cardboard-boxes.xlsx"',
      "cache-control": "no-store",
    },
  });
}
