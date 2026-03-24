import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { requireAdminExportSession } from "../../_lib/adminExportAuth";
import {
  buildMatrixColumns,
  buildMatrixDataRow,
  fetchEquipmentBySoldierUsers,
  parseEquipmentLayout,
} from "../../_lib/equipmentBySoldierExport";

export const dynamic = "force-dynamic";

const detailHeader = [
  "שם חייל",
  "מספר אישי",
  "פריט",
  "כמות",
  "סטטוס",
  "מספר סידורי",
  "תאריך שיוך",
  "הוקצה ע״י",
  "מידה (בגד)",
  "מידה (נעל)",
];

export async function GET(request: Request) {
  const auth = await requireAdminExportSession();
  if (!auth.ok) return auth.response;

  const layout = parseEquipmentLayout(request);
  const users = await fetchEquipmentBySoldierUsers();

  if (layout === "matrix") {
    const columns = buildMatrixColumns(users);
    const header = ["שם חייל", "מספר אישי", ...columns.map((c) => c.header)];
    const rows = users.map((u) => {
      const cells = buildMatrixDataRow(u, columns);
      const row: Record<string, string | number> = {};
      header.forEach((h, i) => {
        row[h] = cells[i] as string | number;
      });
      return row;
    });
    const csv = toCsv(rows, header);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=\"equipment-by-soldier.csv\"",
        "cache-control": "no-store",
      },
    });
  }

  const rows = users.flatMap((u) =>
    u.assignments.map((a) => ({
      "שם חייל": u.name,
      "מספר אישי": u.personalNumber ?? "",
      פריט: a.equipmentItem.name,
      כמות: a.quantity,
      סטטוס: a.status,
      "מספר סידורי": a.serialNumber ?? "",
      "תאריך שיוך": a.assignedAt ? a.assignedAt.toISOString() : "",
      "הוקצה ע״י": a.assignedBy?.name ?? "",
      "מידה (בגד)": a.clothingSize ?? "",
      "מידה (נעל)": a.shoeSize ?? "",
    })),
  );

  const csv = toCsv(rows as any, detailHeader);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"equipment-by-soldier.csv\"",
      "cache-control": "no-store",
    },
  });
}
