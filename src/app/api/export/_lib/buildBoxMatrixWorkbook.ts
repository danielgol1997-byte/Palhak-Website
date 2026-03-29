import ExcelJS from "exceljs";
import { BOX_MATRIX_SUMMARY_NOTE, boxFillRatioToArgb, type BoxMatrixExportData } from "./boxMatrixExport";

/** Column F — columns A–D summary, E gutter */
const MATRIX_START_COL = 6;

const DATA_ALIGN: Partial<ExcelJS.Alignment> = {
  vertical: "middle",
  horizontal: "right",
  readingOrder: "rtl",
};

const BORDER_GRID = {
  top: { style: "thin" as const, color: { argb: "FFCCCFD6" } },
  left: { style: "thin" as const, color: { argb: "FFCCCFD6" } },
  bottom: { style: "thin" as const, color: { argb: "FFCCCFD6" } },
  right: { style: "thin" as const, color: { argb: "FFCCCFD6" } },
};

const HEADER_FILL = "FF18181B";
const HEADER_FONT = { bold: true, color: { argb: "FFE5E7EB" }, size: 10 };
const SUMMARY_TITLE_FILL = "FFFAFAFA";
const SUMMARY_TABLE_HEADER_FILL = "FF18181B";
const ZEBRA_ALT = "FFF4F4F5";

function paintCell(ws: ExcelJS.Worksheet, r: number, c: number, fillArgb: string) {
  ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
}

