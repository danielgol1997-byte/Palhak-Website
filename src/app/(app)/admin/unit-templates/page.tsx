import { prisma } from "@/lib/prisma";
import { parseSort, parseTableQuery } from "@/lib/tableQuery";
import { TableToolbar } from "@/components/table/TableToolbar";
import { createUnitTemplateAction } from "./actions";
import { requireRole } from "@/lib/auth";
import { Role, Division } from "@prisma/client";
import { divisionLabel } from "@/lib/he";
import UnitTemplateList from "./UnitTemplateList";

export const dynamic = "force-dynamic";

export default async function UnitTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(Role.ADMIN);

  const resolvedSearchParams = await searchParams;
  const q = parseTableQuery(resolvedSearchParams);
  const sort = parseSort(q.sort);

  let where: any = {};
  if (q.q) where.name = { contains: q.q, mode: "insensitive" as const };

  const orderBy = sort?.field === "name" ? ({ name: sort.dir } as const) : ({ name: "asc" as const });

  const rows = await prisma.unitTemplate.findMany({
    where,
    orderBy,
    select: {
      id: true,
      name: true,
      active: true,
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">יחידות ({rows.length})</h1>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-50 mb-4">הוספת יחידה חדשה</h2>
        <form action={createUnitTemplateAction} className="grid gap-5">
          <div>
            <label className="text-sm font-bold text-zinc-400">שם היחידה</label>
            <input
              name="name"
              className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all"
              placeholder="לדוגמה: ווסט חובש"
              required
            />
          </div>
          <button className="h-14 w-full inline-flex items-center justify-center rounded-2xl bg-zinc-50 px-6 text-base font-bold text-zinc-950 shadow-lg shadow-zinc-100/5 transition-all hover:bg-zinc-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer">
            הוספת יחידה
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-lg font-bold text-zinc-50 mb-2">רשימת יחידות</h2>
            <div className="text-sm text-zinc-400 mb-6">סה״כ {rows.length} יחידות</div>
          </div>

          <TableToolbar placeholder="חיפוש לפי שם יחידה" />

          <UnitTemplateList initialRows={rows} />
        </div>
      </section>
    </div>
  );
}
