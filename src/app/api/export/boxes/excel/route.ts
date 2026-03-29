import { NextResponse } from "next/server";
import { requireAdminExportSession } from "../../_lib/adminExportAuth";
import { buildBoxMatrixWorkbook } from "../../_lib/buildBoxMatrixWorkbook";
import { fetchBoxMatrixExport } from "../../_lib/boxMatrixExport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const wb = buildBoxMatrixWorkbook(data);
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
