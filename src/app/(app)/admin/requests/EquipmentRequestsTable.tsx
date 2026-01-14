"use client";

import { useState, useMemo } from "react";
import { RequestType, RequestStatus, Priority, Division } from "@prisma/client";
import { requestTypeLabel, priorityLabel, priorityColor, divisionLabel } from "@/lib/he";
import { RequestDetailModal } from "./RequestDetailModal";

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

type FilterKey = "type" | "priority" | "division";
type SortField = "requester" | "type" | "quantity" | "priority" | "createdAt" | "status" | "resolvedBy";
type SortDirection = "asc" | "desc";

export function EquipmentRequestsTable({ 
  requests, 
  searchTerm = "" 
}: { 
  requests: Request[];
  searchTerm?: string;
}) {
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    type: "ALL",
    priority: "ALL",
    division: "ALL",
  });
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const toggleFilter = (key: FilterKey, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key] === value ? "ALL" : value,
    }));
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredRequests = useMemo(() => {
    let filtered = requests.filter((req) => {
      // Apply search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
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
        
        if (!matchesRequester && !matchesItem && !matchesDivision && !matchesType && !matchesPriority && !matchesNotes && !matchesSerial && !matchesAssignmentSerial && !matchesClothingSize && !matchesShoeSize) {
          return false;
        }
      }
      
      // Apply column filters
      if (filters.type !== "ALL" && req.type !== filters.type) return false;
      if (filters.priority !== "ALL" && req.priority !== filters.priority) return false;
      if (filters.division !== "ALL") {
        const hasMatchingDivision = req.items.some(
          (item) => item.equipmentItem.category.division === filters.division
        );
        if (!hasMatchingDivision) return false;
      }
      return true;
    });

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "requester":
          aValue = a.requester.name;
          bValue = b.requester.name;
          break;
        case "type":
          aValue = a.type;
          bValue = b.type;
          break;
        case "quantity":
          aValue = a.items.reduce((sum, item) => sum + item.quantity, 0);
          bValue = b.items.reduce((sum, item) => sum + item.quantity, 0);
          break;
        case "priority":
          const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
          aValue = priorityOrder[a.priority];
          bValue = priorityOrder[b.priority];
          break;
        case "createdAt":
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        case "resolvedBy":
          aValue = a.resolvedBy?.name || "";
          bValue = b.resolvedBy?.name || "";
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [requests, filters, sortField, sortDirection, searchTerm]);

  const isNew = (req: Request) => !req.viewedAt;

  const getTotalQuantity = (req: Request) => {
    return req.items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getItemsSummary = (req: Request) => {
    if (req.items.length === 1) {
      return req.items[0].equipmentItem.name;
    }
    return `${req.items.length} פריטים`;
  };

  return (
    <>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider w-full mb-2">
            סינון לפי סוג
          </div>
          
          {/* Type Filter */}
          <div className="flex gap-2 flex-wrap">
            {Object.values(RequestType)
              .filter((type) => type !== RequestType.MISSING)
              .map((type) => {
                const count = requests.filter((r) => r.type === type).length;
                const isActive = filters.type === type;
                return (
                  <button
                    key={type}
                    onClick={() => toggleFilter("type", type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-zinc-50 text-zinc-950"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {requestTypeLabel(type)} ({count})
                  </button>
                );
              })}
          </div>

          {/* Reset Filters */}
          {Object.values(filters).some((f) => f !== "ALL") && (
            <button
              onClick={() => setFilters({ type: "ALL", priority: "ALL", division: "ALL" })}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-all cursor-pointer"
            >
              נקה סינון
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-900/50 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                <th 
                  className="px-4 py-3 text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                  onClick={() => handleSort("requester")}
                >
                  <div className="flex items-center justify-end gap-1">
                    מבקש
                    {sortField === "requester" && (
                      <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-right">פריטים</th>
                <th 
                  className="px-4 py-3 text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                  onClick={() => handleSort("type")}
                >
                  <div className="flex items-center justify-end gap-1">
                    סוג
                    {sortField === "type" && (
                      <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-center cursor-pointer hover:text-zinc-300 transition-colors select-none"
                  onClick={() => handleSort("quantity")}
                >
                  <div className="flex items-center justify-center gap-1">
                    כמות כוללת
                    {sortField === "quantity" && (
                      <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-center cursor-pointer hover:text-zinc-300 transition-colors select-none"
                  onClick={() => handleSort("priority")}
                >
                  <div className="flex items-center justify-center gap-1">
                    עדיפות
                    {sortField === "priority" && (
                      <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                  onClick={() => handleSort("createdAt")}
                >
                  <div className="flex items-center justify-end gap-1">
                    תאריך יצירה
                    {sortField === "createdAt" && (
                      <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                  onClick={() => handleSort("resolvedBy")}
                >
                  <div className="flex items-center justify-end gap-1">
                    טופל על ידי
                    {sortField === "resolvedBy" && (
                      <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-center cursor-pointer hover:text-zinc-300 transition-colors select-none"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center justify-center gap-1">
                    סטטוס
                    {sortField === "status" && (
                      <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-zinc-500">
                    אין בקשות פתוחות
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const fulfilledCount = req.items.filter(i => i.status === "FULFILLED").length;
                  const deniedCount = req.items.filter(i => i.status === "DENIED").length;
                  const cancelledCount = req.items.filter(i => i.status === "CANCELLED").length;
                  const pendingCount = req.items.filter(i => i.status === "PENDING").length;

                  return (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedRequest(req)}
                      className={`border-t border-zinc-800 hover:bg-zinc-900/50 transition-colors cursor-pointer ${
                        isNew(req) ? "bg-blue-900/10" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-zinc-50">
                        {req.requester.name}
                        {isNew(req) && (
                          <span className="mr-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-blue-900/30 text-blue-400 border border-blue-900/50">
                            חדש
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-zinc-300 mb-1">{getItemsSummary(req)}</div>
                        <div className="flex gap-1 flex-wrap">
                          {fulfilledCount > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-green-900/20 text-green-400 border border-green-900/40">
                              ✓ {fulfilledCount}
                            </span>
                          )}
                          {deniedCount > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-900/20 text-red-400 border border-red-900/40">
                              ✗ {deniedCount}
                            </span>
                          )}
                          {cancelledCount > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-zinc-800 text-zinc-500 border border-zinc-700">
                              ⊘ {cancelledCount}
                            </span>
                          )}
                          {pendingCount > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-blue-900/20 text-blue-400 border border-blue-900/40">
                              ⏳ {pendingCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400">
                        {requestTypeLabel(req.type)}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-50 text-center font-bold">
                        {getTotalQuantity(req)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${priorityColor(req.priority)}`}>
                          {priorityLabel(req.priority)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(req.createdAt).toLocaleDateString("he-IL", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400">
                        {req.resolvedBy?.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-bold bg-yellow-900/20 text-yellow-400 border border-yellow-900/40">
                          {req.status === RequestStatus.IN_PROGRESS ? "בטיפול" : "פתוח"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </>
  );
}
