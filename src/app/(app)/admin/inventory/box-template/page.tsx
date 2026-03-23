import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { BoxTemplateEditor } from "./BoxTemplateEditor";
import { BoxTemplateItemActions } from "./BoxTemplateItemActions";

export const dynamic = "force-dynamic";

const tplSelect = {
  id: true,
  items: {
    orderBy: { equipmentItem: { name: "asc" as const } },
    select: {
      id: true,
      equipmentItemId: true,
      quantity: true,
      equipmentItem: {
        select: {
          name: true,
          category: { select: { division: true, name: true } },
        },
      },
      alternatives: {
        select: {
          id: true,
          equipmentItemId: true,
          equipmentItem: {
            select: { name: true, category: { select: { division: true, name: true } } },
          },
        },
      },
    },
  },
};

export default async function BoxTemplatePage() {
  await requireRole(Role.ADMIN);

  let tpl = await prisma.boxTemplate.findFirst({ select: tplSelect });

  if (!tpl) {
    tpl = await prisma.boxTemplate.create({ data: {}, select: tplSelect });
  }

  const availableItems = await prisma.equipmentItem.findMany({
    where: { active: true, category: { active: true } },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      category: { select: { division: true, name: true } },
    },
  });

  const totalQuantity = tpl.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">תבנית קרטון</h1>
        <p className="mt-2 text-sm text-zinc-400">
          הגדרת הפריטים שצריכים להיות בכל קרטון. סה״כ {tpl.items.length} סוגי פריטים ({totalQuantity} יחידות).
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-50 mb-4">הוספת פריטים לתבנית</h2>
        <BoxTemplateEditor availableItems={availableItems} />
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-50 mb-4">תכולת התבנית</h2>
        <div className="flex flex-col gap-4">
          {tpl.items.map((i) => (
            <BoxTemplateItemActions
              key={i.id}
              templateItemId={i.id}
              equipmentItemId={i.equipmentItemId}
              itemName={i.equipmentItem.name}
              division={i.equipmentItem.category.division}
              categoryName={i.equipmentItem.category.name}
              quantity={i.quantity}
              alternatives={i.alternatives.map((a) => ({
                id: a.id,
                equipmentItemId: a.equipmentItemId,
                name: a.equipmentItem.name,
                division: a.equipmentItem.category.division,
                categoryName: a.equipmentItem.category.name,
              }))}
              availableItems={availableItems}
            />
          ))}
          {tpl.items.length === 0 && (
            <div className="py-10 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-3xl border border-zinc-800 border-dashed">
              טרם הוגדרה תכולה לתבנית הקרטון.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
