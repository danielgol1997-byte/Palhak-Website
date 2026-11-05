import { Role, RequestItemStatus } from "@prisma/client";
import { HomeTile } from "./HomeTile";
import { PendingTransfers } from "./PendingTransfers";
import { MobileTile } from "@/components/MobileTile";
import { NavIcon } from "@/components/layout/NavIcon";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasAtLeastRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const session = await getSession();
  const role = session?.user?.role ?? Role.USER;
  const isAdmin = hasAtLeastRole(role, Role.ADMIN);

  // Pending transfer requests addressed to this user
  const pendingTransfers = session?.user?.id
    ? await prisma.request.findMany({
        where: {
          recipientId: session.user.id,
          items: { some: { status: RequestItemStatus.AWAITING_ACCEPTANCE } },
        },
        include: {
          requester: { select: { id: true, name: true, personalNumber: true } },
          items: {
            where: { status: RequestItemStatus.AWAITING_ACCEPTANCE },
            include: {
              equipmentItem: {
                select: {
                  id: true,
                  name: true,
                  isWeapon: true,
                  isSight: true,
                  isClothing: true,
                  isShoe: true,
                  category: { select: { division: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  const tiles = [
    {
      href: "/requests",
      title: "ציוד",
      subtitle: "בקשת ציוד חדש, הצהרות בלאי/אובדן, החזרות והעברות",
      icon: <NavIcon name="gear" size={32} />,
    },
    {
      href: "/personal",
      title: "אזור אישי",
      subtitle: "הפרטים שלי, הציוד המוקצה והיסטוריית הבקשות",
      icon: <NavIcon name="user" size={32} />,
    },
  ];
  if (isAdmin) {
    tiles.push({
      href: "/admin",
      title: "ניהול",
      subtitle: "משתמשים, מלאי, בקשות, קרטונים וייצוא",
      icon: <NavIcon name="shield" size={32} />,
    });
  }

  const firstName = (session?.user?.name ?? "").trim().split(/\s+/)[0] ?? "";

  return (
    <div className="flex flex-col gap-6 py-2 md:min-h-[calc(100dvh-220px)] md:gap-8 md:py-10">
      {pendingTransfers.length > 0 && (
        <div className="mx-auto w-full max-w-6xl">
          <PendingTransfers pendingTransfers={pendingTransfers} />
        </div>
      )}

      {/* Mobile: greeting + flat list */}
      <section className="md:hidden">
        <div className="mb-4 px-1">
          <p className="text-sm" style={{ color: "var(--t-fg-muted)" }}>שלום{firstName ? `, ${firstName}` : ""} 👋</p>
          <h1 className="text-2xl font-black tracking-tight">מה תרצה לעשות?</h1>
        </div>
        <div className="flex flex-col gap-3">
          {tiles.map((t) => (
            <MobileTile key={t.href} href={t.href} title={t.title} subtitle={t.subtitle} icon={t.icon} />
          ))}
        </div>
      </section>

      {/* Desktop: 3D tilt cards */}
      <div className="hidden items-center justify-center md:flex">
        <div className="grid w-full grid-cols-2 gap-8 lg:max-w-4xl">
          {tiles.map((tile) => (
            <div
              key={tile.href}
              className={`h-64 ${tile.href === "/admin" && tiles.length % 2 !== 0 ? "col-span-2 h-40" : ""}`}
            >
              <HomeTile href={tile.href} title={tile.title} icon={tile.icon} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
