import { prisma } from "@/lib/prisma";
import { parseSort, parseTableQuery } from "@/lib/tableQuery";
import { TableToolbar } from "@/components/table/TableToolbar";
import { requireRole } from "@/lib/auth";
import { Role, Division } from "@prisma/client";
import { Pagination } from "@/components/table/Pagination";
import { divisionLabel } from "@/lib/he";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(Role.ADMIN);
  const resolvedSearchParams = await searchParams;
  const q = parseTableQuery(resolvedSearchParams);
  const division = (resolvedSearchParams.division as string) || undefined;
  const sort = parseSort(q.sort);

  let where: any = { active: true, discontinued: false };
  if (q.q) {
    where.OR = [
          { name: { contains: q.q, mode: "insensitive" as const } },
      { category: { name: { contains: q.q, mode: "insensitive" as const } } },
    ];
      }
  if (division && division !== "ALL") {
    where.category = { ...where.category, division: division as Division };
  }

  const orderBy =
    sort?.field === "name"
      ? ({ name: sort.dir } as const)
      : sort?.field === "division"
        ? ({ category: { division: sort.dir } } as const)
        : ({ name: "asc" as const });

  const [total, rows] = await Promise.all([
    prisma.equipmentItem.count({ where }),
    prisma.equipmentItem.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: {
        id: true,
        name: true,
        category: { select: { division: true } },
        assignments: {
          where: { active: true, status: "ASSIGNED" },
          select: { quantity: true },
        },
        storageInventories: {
          select: { quantity: true },
        },
      },
    }),
  ]);

  const rowsWithTotals = rows.map((item) => {
    const assigned = item.assignments.reduce((sum, a) => sum + a.quantity, 0);
    const inStorage = item.storageInventories.reduce((sum, s) => sum + s.quantity, 0);
    return {
      ...item,
      assigned,
      inStorage,
      total: assigned + inStorage,
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / q.pageSize));

  const divisionLabels = (Object.values(Division) as Division[]).reduce(
    (acc, d) => ({ ...acc, [d]: divisionLabel(d) }),
    {} as Record<Division, string>
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">מלאי כולל</h1>
        <p className="mt-2 text-sm text-zinc-400">מעקב אחר כמויות ציוד משויכות ובמחסן.</p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <div className="flex flex-col gap-6">
          <TableToolbar 
            placeholder="חיפוש לפי שם פריט" 
            showDivisionFilter 
            divisionLabels={divisionLabels} 
          />

          <div className="flex flex-col gap-4">
            {rowsWithTotals.map((item) => (
              <div key={item.id} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-inner transition-all hover:border-zinc-700">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <a href={`/inventory/item/${item.id}`} className="text-lg font-bold hover:underline text-zinc-50 decoration-zinc-500 underline-offset-4">
                      {item.name}
                    </a>
                    <div className="mt-1 text-sm text-zinc-400">
                      {divisionLabel(item.category.division)}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-4 border-t border-zinc-800/50 pt-4">
                      <div className="text-center">
                        <div className="text-xs font-bold text-zinc-500 uppercase">סה״כ</div>
                        <div className="text-xl font-bold text-zinc-50">{item.total}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-bold text-zinc-500 uppercase">משויך</div>
                        <div className="text-xl font-bold text-zinc-100">{item.assigned}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-bold text-zinc-500 uppercase">במחסן</div>
                        <div className="text-xl font-bold text-zinc-100">{item.inStorage}</div>
                      </div>
        </div>
                </div>
                  <a
                    href={`/inventory/item/${item.id}`}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-800 px-4 text-xs font-bold text-zinc-100 transition-all hover:bg-zinc-700 hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    פירוט
                  </a>
                </div>
              </div>
            ))}
            {rowsWithTotals.length === 0 && (
              <div className="py-10 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-3xl border border-zinc-800 border-dashed">
                לא נמצאו פריטים.
              </div>
            )}
          </div>

          <div className="mt-8 border-t border-zinc-800 pt-8">
            <Pagination
              page={q.page}
              totalPages={totalPages}
              searchParams={resolvedSearchParams}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
