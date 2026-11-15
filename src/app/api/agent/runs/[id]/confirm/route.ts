import { NextResponse } from "next/server";
import { getAgentAccess } from "@/lib/agent/access";
import { RunStateError, confirmAndExecuteRun } from "@/lib/agent/runs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** The operator pressed "אשר ובצע": execute the stored plan and return the receipt. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAgentAccess();
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });
  const { id } = await params;
  try {
    return NextResponse.json({ run: await confirmAndExecuteRun(id, access.actor) });
  } catch (err) {
    if (err instanceof RunStateError) return NextResponse.json({ message: err.message }, { status: 409 });
    console.error("[agent] confirm failed", err);
    return NextResponse.json({ message: "אירעה שגיאה בביצוע התוכנית." }, { status: 500 });
  }
}
