import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { authOptions } from "@/auth";
import { hasAtLeastRole } from "@/lib/rbac";

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


