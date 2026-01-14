"use client";

import { useState, useMemo } from "react";
import { Division, TransferStatus } from "@prisma/client";
import { divisionLabel } from "@/lib/he";

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

type SortField = "fromUser" | "toUser" | "createdAt" | "status" | "approvedBy";
type SortDirection = "asc" | "desc";

export function TransfersTable({ 
  transfers, 
  searchTerm = "" 
}: { 
  transfers: Transfer[];
  searchTerm?: string;
}) {
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedTransfers = useMemo(() => {
    // Apply search filter
    let filtered = transfers;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = transfers.filter((transfer) => {
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
    
    return [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "fromUser":
          aValue = a.fromUser.name;
          bValue = b.fromUser.name;
          break;
        case "toUser":
          aValue = a.toUser.name;
          bValue = b.toUser.name;
          break;
        case "createdAt":
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        case "approvedBy":
          aValue = a.approvedBy?.name || "";
          bValue = b.approvedBy?.name || "";
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [transfers, sortField, sortDirection, searchTerm]);

  const getStatusLabel = (status: TransferStatus) => {
    switch (status) {
      case TransferStatus.PENDING_COMMANDER_APPROVAL:
        return "ממתין לאישור מפקד";
      case TransferStatus.PENDING_RECEIVER_CONFIRMATION:
        return "ממתין לאישור מקבל";
      case TransferStatus.COMPLETED:
        return "הושלם";
      case TransferStatus.REJECTED:
        return "נדחה";
      case TransferStatus.CANCELLED:
        return "בוטל";
      default:
        return status;
    }
  };

  const getStatusColor = (status: TransferStatus) => {
    switch (status) {
      case TransferStatus.PENDING_COMMANDER_APPROVAL:
      case TransferStatus.PENDING_RECEIVER_CONFIRMATION:
        return "bg-yellow-900/20 text-yellow-400 border-yellow-900/40";
      case TransferStatus.COMPLETED:
        return "bg-green-900/20 text-green-400 border-green-900/40";
      case TransferStatus.REJECTED:
        return "bg-red-900/20 text-red-400 border-red-900/40";
      case TransferStatus.CANCELLED:
        return "bg-zinc-800/50 text-zinc-500 border-zinc-800";
      default:
        return "bg-zinc-800 text-zinc-400 border-zinc-800";
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-900/50 text-xs font-bold text-zinc-500 uppercase tracking-wider">
              <th 
                className="px-4 py-3 text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                onClick={() => handleSort("fromUser")}
              >
                <div className="flex items-center justify-end gap-1">
                  ממי
                  {sortField === "fromUser" && (
                    <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                onClick={() => handleSort("toUser")}
              >
                <div className="flex items-center justify-end gap-1">
                  למי
                  {sortField === "toUser" && (
                    <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </th>
              <th className="px-4 py-3 text-right">פריטים</th>
              <th 
                className="px-4 py-3 text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                onClick={() => handleSort("createdAt")}
              >
                <div className="flex items-center justify-end gap-1">
                  תאריך
                  {sortField === "createdAt" && (
                    <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                onClick={() => handleSort("approvedBy")}
              >
                <div className="flex items-center justify-end gap-1">
                  אושר על ידי
                  {sortField === "approvedBy" && (
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
            {sortedTransfers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-500">
                  אין העברות ממתינות
                </td>
              </tr>
            ) : (
              sortedTransfers.map((transfer) => (
                <tr
                  key={transfer.id}
                  className="border-t border-zinc-800 hover:bg-zinc-900/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-sm font-medium text-zinc-50">
                    {transfer.fromUser.name}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-zinc-50">
                    {transfer.toUser.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-300">
                    {transfer.items.map((item, idx) => (
                      <div key={idx}>
                        {item.equipmentItem.name} × {item.quantity}
                        <span className="text-zinc-500 text-xs mr-2">
                          ({divisionLabel(item.equipmentItem.category.division)})
                        </span>
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(transfer.createdAt).toLocaleDateString("he-IL", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {transfer.approvedBy?.name || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(transfer.status)}`}
                    >
                      {getStatusLabel(transfer.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