export function buildBoxMatrixWorkbook(data: BoxMatrixExportData): ExcelJS.Workbook {
  const { slots, users, totals, usersWithBoxCount, excludedWithoutBoxCount } = data;

  const matrixHeaders = [
    "שם",
    "מספר אישי",
    "מילוי (בקרטון/נדרש)",
    ...slots.map((s) => s.header),
  ];
  const matrixColCount = matrixHeaders.length;
  const lastMatrixCol = MATRIX_START_COL + matrixColCount - 1;

  const S = totals.length;
  const footerRow1 = 3 + S;
  const footerRow2 = footerRow1 + 1;
  const lastUserRow = 1 + users.length;
  const lastRow = Math.max(lastUserRow, footerRow2);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Palhak";
  wb.created = new Date();

  const ws = wb.addWorksheet("קרטונים", {
    properties: { defaultRowHeight: 22 },
  });

  ws.views = [
    {
      state: "frozen",
      xSplit: MATRIX_START_COL - 1,
      ySplit: 1,
      rightToLeft: true,
    } as ExcelJS.WorksheetView,
  ];

  // ─── Row 1 ─────────────────────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, 4);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = "סיכום אגרגטיבי — פריטים בקרטונים";
  titleCell.font = { bold: true, size: 12, color: { argb: "FF18181B" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUMMARY_TITLE_FILL } };
  titleCell.alignment = { vertical: "middle", horizontal: "center", readingOrder: "rtl", wrapText: true };
  titleCell.border = BORDER_GRID;
  titleCell.note = BOX_MATRIX_SUMMARY_NOTE;

  for (let c = 0; c < matrixColCount; c++) {
    const col = MATRIX_START_COL + c;
    const cell = ws.getCell(1, col);
    cell.value = matrixHeaders[c];
    cell.font = HEADER_FONT;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { ...DATA_ALIGN, horizontal: c < 3 ? "right" : "center" };
    cell.border = BORDER_GRID;
  }
  ws.getRow(1).height = 28;

  // ─── Row 2 ─────────────────────────────────────────────────────────────
  const summaryColHeaders = ["פריט (תא בקרטון)", "נדרש לקרטון", "סה״כ בקרטונים", "חסר"];
  for (let i = 0; i < 4; i++) {
    const cell = ws.getCell(2, i + 1);
    cell.value = summaryColHeaders[i];
    cell.font = HEADER_FONT;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUMMARY_TABLE_HEADER_FILL } };
    cell.alignment = { ...DATA_ALIGN, horizontal: i === 0 ? "right" : "center" };
    cell.border = BORDER_GRID;
    if (i === 3) {
      cell.note =
        "כמות חסרה = (נדרש לקרטון × מס׳ חיילים עם קרטון במערכת) מינוס סה״כ בקרטונים. לא שלילי. ראה גם הערה בכותרת הסיכום.";
    }
  }

  const writeMatrixRow = (rowIndex: number, user: (typeof users)[number] | undefined) => {
    const vals: (string | number)[] = user
      ? [user.name, user.personalNumber, `${user.inBoxTotal}/${user.totalRequired}`, ...user.slotQty.map((q) => (q > 0 ? q : ""))]
      : Array(matrixColCount).fill("");
    for (let c = 0; c < matrixColCount; c++) {
      const col = MATRIX_START_COL + c;
      const cell = ws.getCell(rowIndex, col);
      cell.value = vals[c];
      if (user) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: boxFillRatioToArgb(user.fillRatio) } };
      } else {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9F9FB" } };
      }
      cell.alignment = { ...DATA_ALIGN, horizontal: c < 3 ? "right" : "center" };
      cell.border = BORDER_GRID;
    }
  };

  writeMatrixRow(2, users[0]);

  // ─── Rows 3 .. lastRow ───────────────────────────────────────────────────
  for (let r = 3; r <= lastRow; r++) {
    const slotIdx = r - 3;
    const totalRow = slotIdx >= 0 && slotIdx < S ? totals[slotIdx] : undefined;

    if (totalRow) {
      for (let col = 1; col <= 4; col++) {
        const cell = ws.getCell(r, col);
        if (col === 1) cell.value = totalRow.header;
        if (col === 2) cell.value = totalRow.requiredPerBox;
        if (col === 3) cell.value = totalRow.totalInBoxes;
        if (col === 4) cell.value = totalRow.missing;
        cell.font = { size: 10, color: { argb: "FF18181B" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: slotIdx % 2 === 0 ? "FFFFFFFF" : ZEBRA_ALT },
        };
        cell.alignment = { ...DATA_ALIGN, horizontal: col === 1 ? "right" : "center" };
        cell.border = BORDER_GRID;
      }
    } else if (r === footerRow1) {
      ws.mergeCells(footerRow1, 1, footerRow1, 4);
      const fc = ws.getCell(footerRow1, 1);
      fc.value = `חיילים עם קרטון (נכללו במטריצה ובסיכום): ${usersWithBoxCount}`;
      fc.font = { italic: true, size: 10, color: { argb: "FF52525B" } };
      fc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F4F5" } };
      fc.alignment = { vertical: "middle", horizontal: "right", readingOrder: "rtl", wrapText: true };
      fc.border = BORDER_GRID;
    } else if (r === footerRow2) {
      ws.mergeCells(footerRow2, 1, footerRow2, 4);
      const fc = ws.getCell(footerRow2, 1);
      fc.value =
        excludedWithoutBoxCount > 0
          ? `חיילים פעילים ללא רשומת קרטון (לא מוצגים ולא נספרים): ${excludedWithoutBoxCount}`
          : "כל החיילים הפעילים כוללים רשומת קרטון.";
      fc.font = { italic: true, size: 10, color: { argb: "FF71717A" } };
      fc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
      fc.alignment = { vertical: "middle", horizontal: "right", readingOrder: "rtl", wrapText: true };
      fc.border = BORDER_GRID;
    } else {
      for (let col = 1; col <= 4; col++) {
        const cell = ws.getCell(r, col);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };
        cell.border = BORDER_GRID;
      }
    }

    const user = users[r - 2];
    writeMatrixRow(r, user);
  }

  // Gutter E
  for (let r = 1; r <= lastRow; r++) {
    paintCell(ws, r, 5, "FFF9F9FB");
    ws.getCell(r, 5).border = BORDER_GRID;
  }

  ws.autoFilter = {
    from: { row: 1, column: MATRIX_START_COL },
    to: { row: 1, column: lastMatrixCol },
  };

  const maxHeaderLen = Math.max(...totals.map((t) => t.header.length), 14);
  ws.getColumn(1).width = Math.min(50, Math.max(24, maxHeaderLen + 4));
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 15;
  ws.getColumn(4).width = 9;
  ws.getColumn(5).width = 2.8;

  for (let c = 0; c < matrixColCount; c++) {
    const excelCol = ws.getColumn(MATRIX_START_COL + c);
    if (c === 0) excelCol.width = Math.min(34, Math.max(18, matrixHeaders[c].length + 2));
    else if (c === 1) excelCol.width = 14;
    else if (c === 2) excelCol.width = 20;
    else excelCol.width = Math.min(40, Math.max(14, Math.min(matrixHeaders[c].length + 4, 36)));
  }

  return wb;
}
