import { prisma } from "@/lib/prisma";
import { parseSort, parseTableQuery } from "@/lib/tableQuery";
import { createItemAction } from "./actions";
import { requireRole } from "@/lib/auth";
import { Role, Division } from "@prisma/client";
import ItemList from "./ItemList";
import { divisionLabel } from "@/lib/he";

export const dynamic = "force-dynamic";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(Role.ADMIN);

  const resolvedSearchParams = await searchParams;
  const q = parseTableQuery(resolvedSearchParams);
  const division = (resolvedSearchParams.division as string) || undefined;
  const sort = parseSort(q.sort);

  let where: any = {};
  if (q.q) {
    where.OR = [
      { name: { contains: q.q, mode: "insensitive" as const } },
      { category: { name: { contains: q.q, mode: "insensitive" as const } } },
    ];
  }
  if (division && division !== "ALL") {
    where.category = { ...where.category, division: division as Division };
  }

  const [total, rows] = await Promise.all([
    prisma.equipmentItem.count({ where }),
    prisma.equipmentItem.findMany({
      where,
      orderBy:
        sort?.field === "name"
          ? { name: sort.dir }
          : sort?.field === "division"
            ? { category: { division: sort.dir } }
            : { name: "asc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: {
        id: true,
        name: true,
        active: true,
        discontinued: true,
        categoryId: true,
        isWeapon: true,
        isSight: true,
        isClothing: true,
        isShoe: true,
        category: { select: { id: true, name: true, division: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / q.pageSize));

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">פריטי ציוד ({total})</h1>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-50 mb-4">הוספת פריט חדש</h2>
        <form action={createItemAction} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-zinc-400">חלוקה</label>
              <select
                name="division"
                className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
                required
              >
                {(Object.values(Division) as Division[]).map((d) => (
                  <option key={d} value={d} className="bg-zinc-900">
                    {divisionLabel(d)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-zinc-400">שם הפריט</label>
              <input
                name="name"
                className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500"
                placeholder="לדוגמה: מפתח ברגים 10 מ״מ"
                required
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-bold text-zinc-400 mb-3 block">סמן אם רלוונטי לפריט</label>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950 cursor-pointer hover:border-zinc-700 transition-colors">
                <input
                  type="checkbox"
                  name="isWeapon"
                  value="true"
                  className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-zinc-50 focus:ring-2 focus:ring-zinc-500 cursor-pointer"
                />
                <span className="text-sm text-zinc-50">נשק</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950 cursor-pointer hover:border-zinc-700 transition-colors">
                <input
                  type="checkbox"
                  name="isSight"
                  value="true"
                  className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-zinc-50 focus:ring-2 focus:ring-zinc-500 cursor-pointer"
                />
                <span className="text-sm text-zinc-50">צלמ</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950 cursor-pointer hover:border-zinc-700 transition-colors">
                <input
                  type="checkbox"
                  name="isClothing"
                  value="true"
                  className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-zinc-50 focus:ring-2 focus:ring-zinc-500 cursor-pointer"
                />
                <span className="text-sm text-zinc-50">בגד</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950 cursor-pointer hover:border-zinc-700 transition-colors">
                <input
                  type="checkbox"
                  name="isShoe"
                  value="true"
                  className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-zinc-50 focus:ring-2 focus:ring-zinc-500 cursor-pointer"
                />
                <span className="text-sm text-zinc-50">נעליים</span>
              </label>
            </div>
          </div>
          <button className="h-14 w-full inline-flex items-center justify-center rounded-2xl bg-zinc-50 px-6 text-base font-bold text-zinc-950 shadow-lg shadow-zinc-100/5 transition-all hover:bg-zinc-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer">
            הוספת פריט
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-lg font-bold text-zinc-50 mb-2">רשימת פריטים</h2>
            <div className="text-sm text-zinc-400">
              עמוד {q.page} מתוך {totalPages} · סה״כ {total} פריטים
            </div>
          </div>

          <ItemList 
            initialRows={rows} 
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
