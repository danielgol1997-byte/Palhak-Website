"use client";

import { useState, useMemo } from "react";
import { Division } from "@prisma/client";
import { divisionLabel } from "@/lib/he";
import Link from "next/link";

interface Assignment {
  id: string;
  quantity: number;
  serialNumber: string | null;
  assignedAt: Date;
  status: string;
  user: {
    id: string;
    name: string;
    personalNumber: string | null;
  };
  equipmentItem: {
    id: string;
    name: string;
    category: {
      division: Division;
    };
  };
  assignedBy: {
    id: string;
    name: string;
  } | null;
}

type SortField = "sight" | "serialNumber" | "user" | "personalNumber" | "division" | "assignedAt" | "assignedBy";
type SortDirection = "asc" | "desc";

export function SightsTable({ assignments }: { assignments: Assignment[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("assignedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filter and sort assignments
  const filteredAssignments = useMemo(() => {
    let filtered = assignments.filter((assignment) => {
      const matchesSearch =
        !searchQuery ||
        assignment.equipmentItem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assignment.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (assignment.serialNumber && assignment.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (assignment.user.personalNumber && assignment.user.personalNumber.includes(searchQuery));

      return matchesSearch;
    });

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "sight":
          aValue = a.equipmentItem.name;
          bValue = b.equipmentItem.name;
          break;
        case "serialNumber":
          aValue = a.serialNumber || "";
          bValue = b.serialNumber || "";
          break;
        case "user":
          aValue = a.user.name;
          bValue = b.user.name;
          break;
        case "personalNumber":
          aValue = a.user.personalNumber || "";
          bValue = b.user.personalNumber || "";
          break;
        case "division":
          aValue = a.equipmentItem.category.division;
          bValue = b.equipmentItem.category.division;
          break;
        case "assignedAt":
          aValue = new Date(a.assignedAt).getTime();
          bValue = new Date(b.assignedAt).getTime();
          break;
        case "assignedBy":
          aValue = a.assignedBy?.name || "";
          bValue = b.assignedBy?.name || "";
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [assignments, searchQuery, sortField, sortDirection]);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-50">צלמים מוקצים</h2>
          <p className="mt-1 text-sm text-zinc-400">
            סה"כ {filteredAssignments.length} צלמים
          </p>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            placeholder="חיפוש..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all placeholder:text-zinc-700"
          />
        </div>
      </div>

      {filteredAssignments.length === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-2xl border border-zinc-800 border-dashed">
          לא נמצאו צלמים מוקצים
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                <th 
                  className="px-4 py-3 text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                  onClick={() => handleSort("sight")}
                >
                  <div className="flex items-center justify-end gap-1">
                    צלם
                    {sortField === "sight" && (
                      <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                  onClick={() => handleSort("serialNumber")}
                >
                  <div className="flex items-center justify-end gap-1">
                    מספר סידורי
                    {sortField === "serialNumber" && (
                      <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                  onClick={() => handleSort("user")}
                >
                  <div className="flex items-center justify-end gap-1">
                    מוקצה ל
                    {sortField === "user" && (
                      <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                  onClick={() => handleSort("personalNumber")}
                >
                  <div className="flex items-center justify-end gap-1">
                    מ"א
                    {sortField === "personalNumber" && (
                      <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                  onClick={() => handleSort("division")}
                >
                  <div className="flex items-center justify-end gap-1">
                    חלוקה
                    {sortField === "division" && (
                      <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                  onClick={() => handleSort("assignedAt")}
                >
                  <div className="flex items-center justify-end gap-1">
                    תאריך הקצאה
                    {sortField === "assignedAt" && (
                      <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                  onClick={() => handleSort("assignedBy")}
                >
                  <div className="flex items-center justify-end gap-1">
                    הוקצה על ידי
                    {sortField === "assignedBy" && (
                      <span className="text-zinc-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map((assignment) => (
                <tr
                  key={assignment.id}
                  className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors"
                >
                  <td className="px-4 py-4 text-sm font-bold text-zinc-50">
                    {assignment.equipmentItem.name}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-50">
                    {assignment.serialNumber ? (
                      <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-50 font-mono text-xs">
                        {assignment.serialNumber}
                      </span>
                    ) : (
                      <span className="text-zinc-600">לא הוזן</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-50">
                    <Link
                      href={`/admin/users/${assignment.user.id}`}
                      className="hover:text-zinc-300 underline decoration-dotted"
                    >
                      {assignment.user.name}
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-400 font-mono">
                    {assignment.user.personalNumber || "-"}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-400">
                    {divisionLabel(assignment.equipmentItem.category.division)}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-400">
                    {new Date(assignment.assignedAt).toLocaleDateString("he-IL", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-400">
                    {assignment.assignedBy?.name || "מערכת"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

