"use client";

import { useState, useMemo } from "react";
import { RequestType, RequestStatus, Priority, Division, TransferStatus } from "@prisma/client";
import { EquipmentRequestsTable } from "./EquipmentRequestsTable";
import { ReturnsTable } from "./ReturnsTable";
import { InProgressRequestsTable } from "./InProgressRequestsTable";
import { TransfersTable } from "./TransfersTable";
import { UnifiedTransfersTable } from "./UnifiedTransfersTable";
import { ClosedRequestsTable } from "./ClosedRequestsTable";
import { requestTypeLabel, priorityLabel, divisionLabel } from "@/lib/he";

interface Request {
  id: string;
  type: RequestType;
  status: RequestStatus;
  priority: Priority;
  adminNotes: string | null;
  viewedAt: Date | null;
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
  recipient?: {
    id: string;
    name: string;
    personalNumber: string;
  } | null;
  items: {
    id: string;
    quantity: number;
    status: string;
    serialNumber?: string | null;
    clothingSize?: string | null;
    shoeSize?: string | null;
    equipmentItem: {
      id: string;
      name: string;
      isWeapon?: boolean;
      isSight?: boolean;
      isClothing?: boolean;
      isShoe?: boolean;
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
}) {
  const [activeTab, setActiveTab] = useState<TabType>("equipment");

  // Filter function for requests
  const filterRequests = (requests: Request[]) => {
    if (!searchTerm) return requests;
    
    const search = searchTerm.toLowerCase();
    return requests.filter((req) => {
      const matchesRequester = req.requester.name.toLowerCase().includes(search);
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
      
      return matchesRequester || matchesItem || matchesDivision || matchesType || matchesPriority || matchesNotes || matchesSerial || matchesAssignmentSerial || matchesClothingSize || matchesShoeSize;
    });
  };

  // Filter function for transfers
  const filterTransfers = (transfersList: Transfer[]) => {
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
  };

  // Compute filtered counts
  const filteredCounts = useMemo(() => ({
    equipment: filterRequests(openRequests).length,
    declarations: filterRequests(declarationRequests).length,
    returns: filterRequests(returnRequests).length,
    adminAssignments: filterRequests(adminAssignmentRequests).length,
    transfers: filterRequests(transferRequests).length + filterTransfers(transfers).length,
    inProgress: filterRequests(inProgressRequests).length,
    closed: filterRequests(closedRequests).length,
  }), [openRequests, declarationRequests, returnRequests, transferRequests, adminAssignmentRequests, transfers, inProgressRequests, closedRequests, searchTerm]);

  const tabs = [
    { id: "equipment" as TabType, label: "בקשות ציוד", count: filteredCounts.equipment },
    { id: "declarations" as TabType, label: "הצהרות", count: filteredCounts.declarations },
    { id: "returns" as TabType, label: "החזרת ציוד", count: filteredCounts.returns },
    { id: "adminAssignments" as TabType, label: "ניהול שרירותי", count: filteredCounts.adminAssignments },
    { id: "transfers" as TabType, label: "העברות ציוד", count: filteredCounts.transfers },
    { id: "inProgress" as TabType, label: "בטיפול", count: filteredCounts.inProgress },
    { id: "closed" as TabType, label: "בקשות סגורות", count: filteredCounts.closed },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-sm font-bold transition-all cursor-pointer relative ${
              activeTab === tab.id
                ? "text-zinc-50"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  activeTab === tab.id
                    ? "bg-zinc-50 text-zinc-950"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-50" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "equipment" && <EquipmentRequestsTable requests={openRequests} searchTerm={searchTerm} />}
        {activeTab === "declarations" && <EquipmentRequestsTable requests={declarationRequests} searchTerm={searchTerm} />}
        {activeTab === "returns" && <ReturnsTable requests={returnRequests} searchTerm={searchTerm} />}
        {activeTab === "adminAssignments" && <ClosedRequestsTable requests={adminAssignmentRequests} searchTerm={searchTerm} />}
        {activeTab === "transfers" && <UnifiedTransfersTable transferRequests={transferRequests} oldTransfers={transfers} searchTerm={searchTerm} />}
        {activeTab === "inProgress" && <InProgressRequestsTable requests={inProgressRequests} searchTerm={searchTerm} />}
        {activeTab === "closed" && <ClosedRequestsTable requests={closedRequests} searchTerm={searchTerm} />}
      </div>
    </div>
  );
}

