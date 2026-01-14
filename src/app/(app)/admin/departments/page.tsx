import { prisma } from "@/lib/prisma";
import { TableToolbar } from "@/components/table/TableToolbar";
import { createDepartmentAction } from "./actions";
import { Division } from "@prisma/client";
import DepartmentList from "./DepartmentList";

export const dynamic = "force-dynamic";

function divisionLabel(d: Division): string {
  switch (d) {
    case Division.COMBAT:
      return "ציוד קרבי";
    case Division.LOGISTICS:
      return "ציוד משקי";
    case Division.MEDICAL:
      return "ציוד רפואי";
  }
}

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : "";

  let where: any = {};
  if (query) {
    where.name = { contains: query, mode: "insensitive" as const };
  }

  const rows = await prisma.department.findMany({
    where,
    orderBy: { sortOrder: "asc" },
    include: { divisions: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">ניהול מחלקות</h1>
        <div className="mt-6">
          <TableToolbar placeholder="חיפוש לפי שם מחלקה" />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-50 mb-4">הוספת מחלקה חדשה</h2>
        <form action={createDepartmentAction} className="grid gap-5">
          <div>
            <label className="text-sm font-bold text-zinc-400">שם המחלקה</label>
            <input
              name="name"
              className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all"
              placeholder="לדוגמה: מפלג חובשים"
              required
            />
          </div>
          <div>
            <label className="text-sm font-bold text-zinc-400 mb-3 block">חלוקות רלוונטיות</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.values(Division).map((div) => (
                <label
                  key={div}
                  className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 cursor-pointer transition-all hover:bg-zinc-800"
                >
                  <input
                    type="checkbox"
                    name="divisions"
                    value={div}
                    className="h-5 w-5 rounded border-zinc-700 bg-zinc-800 text-zinc-50"
                  />
                  <span className="text-sm font-medium text-zinc-100">{divisionLabel(div)}</span>
                </label>
              ))}
            </div>
          </div>
          <button className="h-14 w-full inline-flex items-center justify-center rounded-2xl bg-zinc-50 px-6 text-base font-bold text-zinc-950 shadow-lg shadow-zinc-100/5 transition-all hover:bg-zinc-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer">
            שמירת מחלקה
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-zinc-50">רשימה</h2>
          <div className="text-xs text-zinc-500 italic">ניתן לגרור מחלקות כדי לשנות את סדר הופעתן</div>
        </div>
        <div className="text-sm text-zinc-400 mb-6">סה״כ {rows.length} מחלקות</div>

        <DepartmentList initialRows={rows} />
      </section>
    </div>
  );
}
