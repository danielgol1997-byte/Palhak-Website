import type ExcelJS from "exceljs";

export function styleHeaderRow(ws: ExcelJS.Worksheet, headers: string[]) {
  const headerRow = ws.addRow(headers);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFE5E7EB" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF18181B" } };
    cell.border = {
      top: { style: "thin", color: { argb: "FF27272A" } },
      left: { style: "thin", color: { argb: "FF27272A" } },
      bottom: { style: "thin", color: { argb: "FF27272A" } },
      right: { style: "thin", color: { argb: "FF27272A" } },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  ws.views = [{ state: "frozen", ySplit: 1 }];

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };
}

export function autosizeColumns(ws: ExcelJS.Worksheet, maxWidth = 60) {
  (ws.columns ?? []).forEach((col) => {
    if (!col) return;
    let max = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      const s =
        v === null || v === undefined
          ? ""
          : typeof v === "object" && "text" in (v as any)
            ? String((v as any).text)
            : String(v);
      max = Math.max(max, Math.min(maxWidth, s.length + 2));
    });
    col.width = max;
  });
}

export function safeSheetName(name: string) {
  // Excel limits: 31 chars and cannot contain: []:*?/\
  const cleaned = name.replace(/[\[\]\:\*\?\/\\]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 31) || "Sheet";
}


