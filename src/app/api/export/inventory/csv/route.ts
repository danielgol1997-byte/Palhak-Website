import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { requireAdminExportSession } from "../../_lib/adminExportAuth";
import { getYamahRowsWithTotals } from "../_lib/inventoryRows";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminExportSession();
  if (!auth.ok) return auth.response;

  const rows = await getYamahRowsWithTotals();
  const header = ["פריט", "חלוקה", "במלאי", "מוקצה (תקין)", "בלאי", "שומש", "אבד/נגנב", "סה״כ"];

  const csv = toCsv(
    rows.map((r) => ({
      פריט: r.equipmentItemName,
      חלוקה: r.division,
      "במלאי": r.inStorage,
      "מוקצה (תקין)": r.assignedHealthy,
      בלאי: r.damaged,
      שומש: r.used,
      "אבד/נגנב": r.stolenOrLost,
      "סה״כ": r.total,
    })) as any,
    header,
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"inventory.csv\"",
      "cache-control": "no-store",
    },
  });
}


