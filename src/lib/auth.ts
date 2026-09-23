import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { authOptions } from "@/auth";
import { canMutate, hasAtLeastRole, VIEW_ONLY_DENIED_MESSAGE } from "@/lib/rbac";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth");
  return session;
}

export async function requireRole(required: Role) {
  const session = await requireSession();
  if (!hasAtLeastRole(session.user.role, required)) redirect("/");
  return session;
}

function rejectViewOnly(role: Role) {
  if (!canMutate(role)) {
    throw new Error(VIEW_ONLY_DENIED_MESSAGE);
  }
}

/** Signed-in session that is allowed to change data. */
export async function requireMutableSession() {
  const session = await requireSession();
  rejectViewOnly(session.user.role);
  return session;
}

/** Same access check as requireRole, then rejects view-only accounts. */
export async function requireWriteRole(required: Role) {
  const session = await requireRole(required);
  rejectViewOnly(session.user.role);
  return session;
}


