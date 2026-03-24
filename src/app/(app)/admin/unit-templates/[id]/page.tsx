import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role, Division } from "@prisma/client";
import { divisionLabel } from "@/lib/he";
import {
  addUnitTemplateItemAction,
  removeUnitTemplateItemAction,
  updateUnitTemplateAction,
} from "../actions";
import { UnitEditor } from "./UnitEditor";

export const dynamic = "force-dynamic";

export default async function UnitTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(Role.ADMIN);
  const resolvedParams = await params;

  const tpl = await prisma.unitTemplate.findUnique({
    where: { id: resolvedParams.id },
    select: {
      id: true,
      name: true,
      active: true,
      items: {
        orderBy: { equipmentItem: { name: "asc" } },
        select: {
          equipmentItemId: true,
          quantityRequired: true,
          equipmentItem: {
            select: { name: true, category: { select: { division: true } } },
          },
        },
      },
    },
  });

  if (!tpl) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">יחידה לא נמצאה</h1>
      </div>
    );
  }

  const availableItems = await prisma.equipmentItem.findMany({
    where: { active: true, discontinued: false, category: { active: true } },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      category: {
        select: {
          division: true,
          name: true,
        },
      },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <a
          href="/admin/unit-templates"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-800 px-4 text-sm font-bold text-zinc-100 transition-all hover:bg-zinc-700 cursor-pointer mb-4"
        >
          ← חזרה ליחידות
        </a>
        <h1 className="text-2xl font-bold text-zinc-50">{tpl.name}</h1>
        <div className="mt-1 text-sm text-zinc-400">
          {tpl.active ? "פעיל" : "לא פעיל"}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-50 mb-4">פרטי יחידה</h2>
        <form action={updateUnitTemplateAction} className="grid gap-5">
          <input type="hidden" name="id" value={tpl.id} />
          <div>
            <label className="text-sm font-bold text-zinc-400">שם היחידה</label>
            <input
              name="name"
              defaultValue={tpl.name}
              className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="text-sm font-bold text-zinc-400">סטטוס</label>
            <select
              name="active"
              defaultValue={String(tpl.active)}
              className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
            >
              <option value="true" className="bg-zinc-900">פעיל</option>
              <option value="false" className="bg-zinc-900">לא פעיל</option>
            </select>
          </div>
          <button className="h-14 w-full inline-flex items-center justify-center rounded-2xl bg-zinc-50 px-6 text-base font-bold text-zinc-950 shadow-lg shadow-zinc-100/5 transition-all hover:bg-zinc-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer">
            עדכון פרטים
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-50 mb-4">הוספת פריטים לתבנית</h2>
        <UnitEditor unitTemplateId={tpl.id} availableItems={availableItems} />
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-50 mb-4">תכולת היחידה</h2>
        <div className="flex flex-col gap-4">
          {tpl.items.map((i) => (
            <div
              key={i.equipmentItemId}
              className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-inner"
            >
              <div className="flex flex-col gap-6">
                <div className="min-w-0">
                  <div className="text-lg font-bold text-zinc-50">
                    {i.equipmentItem.name}
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  <form action={addUnitTemplateItemAction} className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <input type="hidden" name="unitTemplateId" value={tpl.id} />
                    <input type="hidden" name="equipmentItemId" value={i.equipmentItemId} />
                    <div className="flex-1">
                      <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">כמות</label>
                      <input
                        name="quantityRequired"
                        type="number"
                        min={1}
                        defaultValue={i.quantityRequired}
                        className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
                        required
                      />
                    </div>
                    <button className="h-12 px-6 self-end rounded-xl bg-zinc-800 text-sm font-bold text-zinc-100 hover:bg-zinc-700 transition-all cursor-pointer">
                      עדכן
                    </button>
                  </form>
                  
                  <form action={removeUnitTemplateItemAction} className="self-end">
                    <input type="hidden" name="unitTemplateId" value={tpl.id} />
                    <input type="hidden" name="equipmentItemId" value={i.equipmentItemId} />
                    <button className="h-12 px-6 rounded-xl border border-red-900/50 bg-red-950/20 text-sm font-bold text-red-500 hover:bg-red-950/40 transition-all cursor-pointer">
                      הסרה
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
          {tpl.items.length === 0 && (
            <div className="py-10 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-3xl border border-zinc-800 border-dashed">
              טרם הוגדרה תכולה ליחידה זו.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
