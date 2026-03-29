import { NextResponse } from "next/server";
import { requireAdminExportSession } from "../../_lib/adminExportAuth";
import { BOX_MATRIX_SUMMARY_NOTE, fetchBoxMatrixExport } from "../../_lib/boxMatrixExport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

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

  const { slots, users, totals, usersWithBoxCount, excludedWithoutBoxCount } = data;
  const headers = [
    "שם",
    "מספר אישי",
    "מילוי (בקרטון/נדרש)",
    ...slots.map((s) => s.header),
  ];

  const lines: string[] = [];
  lines.push(csvEscape(BOX_MATRIX_SUMMARY_NOTE));
  lines.push(["פריט (תא בקרטון)", "נדרש לקרטון", "סה״כ בקרטונים", "חסר"].map(csvEscape).join(","));
  for (const t of totals) {
    lines.push(
      [t.header, String(t.requiredPerBox), String(t.totalInBoxes), String(t.missing)]
        .map(csvEscape)
        .join(","),
    );
  }
  lines.push(csvEscape(`חיילים עם קרטון: ${usersWithBoxCount}`));
  lines.push(
    csvEscape(
      excludedWithoutBoxCount > 0
        ? `חיילים ללא קרטון (לא נכללו): ${excludedWithoutBoxCount}`
        : "כל החיילים הפעילים כוללים קרטון.",
    ),
  );
  lines.push("");
  lines.push(headers.map(csvEscape).join(","));
  for (const u of users) {
    const cells = [
      u.name,
      u.personalNumber,
      `${u.inBoxTotal}/${u.totalRequired}`,
      ...u.slotQty.map((q) => (q > 0 ? String(q) : "")),
    ];
    lines.push(cells.map(csvEscape).join(","));
  }

  const body = "\uFEFF" + lines.join("\r\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="cardboard-boxes.csv"',
      "cache-control": "no-store",
    },
  });
}
