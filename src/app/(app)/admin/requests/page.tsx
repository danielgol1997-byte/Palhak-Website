import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role, RequestStatus, TransferStatus } from "@prisma/client";
import { RequestTabs } from "./RequestTabs";
import { SearchBar } from "./SearchBar";

export const dynamic = "force-dynamic";

export default async function RequestsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  await requireRole(Role.ADMIN);
  const searchParams = await searchParamsPromise;
  const searchTerm = searchParams.search || "";

  const [equipmentRequests, transfers] = await Promise.all([
    prisma.request.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        type: true,
        status: true,
        priority: true,
        userNotes: true,
        adminNotes: true,
        viewedAt: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        requester: {
          select: {
            id: true,
            name: true,
            assignments: {
              where: {
                active: true,
                // Don't filter by status - we need ALL statuses (ASSIGNED, STOLEN, DAMAGED, etc.)
                // to show serial numbers for declarations and returns
              },
              select: {
                equipmentItemId: true,
                serialNumber: true,
                status: true,
              },
            },
          },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            personalNumber: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            status: true,
            serialNumber: true,
            clothingSize: true,
            shoeSize: true,
            resolvedAt: true,
            resolvedById: true,
            recipientNotes: true,
            recipientAcceptedAt: true,
            resolvedBy: {
              select: {
                id: true,
                name: true,
              },
            },
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
    }),
    prisma.transfer.findMany({
      where: {
        status: {
          in: [
            TransferStatus.PENDING_COMMANDER_APPROVAL,
            TransferStatus.PENDING_RECEIVER_CONFIRMATION,
          ],
        },
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        createdAt: true,
        fromUser: {
          select: {
            id: true,
            name: true,
          },
        },
        toUser: {
          select: {
            id: true,
            name: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          select: {
            quantity: true,
            equipmentItem: {
              select: {
                id: true,
                name: true,
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
    }),
  ]);

  // Split requests into new equipment, declarations, returns, admin assignments, in-progress, and closed
  // The key is: if ANY item is still PENDING, the request is "in progress"
  
  // ניהול שרירותי: הקצאות מנהל + העברות ציוד שבוצעו ע״י מנהל (לא בטאב העברות חיילים)
  const adminAssignmentRequests = equipmentRequests.filter(
    (r) => r.type === "ADMIN_ASSIGNMENT" || r.type === "ADMIN_EQUIPMENT_TRANSFER",
  );

  const regularRequests = equipmentRequests.filter(
    (r) => r.type !== "ADMIN_ASSIGNMENT" && r.type !== "ADMIN_EQUIPMENT_TRANSFER",
  );
  
  const openRequests = regularRequests.filter((r) => {
    if (r.type !== "NEW_EQUIPMENT") return false;
    // Open: NEW_EQUIPMENT with status OPEN and all items are still PENDING (untouched)
    const allItemsPending = r.items.every(item => item.status === "PENDING");
    return r.status === RequestStatus.OPEN && allItemsPending;
  });

  const declarationRequests = regularRequests.filter((r) => {
    // Declarations: DAMAGED, STOLEN, MISSING, USED types
    if (!["DAMAGED", "STOLEN", "MISSING", "USED"].includes(r.type)) return false;
    // Only show if they have pending items or are open
    const allItemsPending = r.items.every(item => item.status === "PENDING");
    return r.status === RequestStatus.OPEN && allItemsPending;
  });
  
  const returnRequests = regularRequests.filter((r) => {
    // Return equipment requests that still have pending items
    if (r.type !== "RETURN_EQUIPMENT") return false;
    const allItemsPending = r.items.every(item => item.status === "PENDING");
    return r.status === RequestStatus.OPEN && allItemsPending;
  });
  
  // Show ALL transfer requests for documentation purposes, regardless of status
  const transferRequests = regularRequests.filter((r) => r.type === "TRANSFER");
  
  const inProgressRequests = regularRequests.filter((r) => {
    // Exclude transfers (they have their own tab)
    if (r.type === "TRANSFER") return false;
    // In progress if: has ANY pending items
    const hasPendingItems = r.items.some(item => item.status === "PENDING");
    return hasPendingItems && r.status !== RequestStatus.OPEN;
  });
  
  const closedRequests = regularRequests.filter((r) => {
    // Exclude transfers (they have their own tab)
    if (r.type === "TRANSFER") return false;
    // Closed only if: NO pending items (all items have been handled)
    const hasPendingItems = r.items.some(item => item.status === "PENDING");
    return !hasPendingItems && r.status !== RequestStatus.OPEN;
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">בקשות</h1>
        <p className="mt-2 text-sm text-zinc-400">ניהול בקשות ציוד והעברות</p>
      </section>

      <SearchBar initialSearch={searchTerm} />

      <RequestTabs
        openRequests={openRequests}
        declarationRequests={declarationRequests}
        returnRequests={returnRequests}
        transferRequests={transferRequests}
        adminAssignmentRequests={adminAssignmentRequests}
        inProgressRequests={inProgressRequests}
        closedRequests={closedRequests}
        transfers={transfers}
        searchTerm={searchTerm}
      />
    </div>
  );
}
