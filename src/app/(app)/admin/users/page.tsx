import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { UsersTable } from "./UsersTable";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireRole(Role.ADMIN);

  const hiddenInactiveNames = ["ציון ציוני", "ישראל כהן"];

  const users = await prisma.user.findMany({
    where: {
      NOT: {
        AND: [{ active: false }, { name: { in: hiddenInactiveNames } }],
      },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      personalNumber: true,
      role: true,
      active: true,
      onboardedAt: true,
      createdAt: true,
      _count: { select: { assignments: true } },
      userDepartments: {
        select: {
          department: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">משתמשים ({users.length})</h1>
        <p className="mt-2 text-sm text-zinc-400">
          ניהול משתמשים, הקצאת ציוד ועריכת פרטים אישיים
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <UsersTable users={users} />
      </section>
    </div>
  );
}
