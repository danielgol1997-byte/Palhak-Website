import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { parseTableQuery } from "@/lib/tableQuery";
import { TableToolbar } from "@/components/table/TableToolbar";

export const dynamic = "force-dynamic";

export default async function SoldiersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(Role.ADMIN);
  const resolvedSearchParams = await searchParams;
  const q = parseTableQuery(resolvedSearchParams);

  const rawDepartments = await prisma.department.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  // Deduplicate departments by name to handle any potential data oddities
  const departments = rawDepartments.reduce((acc, curr) => {
    if (!acc.some(d => d.name.trim() === curr.name.trim())) {
      acc.push(curr);
    }
    return acc;
  }, [] as typeof rawDepartments);

  const users = await prisma.user.findMany({
    where: {
      active: true,
      ...(q.q
        ? { OR: [{ name: { contains: q.q, mode: "insensitive" as const } }] }
        : {}),
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      userDepartments: { select: { departmentId: true } },
    },
    take: 1000,
  });

  const byDept = new Map<string, Array<{ id: string; name: string }>>();
  const noDept: Array<{ id: string; name: string }> = [];

  for (const u of users) {
    if (!u.userDepartments.length) {
      noDept.push({ id: u.id, name: u.name });
      continue;
    }
    for (const ud of u.userDepartments) {
      const arr = byDept.get(ud.departmentId) ?? [];
      arr.push({ id: u.id, name: u.name });
      byDept.set(ud.departmentId, arr);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">חיילים</h1>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <div className="flex flex-col gap-6">
          <TableToolbar placeholder="חיפוש לפי שם" />

          <div className="flex flex-col gap-6">
            {departments.map((d) => {
              const list = (byDept.get(d.id) ?? []).sort((a, b) =>
                a.name.localeCompare(b.name, "he"),
              );
              if (!list.length) return null;
              return (
                <div
                  key={d.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
                >
                  <h2 className="text-xl font-bold text-zinc-50 mb-4">{d.name}</h2>
                  <div className="flex flex-col gap-2">
                    {list.map((u) => (
                      <a
                        key={u.id}
                        href={`/soldiers/${u.id}`}
                        className="flex min-h-14 items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-5 text-base font-bold text-zinc-50 transition-all hover:bg-zinc-800 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                      >
                        <span className="truncate">{u.name}</span>
                        <span className="text-zinc-500">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}

            {noDept.length ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                <h2 className="text-xl font-bold text-zinc-50 mb-4">ללא מחלקה</h2>
                <div className="flex flex-col gap-2">
                  {noDept.map((u) => (
                    <a
                      key={u.id}
                      href={`/soldiers/${u.id}`}
                      className="flex min-h-14 items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-5 text-base font-bold text-zinc-50 transition-all hover:bg-zinc-800 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                    >
                      <span className="truncate">{u.name}</span>
                      <span className="text-zinc-500">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {departments.length === 0 && users.length === 0 ? (
              <div className="p-10 text-center shadow-sm">
                <div className="text-sm text-zinc-500 bg-zinc-950/50 rounded-2xl py-10 border border-zinc-800 border-dashed">אין נתונים להצגה.</div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
