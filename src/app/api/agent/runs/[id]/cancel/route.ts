import { NextResponse } from "next/server";
import { getAgentAccess } from "@/lib/agent/access";
import { RunStateError, cancelRun } from "@/lib/agent/runs";

export const dynamic = "force-dynamic";

/** The operator pressed "בטל": the plan can no longer be confirmed. Nothing was executed. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAgentAccess();
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });
  const { id } = await params;
  try {
    return NextResponse.json({ run: await cancelRun(id, access.actor) });
  } catch (err) {
    if (err instanceof RunStateError) return NextResponse.json({ message: err.message }, { status: 404 });
    console.error("[agent] cancel failed", err);
    return NextResponse.json({ message: "אירעה שגיאה." }, { status: 500 });
  }
}
