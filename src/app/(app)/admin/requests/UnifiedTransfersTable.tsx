"use client";

import { useState } from "react";
import { RequestDetailModal } from "./RequestDetailModal";

interface UnifiedTransfersTableProps {
  transferRequests: any[];
  oldTransfers: any[];
  searchTerm?: string;
}

export function UnifiedTransfersTable({ transferRequests, oldTransfers, searchTerm = "" }: UnifiedTransfersTableProps) {
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filter and sort transferRequests
  const filteredRequests = transferRequests.filter((req) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      req.requester.name.toLowerCase().includes(search) ||
      req.recipient?.name.toLowerCase().includes(search) ||
      req.items.some((item: any) => item.equipmentItem.name.toLowerCase().includes(search))
    );
  });

  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const direction = sortDirection === "asc" ? 1 : -1;
    
    if (sortField === "requester") {
      return direction * a.requester.name.localeCompare(b.requester.name, "he");
    }
    if (sortField === "recipient") {
      return direction * (a.recipient?.name || "").localeCompare(b.recipient?.name || "", "he");
    }
    if (sortField === "createdAt") {
      return direction * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    if (sortField === "status") {
      return direction * (a.status || "").localeCompare(b.status || "", "he");
    }
    
    return 0;
  });

  // Note: oldTransfers would be displayed similarly if we need to show them
  // For now focusing on the new transferRequests

  const SortIcon = ({ field }: { field: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="inline-flex items-center gap-1 hover:text-zinc-50 transition-colors"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={sortField === field ? "text-zinc-50" : "text-zinc-600"}
      >
        <path d="M12 5v14M19 12l-7 7-7-7" />
      </svg>
    </button>
  );

  const getStatusText = (request: any) => {
    const awaitingCount = request.items.filter((i: any) => i.status === "AWAITING_ACCEPTANCE").length;
    const acceptedCount = request.items.filter((i: any) => i.status === "ACCEPTED").length;
    const rejectedCount = request.items.filter((i: any) => i.status === "REJECTED_BY_RECIPIENT").length;
    const pendingCount = request.items.filter((i: any) => i.status === "PENDING").length;

    if (pendingCount > 0) return "ממתין לאישור מנהל";
    if (awaitingCount > 0) return "ממתין לקליטה";
    if (acceptedCount === request.items.length) return "הועבר בהצלחה";
    if (rejectedCount > 0 && acceptedCount > 0) return "הועבר חלקית";
    if (rejectedCount === request.items.length) return "נדחה";
    return "טופל";
  };

  const getStatusColor = (request: any) => {
    const awaitingCount = request.items.filter((i: any) => i.status === "AWAITING_ACCEPTANCE").length;
    const pendingCount = request.items.filter((i: any) => i.status === "PENDING").length;

    if (pendingCount > 0) return "text-yellow-400";
    if (awaitingCount > 0) return "text-purple-400";
    return "text-zinc-400";
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {sortedRequests.length === 0 ? (
        <div className="py-12 text-center text-zinc-500 text-sm">אין העברות ציוד</div>
      ) : (
        <>
          {/* Table Header */}
          <div className="grid grid-cols-[2fr_2fr_1fr_3fr_1.5fr] gap-4 bg-zinc-950 px-6 py-4 text-right text-xs font-bold text-zinc-400 border-b border-zinc-800">
            <div className="flex items-center gap-1">
              מעביר <SortIcon field="requester" />
            </div>
            <div className="flex items-center gap-1">
              מקבל <SortIcon field="recipient" />
            </div>
            <div>פריטים</div>
            <div className="flex items-center gap-1">
              תאריך <SortIcon field="createdAt" />
            </div>
            <div className="flex items-center gap-1">
              סטטוס <SortIcon field="status" />
            </div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-zinc-800">
            {sortedRequests.map((request) => (
              <button
                key={request.id}
                onClick={() => setSelectedRequest(request)}
                className="grid grid-cols-[2fr_2fr_1fr_3fr_1.5fr] gap-4 px-6 py-4 text-right hover:bg-zinc-800/50 transition-all w-full cursor-pointer"
              >
                <div className="font-semibold text-zinc-50 text-sm truncate">
                  {request.requester.name}
                </div>
                <div className="font-semibold text-zinc-50 text-sm truncate">
                  {request.recipient?.name || "—"}
                </div>
                <div className="text-zinc-400 text-sm">
                  {request.items.length}
                </div>
                <div className="text-zinc-400 text-xs">
                  {new Date(request.createdAt).toLocaleDateString("he-IL", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className={`text-xs font-bold ${getStatusColor(request)}`}>
                  {getStatusText(request)}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </div>
  );
}

