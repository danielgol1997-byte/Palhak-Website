import { prisma } from "@/lib/prisma";
import { parseSort, parseTableQuery } from "@/lib/tableQuery";
import { TableToolbar } from "@/components/table/TableToolbar";
import { createPositionAction } from "./actions";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import PositionList from "./PositionList";

export const dynamic = "force-dynamic";

export default async function PositionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(Role.ADMIN);

  const resolvedSearchParams = await searchParams;
  const q = parseTableQuery(resolvedSearchParams);
  const sort = parseSort(q.sort);

  let where: any = {};
  if (q.q) {
    where.OR = [
      { name: { contains: q.q, mode: "insensitive" as const } },
      { department: { name: { contains: q.q, mode: "insensitive" as const } } },
    ];
  }

  const [total, rows, rawDepartments] = await Promise.all([
    prisma.position.count({ where }),
    prisma.position.findMany({
      where,
      orderBy:
        sort?.field === "name"
          ? { name: sort.dir }
          : sort?.field === "department"
            ? { department: { name: sort.dir } }
            : { sortOrder: "asc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: {
        id: true,
        name: true,
        active: true,
        departmentId: true,
        sortOrder: true,
        department: { select: { id: true, name: true } },
      },
    }),
    prisma.department.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Deduplicate by name to handle any potential data oddities causing duplicates in the UI
  const departments = Array.from(
    rawDepartments.reduce((map, dept) => {
      const name = dept.name.trim();
      if (!map.has(name)) map.set(name, dept);
      return map;
    }, new Map<string, typeof rawDepartments[0]>()).values()
  );

  const totalPages = Math.max(1, Math.ceil(total / q.pageSize));

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">תפקידים ({total})</h1>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-50 mb-4">הוספת תפקיד חדש</h2>
        <form action={createPositionAction} className="grid gap-5">
          <div>
            <label className="text-sm font-bold text-zinc-400">שם התפקיד</label>
            <input
              name="name"
              className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all"
              placeholder="לדוגמה: מפקד צוות"
              required
            />
          </div>
          <div>
            <label className="text-sm font-bold text-zinc-400">מחלקה</label>
            <select
              name="departmentId"
              className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
              required
            >
              <option value="" className="bg-zinc-900">בחירת מחלקה...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id} className="bg-zinc-900">
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <button className="h-14 w-full inline-flex items-center justify-center rounded-2xl bg-zinc-50 px-6 text-base font-bold text-zinc-950 shadow-lg shadow-zinc-100/5 transition-all hover:bg-zinc-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer">
            הוספת תפקיד
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-lg font-bold text-zinc-50 mb-2">רשימת תפקידים</h2>
            <div className="text-sm text-zinc-400 mb-6">
              עמוד {q.page} מתוך {totalPages} · סה״כ {total} תפקידים
            </div>
          </div>
          
          <TableToolbar placeholder="חיפוש לפי שם תפקיד או מחלקה" />

          <PositionList 
            initialRows={rows} 
            departments={departments}
            page={q.page}
            totalPages={totalPages}
            total={total}
            searchParams={resolvedSearchParams}
          />
        </div>
      </section>
    </div>
  );
}
