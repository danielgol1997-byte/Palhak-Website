import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role, AssignmentStatus, Division } from "@prisma/client";
import { assignmentStatusLabel, divisionLabel } from "@/lib/he";
import {
  adminAddAssignmentAction,
  adminRemoveAssignmentAction,
  adminUpdateAssignmentAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function SoldierPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(Role.ADMIN);
  const resolvedParams = await params;

  const [user, items] = await Promise.all([
    prisma.user.findUnique({
      where: { id: resolvedParams.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        userDepartments: { select: { department: { select: { name: true } } } },
        userPositions: { select: { position: { select: { name: true } } } },
      },
    }),
    prisma.equipmentItem.findMany({
      where: { active: true },
      orderBy: [{ category: { division: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, category: { select: { division: true } } },
      take: 2000,
    }),
  ]);

  if (!user) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">חייל לא נמצא</h1>
      </div>
    );
  }

  const assignments = await prisma.assignment.findMany({
    where: { userId: user.id },
    orderBy: [{ active: "desc" }, { assignedAt: "desc" }],
    select: {
      id: true,
      quantity: true,
      status: true,
      active: true,
      assignedAt: true,
      serialNumber: true,
      equipmentItem: {
        select: {
          id: true,
          name: true,
          isWeapon: true,
          isSight: true,
          category: { select: { division: true } },
        },
      },
    },
  });

  const deptNames = user.userDepartments.map((d) => d.department.name).join(", ");
  const posNames = user.userPositions.map((p) => p.position.name).join(", ");

  const itemsByDivision = new Map<Division, typeof items>();
  for (const item of items) {
    const div = item.category.division;
    const list = itemsByDivision.get(div) ?? [];
    list.push(item);
    itemsByDivision.set(div, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <a
          href="/soldiers"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-800 px-4 text-sm font-bold text-zinc-100 transition-all hover:bg-zinc-700 cursor-pointer mb-4"
        >
          ← חזרה לחיילים
        </a>
        <h1 className="text-2xl font-bold text-zinc-50">{user.name}</h1>
        <div className="mt-1 text-sm text-zinc-400">{user.email}</div>
        <div className="mt-2 text-sm text-zinc-400">
          מחלקות: {deptNames || "לא הוגדר"} · תפקידים: {posNames || "לא הוגדר"}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-50 mb-4">הוספת ציוד</h2>
        <form action={adminAddAssignmentAction} className="grid gap-5">
          <input type="hidden" name="userId" value={user.id} />
          <div>
            <label className="text-sm font-bold text-zinc-400">פריט</label>
            <select
              name="equipmentItemId"
              className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
              required
            >
              <option value="" className="bg-zinc-900">בחר פריט</option>
              {Array.from(itemsByDivision.entries()).map(([div, divItems]) => (
                <optgroup key={div} label={divisionLabel(div)} className="bg-zinc-900 text-zinc-50 font-bold">
                  {divItems.map((i) => (
                    <option key={i.id} value={i.id} className="bg-zinc-900 font-normal">
                        {i.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
          <div>
              <label className="text-sm font-bold text-zinc-400">כמות</label>
            <input
              name="quantity"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={1}
                className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500"
              required
            />
          </div>
          <div>
              <label className="text-sm font-bold text-zinc-400">סטטוס</label>
            <select
              name="status"
              defaultValue={AssignmentStatus.ASSIGNED}
                className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
            >
              {(Object.values(AssignmentStatus) as AssignmentStatus[]).map((s) => (
                  <option key={s} value={s} className="bg-zinc-900">
                  {assignmentStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          </div>
          <button className="h-14 w-full inline-flex items-center justify-center rounded-2xl bg-zinc-50 px-6 text-base font-bold text-zinc-950 shadow-lg shadow-zinc-100/5 transition-all hover:bg-zinc-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer">
            שמירה
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-50 mb-4">ציוד רשום</h2>
        <div className="flex flex-col gap-4">
          {assignments.map((a) => (
            <div key={a.id} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-inner">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-zinc-50">{a.equipmentItem.name}</div>
                  <div className="mt-1 text-sm text-zinc-400">
                    {divisionLabel(a.equipmentItem.category.division)}
              </div>
                  <div className="mt-2 text-sm text-zinc-100 flex flex-wrap gap-x-4 gap-y-1">
                    <span>סטטוס: <span className="font-bold">{assignmentStatusLabel(a.status)}</span></span>
                    <span>כמות: <span className="font-bold">{a.quantity}</span></span>
                    {(a.equipmentItem.isWeapon || a.equipmentItem.isSight) && (
                      <span>מס׳ סידורי: {a.serialNumber ? (
                        <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-800">{a.serialNumber}</span>
                      ) : (
                        <span className="text-zinc-600">לא זמין</span>
                      )}</span>
                    )}
                    <span className={a.active ? "text-emerald-500" : "text-red-500"}>
                {a.active ? "פעיל" : "לא פעיל"}
                    </span>
              </div>
                  <div className="mt-1 text-xs text-zinc-500">
                עודכן: {a.assignedAt.toLocaleString("he-IL")}
                  </div>
                </div>
              </div>

              <details className="group mt-6">
                <summary className="cursor-pointer text-sm font-bold text-zinc-400 hover:text-zinc-50 transition-colors list-none flex items-center gap-2">
                  <span className="transition-transform group-open:rotate-180">▼</span>
                  עריכת שיוך
                </summary>
                <div className="mt-6 pt-6 border-t border-zinc-800">
                  <form action={adminUpdateAssignmentAction} className="grid gap-5">
                  <input type="hidden" name="assignmentId" value={a.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                        <label className="text-sm font-bold text-zinc-400">כמות</label>
                    <input
                      name="quantity"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      defaultValue={a.quantity}
                          className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500"
                      required
                    />
                  </div>
                  <div>
                        <label className="text-sm font-bold text-zinc-400">סטטוס</label>
                    <select
                      name="status"
                      defaultValue={a.status}
                          className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
                    >
                      {(Object.values(AssignmentStatus) as AssignmentStatus[]).map((s) => (
                            <option key={s} value={s} className="bg-zinc-900">{assignmentStatusLabel(s)}</option>
                      ))}
                    </select>
                      </div>
                  </div>
                  <div>
                      <label className="text-sm font-bold text-zinc-400">פעיל</label>
                    <select
                      name="active"
                      defaultValue={String(a.active)}
                        className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
                    >
                        <option value="true" className="bg-zinc-900">פעיל</option>
                        <option value="false" className="bg-zinc-900">לא פעיל</option>
                    </select>
                  </div>
                    <button className="h-12 w-full inline-flex items-center justify-center rounded-xl bg-zinc-800 text-sm font-bold text-zinc-50 hover:bg-zinc-700 transition-all active:scale-95 cursor-pointer shadow-md">
                    עדכון
                  </button>
                </form>

                  <form action={adminRemoveAssignmentAction} className="mt-3">
                  <input type="hidden" name="assignmentId" value={a.id} />
                    <button className="h-12 w-full inline-flex items-center justify-center rounded-xl border border-red-900/50 bg-red-950/20 text-sm font-bold text-red-500 hover:bg-red-950/40 transition-all cursor-pointer">
                      הסרה סופית (השבתה)
                  </button>
                </form>
                </div>
              </details>
            </div>
          ))}

          {assignments.length === 0 && (
            <div className="text-sm text-zinc-500 py-10 text-center bg-zinc-950/50 rounded-3xl border border-zinc-800 border-dashed">אין ציוד רשום לחייל זה.</div>
          )}
        </div>
      </section>
    </div>
  );
}
