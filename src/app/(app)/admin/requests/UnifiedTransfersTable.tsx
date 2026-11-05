"use client";

import { useState } from "react";
import { RequestDetailModal } from "./RequestDetailModal";

interface UnifiedTransfersTableProps {
  transferRequests: any[];
  oldTransfers: any[];
  searchTerm?: string;
}

type SortField = "requester" | "recipient" | "createdAt" | "status";

export function UnifiedTransfersTable({ transferRequests, oldTransfers, searchTerm = "" }: UnifiedTransfersTableProps) {
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = (field: SortField) => {
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
  void oldTransfers;

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

  // Sortable header: a real <th> with text so the global mobile card CSS can stamp data-label
  // on the matching cells and turn the header row into a chip bar. (Plain render helper, not a
  // nested component, so React does not remount it every render.)
  const renderSortableTh = (field: SortField, label: string) => (
    <th
      key={field}
      className="px-4 py-3 text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-end gap-1">
        {label}
        {sortField === field && (
          <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
      {sortedRequests.length === 0 ? (
        <div className="py-12 text-center text-zinc-500 text-sm">אין העברות ציוד</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-900/50 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                {renderSortableTh("requester", "מעביר")}
                {renderSortableTh("recipient", "מקבל")}
                <th className="px-4 py-3 text-center">פריטים</th>
                {renderSortableTh("createdAt", "תאריך")}
                {renderSortableTh("status", "סטטוס")}
              </tr>
            </thead>
            <tbody>
              {sortedRequests.map((request) => (
                <tr
                  key={request.id}
                  onClick={() => setSelectedRequest(request)}
                  className="border-t border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-sm font-semibold text-zinc-50">
                    {request.requester.name}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-zinc-50">
                    {request.recipient?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400 text-center">
                    {request.items.length}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {new Date(request.createdAt).toLocaleDateString("he-IL", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className={`px-4 py-3 text-xs font-bold ${getStatusColor(request)}`}>
                    {getStatusText(request)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
