"use client";

import { useState, useMemo } from "react";
import { Division, AssignmentStatus } from "@prisma/client";
import { divisionLabel } from "@/lib/he";

interface Assignment {
  id: string;
  quantity: number;
  status: AssignmentStatus;
  serialNumber: string | null;
  equipmentItem: {
    id: string;
    name: string;
    isWeapon: boolean;
    isSight: boolean;
    category: {
      division: Division;
    };
  };
}

export function EquipmentTab({ assignments }: { assignments: Assignment[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDivision, setSelectedDivision] = useState<Division | "ALL">("ALL");

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const matchesSearch = !searchQuery || 
        a.equipmentItem.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDivision = selectedDivision === "ALL" || 
        a.equipmentItem.category.division === selectedDivision;
      return matchesSearch && matchesDivision;
    });
  }, [assignments, searchQuery, selectedDivision]);

  // Group by division
  const byDivision = useMemo(() => {
    const map = new Map<Division, Assignment[]>();
    for (const a of filteredAssignments) {
      const div = a.equipmentItem.category.division;
      const list = map.get(div) || [];
      list.push(a);
      map.set(div, list);
    }
    return map;
  }, [filteredAssignments]);

  const divisions: Division[] = [Division.COMBAT, Division.LOGISTICS, Division.MEDICAL];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      {/* Search and Filters */}
      <div className="mb-6 flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="חיפוש לפי שם פריט..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[200px] h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all placeholder:text-zinc-700"
        />
        <select
          value={selectedDivision}
          onChange={(e) => setSelectedDivision(e.target.value as Division | "ALL")}
          className="h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all cursor-pointer min-w-[140px]"
        >
          <option value="ALL">כל החלוקות</option>
          {divisions.map((d) => (
            <option key={d} value={d}>
              {divisionLabel(d)}
            </option>
          ))}
        </select>
      </div>

      {/* Tables by Division */}
      {filteredAssignments.length === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-2xl border border-zinc-800 border-dashed">
          לא נמצא ציוד
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {divisions.map((div) => {
            const divAssignments = byDivision.get(div);
            if (!divAssignments || divAssignments.length === 0) return null;

            return (
              <div key={div}>
                <h3 className="text-lg font-bold text-zinc-50 mb-4">{divisionLabel(div)}</h3>
                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                        <th className="px-4 py-3 text-right">שם פריט</th>
                        <th className="px-4 py-3 text-center">כמות</th>
                        <th className="px-4 py-3 text-center">מספר סידורי</th>
                      </tr>
                    </thead>
                    <tbody>
                      {divAssignments.map((a) => (
                        <tr key={a.id} className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors">
                          <td className="px-4 py-4 text-sm font-bold text-zinc-50">
                            {a.equipmentItem.name}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-sm font-bold text-zinc-50">
                              {a.quantity}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center text-sm">
                            {(a.equipmentItem.isWeapon || a.equipmentItem.isSight) ? (
                              a.serialNumber ? (
                                <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-50 font-mono text-xs">
                                  {a.serialNumber}
                                </span>
                              ) : (
                                <span className="text-zinc-600">-</span>
                              )
                            ) : (
                              <span className="text-zinc-700">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

