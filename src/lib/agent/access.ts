import { getSession } from "@/lib/auth";
import { isPrivilegedOperator } from "@/lib/rbac";
import type { AgentActor } from "./types";

/** The AI agent is available to privileged operators only (super admin and above). */
export function canUseAgent(role: AgentActor["role"]): boolean {
  return isPrivilegedOperator(role);
}

export type AgentAccess = { ok: true; actor: AgentActor } | { ok: false; status: 401 | 403; message: string };

export async function getAgentAccess(): Promise<AgentAccess> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, status: 401, message: "לא מחובר." };
  if (session.user.active === false || !canUseAgent(session.user.role)) {
    return { ok: false, status: 403, message: "הסוכן זמין למנהלי על בלבד." };
  }
  return { ok: true, actor: { id: session.user.id, name: session.user.name ?? "מנהל", role: session.user.role } };
}
