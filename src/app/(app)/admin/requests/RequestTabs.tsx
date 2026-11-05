"use client";

import { useState, useMemo } from "react";
import { RequestType, RequestStatus, Priority, Division, TransferStatus } from "@prisma/client";
import { EquipmentRequestsTable } from "./EquipmentRequestsTable";
import { ReturnsTable } from "./ReturnsTable";
import { InProgressRequestsTable } from "./InProgressRequestsTable";
import { UnifiedTransfersTable } from "./UnifiedTransfersTable";
import { ClosedRequestsTable } from "./ClosedRequestsTable";
import { requestTypeLabel, priorityLabel, divisionLabel } from "@/lib/he";

interface Request {
  id: string;
  type: RequestType;
  status: RequestStatus;
  priority: Priority;
  adminNotes: string | null;
  userNotes: string | null;
  viewedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  requester: {
    id: string;
    name: string;
    assignments?: {
      equipmentItemId: string;
      serialNumber: string | null;
      status: string;
    }[];
  };
  resolvedBy: {
    id: string;
    name: string;
  } | null;
  recipient?: {
    id: string;
    name: string;
    personalNumber: string | null;
  } | null;
  items: {
    id: string;
    quantity: number;
    status: string;
    serialNumber: string | null;
    clothingSize: string | null;
    shoeSize: string | null;
    recipientNotes?: string | null;
    equipmentItem: {
      id: string;
      name: string;
      isWeapon: boolean;
      isSight: boolean;
      isClothing: boolean;
      isShoe: boolean;
      category: {
        division: Division;
      };
    };
  }[];
}

interface Transfer {
  id: string;
  status: TransferStatus;
  createdAt: Date;
  fromUser: {
    id: string;
    name: string;
  };
  toUser: {
    id: string;
    name: string;
  };
  approvedBy: {
    id: string;
    name: string;
  } | null;
  items: {
    quantity: number;
    equipmentItem: {
      id: string;
      name: string;
      category: {
        division: Division;
      };
    };
  }[];
}

// Filter function for requests
function filterRequests(requests: Request[], searchTerm: string): Request[] {
  if (!searchTerm) return requests;
  
  const search = searchTerm.toLowerCase();
  return requests.filter((req) => {
    const matchesRequester = req.requester.name.toLowerCase().includes(search);
    const matchesRecipient = req.recipient?.name.toLowerCase().includes(search) ?? false;
    const matchesItem = req.items.some((item) =>
      item.equipmentItem.name.toLowerCase().includes(search)
    );
    const matchesDivision = req.items.some((item) =>
      divisionLabel(item.equipmentItem.category.division).toLowerCase().includes(search)
    );
    const matchesType = requestTypeLabel(req.type).toLowerCase().includes(search);
    const matchesPriority = priorityLabel(req.priority).toLowerCase().includes(search);
    const matchesNotes = req.adminNotes?.toLowerCase().includes(search);
    const matchesSerial = req.items.some((item) =>
      item.serialNumber?.toLowerCase().includes(search)
    );
    const matchesAssignmentSerial = req.requester.assignments?.some((a) =>
      a.serialNumber?.toLowerCase().includes(search)
    );
    const matchesClothingSize = req.items.some((item) =>
      item.clothingSize?.toLowerCase().includes(search)
    );
    const matchesShoeSize = req.items.some((item) =>
      item.shoeSize?.toLowerCase().includes(search)
    );
    
    return matchesRequester || matchesRecipient || matchesItem || matchesDivision || matchesType || matchesPriority || matchesNotes || matchesSerial || matchesAssignmentSerial || matchesClothingSize || matchesShoeSize;
  });
}

// Filter function for transfers
function filterTransfers(transfersList: Transfer[], searchTerm: string): Transfer[] {
  if (!searchTerm) return transfersList;
  
  const search = searchTerm.toLowerCase();
  return transfersList.filter((transfer) => {
    const matchesFromUser = transfer.fromUser.name.toLowerCase().includes(search);
    const matchesToUser = transfer.toUser.name.toLowerCase().includes(search);
    const matchesItem = transfer.items.some((item) =>
      item.equipmentItem.name.toLowerCase().includes(search)
    );
    const matchesDivision = transfer.items.some((item) =>
      divisionLabel(item.equipmentItem.category.division).toLowerCase().includes(search)
    );
    
    return matchesFromUser || matchesToUser || matchesItem || matchesDivision;
  });
}

