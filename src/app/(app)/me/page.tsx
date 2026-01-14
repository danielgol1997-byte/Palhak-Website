import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { Role, RequestItemStatus } from "@prisma/client";
import { HomeTile } from "./HomeTile";
import { PendingTransfers } from "./PendingTransfers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? Role.USER;

  // Fetch pending transfer requests for this user
  const pendingTransfers = await prisma.request.findMany({
    where: {
      recipientId: session?.user?.id,
      items: {
        some: {
          status: RequestItemStatus.AWAITING_ACCEPTANCE,
        },
      },
    },
    include: {
      requester: {
        select: {
          id: true,
          name: true,
          personalNumber: true,
        },
      },
      items: {
        where: {
          status: RequestItemStatus.AWAITING_ACCEPTANCE,
        },
        include: {
          equipmentItem: {
            select: {
              id: true,
              name: true,
              isWeapon: true,
              isSight: true,
              isClothing: true,
              isShoe: true,
              category: {
                select: {
                  division: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const tiles = [
    {
      href: "/requests",
      title: "ציוד",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 7h-9M14 17H5M17 11V5M17 19v-3M7 11V5M7 19v-3"/>
        </svg>
      ),
    },
    {
      href: "/personal",
      title: "אזור אישי",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
  ];

  if (role !== Role.USER) {
    tiles.push({
      href: "/admin",
      title: "ניהול",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      ),
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-160px)] flex-col gap-8 py-10">
      {/* Pending Transfers Notification */}
      {pendingTransfers.length > 0 && (
        <div className="w-full max-w-6xl mx-auto px-4">
          <PendingTransfers pendingTransfers={pendingTransfers} />
        </div>
      )}

      {/* Home Tiles */}
      <div className="flex items-center justify-center">
        <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8 lg:max-w-4xl px-4">
          {tiles.map((tile, index) => (
          <div 
            key={tile.href} 
            className={`aspect-square sm:aspect-auto sm:h-64 ${
              tile.href === "/admin" && tiles.length % 2 !== 0 ? "sm:col-span-2 sm:h-40" : ""
            }`}
          >
            <HomeTile {...tile} />
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}

