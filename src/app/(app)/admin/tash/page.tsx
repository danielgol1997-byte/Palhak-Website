import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { TashPage } from "./_components/TashPage";

export const dynamic = "force-dynamic";

export default async function TashAdminPage() {
  await requireRole(Role.ADMIN);

  const [items, savedLocations] = await Promise.all([
    prisma.tashItem.findMany({
      include: {
        inventory: {
          orderBy: { location: "asc" },
        },
        logs: {
          orderBy: { createdAt: "desc" },
          take: 200,
          include: {
            performedBy: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.tashLocation.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Always ensure ימ״ח is in the saved list
  const YAMAH = "ימ״ח";
  if (!savedLocations.find((l) => l.name === YAMAH)) {
    const created = await prisma.tashLocation.upsert({
      where: { name: YAMAH },
      create: { name: YAMAH },
      update: {},
    });
    savedLocations.unshift(created);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">ציוד ת״ש</h1>
        <p className="mt-2 text-sm text-zinc-400">כמויות לפי מיקום</p>
      </section>

      <TashPage initialItems={items} initialLocations={savedLocations} />
    </div>
  );
}
