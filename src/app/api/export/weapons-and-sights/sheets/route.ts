import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireAdminExportSession } from "../../_lib/adminExportAuth";
import { autosizeColumns, styleHeaderRow } from "../../_lib/xlsxStyle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminExportSession();
  if (!auth.ok) return auth.response;

  const [weaponAssignments, sightAssignments] = await Promise.all([
    prisma.assignment.findMany({
      where: { active: true, status: "ASSIGNED", equipmentItem: { isWeapon: true, active: true } },
      orderBy: [{ assignedAt: "desc" }],
      select: {
        serialNumber: true,
        assignedAt: true,
        user: { select: { name: true, personalNumber: true } },
        equipmentItem: { select: { name: true } },
      },
    }),
    prisma.assignment.findMany({
      where: { active: true, status: "ASSIGNED", equipmentItem: { isSight: true, active: true } },
      orderBy: [{ assignedAt: "desc" }],
      select: {
        serialNumber: true,
        assignedAt: true,
        user: { select: { name: true, personalNumber: true } },
        equipmentItem: { select: { name: true } },
      },
    }),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Palhak";
  wb.created = new Date();

  const headers = ["סוג", "מספר סידורי", "משויך ל", "מספר אישי", "תאריך שיוך"];

  const wsWeapons = wb.addWorksheet("נשקים");
  styleHeaderRow(wsWeapons, headers);
  weaponAssignments.forEach((a) => {
    wsWeapons.addRow([
      a.equipmentItem.name,
      a.serialNumber ?? "",
      a.user?.name ?? "",
      a.user?.personalNumber ?? "",
      a.assignedAt ? a.assignedAt.toISOString() : "",
    ]);
  });
  autosizeColumns(wsWeapons);

  const wsSights = wb.addWorksheet("צלמים");
  styleHeaderRow(wsSights, headers);
  sightAssignments.forEach((a) => {
    wsSights.addRow([
      a.equipmentItem.name,
      a.serialNumber ?? "",
      a.user?.name ?? "",
      a.user?.personalNumber ?? "",
      a.assignedAt ? a.assignedAt.toISOString() : "",
    ]);
  });
  autosizeColumns(wsSights);

  const buf = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

  // Same file as Excel – optimized for importing into Google Sheets.
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": "attachment; filename=\"guns-and-sights-google-sheets.xlsx\"",
      "cache-control": "no-store",
    },
  });
}