type TabType = "equipment" | "declarations" | "returns" | "adminAssignments" | "transfers" | "inProgress" | "closed";

export function RequestTabs({
  openRequests,
  declarationRequests,
  returnRequests,
  transferRequests,
  adminAssignmentRequests,
  inProgressRequests,
  closedRequests,
  transfers,
  searchTerm = "",
  closedCappedNote,
  adminCappedNote,
}: {
  openRequests: Request[];
  declarationRequests: Request[];
  returnRequests: Request[];
  transferRequests: Request[];
  adminAssignmentRequests: Request[];
  inProgressRequests: Request[];
  closedRequests: Request[];
  transfers: Transfer[];
  searchTerm?: string;
  /** Shown under the closed tab when the server capped the list (no search term). */
  closedCappedNote?: string;
  /** Same for the admin-history tab (ניהול שרירותי). */
  adminCappedNote?: string;
}) {
  const [activeTab, setActiveTab] = useState<TabType>("equipment");

  // Compute filtered counts
  const filteredCounts = useMemo(() => ({
    equipment: filterRequests(openRequests, searchTerm).length,
    declarations: filterRequests(declarationRequests, searchTerm).length,
    returns: filterRequests(returnRequests, searchTerm).length,
    adminAssignments: filterRequests(adminAssignmentRequests, searchTerm).length,
    transfers: filterRequests(transferRequests, searchTerm).length + filterTransfers(transfers, searchTerm).length,
    inProgress: filterRequests(inProgressRequests, searchTerm).length,
    closed: filterRequests(closedRequests, searchTerm).length,
  }), [openRequests, declarationRequests, returnRequests, transferRequests, adminAssignmentRequests, transfers, inProgressRequests, closedRequests, searchTerm]);

  // `label` is the full desktop label; `shortLabel` is what phones show (explicit, so no two
  // tabs collapse to the same word).
  const tabs: { id: TabType; label: string; shortLabel: string; count: number }[] = [
    { id: "equipment", label: "בקשות ציוד", shortLabel: "ציוד חדש", count: filteredCounts.equipment },
    { id: "declarations", label: "הצהרות", shortLabel: "הצהרות", count: filteredCounts.declarations },
    { id: "returns", label: "החזרת ציוד", shortLabel: "החזרות", count: filteredCounts.returns },
    { id: "adminAssignments", label: "ניהול שרירותי", shortLabel: "ניהול", count: filteredCounts.adminAssignments },
    { id: "transfers", label: "העברות ציוד", shortLabel: "העברות", count: filteredCounts.transfers },
    { id: "inProgress", label: "בטיפול", shortLabel: "בטיפול", count: filteredCounts.inProgress },
    { id: "closed", label: "בקשות סגורות", shortLabel: "סגורות", count: filteredCounts.closed },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs - horizontal strip (scrolls on phones, hidden scrollbar, snap) */}
      <div
        data-view-ok="true"
        role="tablist"
        className="ui-hscroll border-b border-zinc-800 -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`relative min-h-11 px-3 py-2 sm:px-6 sm:py-3 text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                active ? "text-zinc-50" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                {tab.count > 0 && (
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
                      active ? "bg-zinc-50 text-zinc-950" : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </span>
              {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-50" />}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "equipment" && <EquipmentRequestsTable requests={openRequests} searchTerm={searchTerm} />}
        {activeTab === "declarations" && <EquipmentRequestsTable requests={declarationRequests} searchTerm={searchTerm} />}
        {activeTab === "returns" && <ReturnsTable requests={returnRequests} searchTerm={searchTerm} />}
        {activeTab === "adminAssignments" && <ClosedRequestsTable requests={adminAssignmentRequests} searchTerm={searchTerm} cappedNote={adminCappedNote} />}
        {activeTab === "transfers" && <UnifiedTransfersTable transferRequests={transferRequests} oldTransfers={transfers} searchTerm={searchTerm} />}
        {activeTab === "inProgress" && <InProgressRequestsTable requests={inProgressRequests} searchTerm={searchTerm} />}
        {activeTab === "closed" && <ClosedRequestsTable requests={closedRequests} searchTerm={searchTerm} cappedNote={closedCappedNote} />}
      </div>
    </div>
  );
}

