import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { divisionLabel } from "@/lib/he";

export const dynamic = "force-dynamic";

export default async function InventoryItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  await requireRole(Role.ADMIN);
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const view = resolvedSearchParams.view === "storage" ? "storage" : "soldiers";

  const item = await prisma.equipmentItem.findUnique({
    where: { id: resolvedParams.id },
    select: {
      id: true,
      name: true,
      category: { select: { name: true, division: true } },
    },
  });
  if (!item) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">פריט לא נמצא</h1>
      </div>
    );
  }

  const [storageRows, soldierRows] = await Promise.all([
    prisma.storageInventory.findMany({
      where: { equipmentItemId: item.id },
      orderBy: [{ location: { name: "asc" } }],
      select: { id: true, quantity: true, location: { select: { name: true } } },
    }),
    prisma.assignment.groupBy({
      by: ["userId"],
      where: { equipmentItemId: item.id, status: "ASSIGNED", active: true },
      _sum: { quantity: true },
    }),
  ]);

  const users =
    view === "soldiers" && soldierRows.length
      ? await prisma.user.findMany({
          where: { id: { in: soldierRows.map((r) => r.userId) } },
          select: { id: true, name: true },
        })
      : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <a
          href="/inventory"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold"
        >
          חזרה למלאי
        </a>
        <h1 className="mt-3 text-2xl font-semibold">{item.name}</h1>
        <div className="mt-1 text-sm text-zinc-700">
          {divisionLabel(item.category.division)} · {item.category.name}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <a
            href={`/inventory/item/${item.id}?view=storage`}
            className={`inline-flex h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold ${
              view === "storage"
                ? "bg-zinc-900 text-white"
                : "border border-zinc-200 bg-white"
            }`}
          >
            במחסן
          </a>
          <a
            href={`/inventory/item/${item.id}?view=soldiers`}
            className={`inline-flex h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold ${
              view === "soldiers"
                ? "bg-zinc-900 text-white"
                : "border border-zinc-200 bg-white"
            }`}
          >
            אצל חיילים
          </a>
        </div>
      </section>

      {view === "storage" ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold">מיקומים</h2>
          <div className="mt-4 flex flex-col gap-2">
            {storageRows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2"
              >
                <div className="text-sm font-semibold">{r.location.name}</div>
                <div className="text-sm font-semibold">{r.quantity}</div>
              </div>
            ))}
            {storageRows.length === 0 ? (
              <div className="text-sm text-zinc-700">אין מלאי במחסן.</div>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold">אצל חיילים</h2>
          <div className="mt-4 flex flex-col gap-2">
            {soldierRows.map((r) => (
              <a
                key={r.userId}
                href={`/soldiers/${r.userId}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2"
              >
                <div className="text-sm font-semibold">
                  {userMap.get(r.userId) ?? r.userId}
                </div>
                <div className="text-sm font-semibold">{r._sum.quantity ?? 0}</div>
              </a>
            ))}
            {soldierRows.length === 0 ? (
              <div className="text-sm text-zinc-700">אין ציוד אצל חיילים.</div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}


