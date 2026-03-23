"use client";

import { useState, useEffect, useMemo } from "react";
import { upsertStorageInventoryAction, recoverAssignmentToStorageAction } from "./actions";
import { divisionLabel } from "@/lib/he";
import { Division } from "@prisma/client";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface Assignment {
  id: string;
  quantity: number;
  status: string;
  serialNumber: string | null;
  user: {
    id: string;
    name: string;
    personalNumber: string | null;
  };
}

interface StorageInventoryRow {
  id: string;
  equipmentItem: {
    id: string;
    name: string;
    category: {
      division: Division;
    };
    assignments: Assignment[];
  };
  inStorage: number;
  inBoxes: number;
  assignedHealthy: number;
  damaged: number;
  used: number;
  stolenOrLost: number;
  total: number;
}

type StatusType = "inStorage" | "inBoxes" | "assigned" | "damaged" | "used" | "stolenOrLost";

interface StatusModalData {
  item: StorageInventoryRow;
  statusType: StatusType;
}

interface RecoveryModalData {
  assignment: Assignment;
  itemName: string;
  maxQuantity: number;
}

export default function StorageList({ initialRows }: { initialRows: StorageInventoryRow[] }) {
  const [items, setItems] = useState(initialRows);
  const [editingItem, setEditingItem] = useState<StorageInventoryRow | null>(null);
  const [statusModal, setStatusModal] = useState<StatusModalData | null>(null);
  const [recoveryModal, setRecoveryModal] = useState<RecoveryModalData | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDivision, setSelectedDivision] = useState<Division | "ALL">("ALL");
  const [sortField, setSortField] = useState<"name" | "total" | "inStorage" | "inBoxes" | "assignedHealthy" | "damaged" | "used" | "stolenOrLost">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    setItems(initialRows);
  }, [initialRows]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filteredAndSortedItems = useMemo(() => {
    let filtered = items.filter((item) => {
      const matchesSearch = !searchQuery || 
        item.equipmentItem.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDivision = selectedDivision === "ALL" || 
        item.equipmentItem.category.division === selectedDivision;
      return matchesSearch && matchesDivision;
    });

    return filtered.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case "name":
          aVal = a.equipmentItem.name;
          bVal = b.equipmentItem.name;
          break;
        case "total":
          aVal = a.total;
          bVal = b.total;
          break;
        case "inStorage":
          aVal = a.inStorage;
          bVal = b.inStorage;
          break;
        case "inBoxes":
          aVal = a.inBoxes;
          bVal = b.inBoxes;
          break;
        case "assignedHealthy":
          aVal = a.assignedHealthy;
          bVal = b.assignedHealthy;
          break;
        case "damaged":
          aVal = a.damaged;
          bVal = b.damaged;
          break;
        case "used":
          aVal = a.used;
          bVal = b.used;
          break;
        case "stolenOrLost":
          aVal = a.stolenOrLost;
          bVal = b.stolenOrLost;
          break;
        default:
          return 0;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" 
          ? aVal.localeCompare(bVal, "he") 
          : bVal.localeCompare(aVal, "he");
      } else {
        return sortDir === "asc" 
          ? (aVal as number) - (bVal as number) 
          : (bVal as number) - (aVal as number);
      }
    });
  }, [items, searchQuery, selectedDivision, sortField, sortDir]);

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <span className="text-zinc-600">↕</span>;
    return sortDir === "asc" ? <span className="text-zinc-50">↑</span> : <span className="text-zinc-50">↓</span>;
  };

  return (
    <>
      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="חיפוש לפי שם פריט..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all placeholder:text-zinc-700"
        />
      </div>

      {/* Results Count */}
      {(searchQuery || selectedDivision !== "ALL") && (
        <div className="mb-4 text-sm text-zinc-400">
          מציג <span className="font-bold text-zinc-200">{filteredAndSortedItems.length}</span> מתוך <span className="font-bold text-zinc-200">{items.length}</span> פריטים
        </div>
      )}

      {/* Table */}
      {filteredAndSortedItems.length === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-2xl border border-zinc-800 border-dashed">
          לא נמצאו פריטים
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                <th 
                  className="px-4 py-3 text-right cursor-pointer hover:bg-zinc-900 transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-2">
                    שם פריט <SortIcon field="name" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right">
                  <div className="flex flex-col gap-1">
                    <span>קטגוריה</span>
                    <select
                      value={selectedDivision}
                      onChange={(e) => setSelectedDivision(e.target.value as Division | "ALL")}
                      className="mt-1 px-2 py-1 rounded border border-zinc-700 bg-zinc-900 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="ALL">הכל</option>
                      <option value="COMBAT">ציוד קרבי</option>
                      <option value="LOGISTICS">ציוד משקי</option>
                      <option value="MEDICAL">ציוד רפואי</option>
                    </select>
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-center cursor-pointer hover:bg-zinc-900 transition-colors"
                  onClick={() => handleSort("total")}
                >
                  <div className="flex items-center justify-center gap-2">
                    סה״כ <SortIcon field="total" />
                  </div>
                </th>
                <th className="px-4 py-3 text-center min-w-[300px]">
                  <div className="flex items-center justify-center gap-3 text-[10px] font-semibold">
                    <button
                      onClick={() => handleSort("inStorage")}
                      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-emerald-900/20 transition-colors cursor-pointer"
                    >
                      <div className="w-2 h-2 rounded-sm bg-emerald-500" />
                      במלאי <SortIcon field="inStorage" />
                    </button>
                    <button
                      onClick={() => handleSort("inBoxes")}
                      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-amber-900/20 transition-colors cursor-pointer"
                    >
                      <div className="w-2 h-2 rounded-sm bg-amber-500" />
                      בקרטונים <SortIcon field="inBoxes" />
                    </button>
                    <button
                      onClick={() => handleSort("assignedHealthy")}
                      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-900/20 transition-colors cursor-pointer"
                    >
                      <div className="w-2 h-2 rounded-sm bg-blue-500" />
                      מוקצה <SortIcon field="assignedHealthy" />
                    </button>
                    <button
                      onClick={() => handleSort("damaged")}
                      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-orange-900/20 transition-colors cursor-pointer"
                    >
                      <div className="w-2 h-2 rounded-sm bg-orange-500" />
                      בלאי <SortIcon field="damaged" />
                    </button>
                    <button
                      onClick={() => handleSort("used")}
                      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-yellow-900/20 transition-colors cursor-pointer"
                    >
                      <div className="w-2 h-2 rounded-sm bg-yellow-500" />
                      שומש <SortIcon field="used" />
                    </button>
                    <button
                      onClick={() => handleSort("stolenOrLost")}
                      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-red-900/20 transition-colors cursor-pointer"
                    >
                      <div className="w-2 h-2 rounded-sm bg-red-500" />
                      אבד/נגנב <SortIcon field="stolenOrLost" />
                    </button>
                  </div>
                </th>
                <th className="px-4 py-3 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedItems.map((row) => {
                // Calculate percentages with minimum visibility
                const calculateWidth = (value: number) => {
                  if (value === 0) return 0;
                  const naturalPercent = (value / row.total) * 100;
                  // Minimum 3% width for visibility, unless it would exceed 100%
                  const minPercent = 3;
                  return Math.max(naturalPercent, minPercent);
                };

                const inStorageWidth = calculateWidth(row.inStorage);
                const inBoxesWidth = calculateWidth(row.inBoxes);
                const assignedWidth = calculateWidth(row.assignedHealthy);
                const damagedWidth = calculateWidth(row.damaged);
                const usedWidth = calculateWidth(row.used);
                const stolenWidth = calculateWidth(row.stolenOrLost);

                // Normalize if total exceeds 100%
                const totalWidth = inStorageWidth + inBoxesWidth + assignedWidth + damagedWidth + usedWidth + stolenWidth;
                const scale = totalWidth > 100 ? 100 / totalWidth : 1;

                return (
                  <tr 
                    key={row.id} 
                    className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors"
                  >
                    <td className="px-4 py-4 text-sm font-bold text-zinc-50">
                      {row.equipmentItem.name}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400">
                      {divisionLabel(row.equipmentItem.category.division)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-sm font-bold text-zinc-50">
                        {row.total}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-10 w-full rounded-lg overflow-hidden flex border border-zinc-800 bg-zinc-900">
                        {/* In Storage - Green */}
                        {row.inStorage > 0 && (
                          <button
                            onClick={() => setStatusModal({ item: row, statusType: "inStorage" })}
                            className="group relative transition-all hover:brightness-110 cursor-pointer"
                            style={{ width: `${inStorageWidth * scale}%` }}
                            title={`במלאי: ${row.inStorage}`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/90 to-emerald-600/90" />
                            <div className="relative h-full flex items-center justify-center px-1 text-white text-xs font-bold whitespace-nowrap overflow-hidden">
                              {inStorageWidth * scale > 8 && row.inStorage}
                            </div>
                          </button>
                        )}

                        {/* In Boxes - Amber */}
                        {row.inBoxes > 0 && (
                          <button
                            onClick={() => setStatusModal({ item: row, statusType: "inBoxes" })}
                            className="group relative transition-all hover:brightness-110 cursor-pointer"
                            style={{ width: `${inBoxesWidth * scale}%` }}
                            title={`בקרטונים: ${row.inBoxes}`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/90 to-amber-600/90" />
                            <div className="relative h-full flex items-center justify-center px-1 text-white text-xs font-bold whitespace-nowrap overflow-hidden">
                              {inBoxesWidth * scale > 8 && row.inBoxes}
                            </div>
                          </button>
                        )}

                        {/* Assigned - Blue */}
                        {row.assignedHealthy > 0 && (
                          <button
                            onClick={() => setStatusModal({ item: row, statusType: "assigned" })}
                            className="group relative transition-all hover:brightness-110 cursor-pointer"
                            style={{ width: `${assignedWidth * scale}%` }}
                            title={`מוקצה: ${row.assignedHealthy}`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/90 to-blue-600/90" />
                            <div className="relative h-full flex items-center justify-center px-1 text-white text-xs font-bold whitespace-nowrap overflow-hidden">
                              {assignedWidth * scale > 8 && row.assignedHealthy}
                            </div>
                          </button>
                        )}

                        {/* Damaged - Orange */}
                        {row.damaged > 0 && (
                          <button
                            onClick={() => setStatusModal({ item: row, statusType: "damaged" })}
                            className="group relative transition-all hover:brightness-110 cursor-pointer"
                            style={{ width: `${damagedWidth * scale}%` }}
                            title={`בלאי: ${row.damaged}`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-b from-orange-500/90 to-orange-600/90" />
                            <div className="relative h-full flex items-center justify-center px-1 text-white text-xs font-bold whitespace-nowrap overflow-hidden">
                              {damagedWidth * scale > 8 && row.damaged}
                            </div>
                          </button>
                        )}

                        {/* Used - Yellow */}
                        {row.used > 0 && (
                          <button
                            onClick={() => setStatusModal({ item: row, statusType: "used" })}
                            className="group relative transition-all hover:brightness-110 cursor-pointer"
                            style={{ width: `${usedWidth * scale}%` }}
                            title={`שומש: ${row.used}`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/90 to-yellow-600/90" />
                            <div className="relative h-full flex items-center justify-center px-1 text-white text-xs font-bold whitespace-nowrap overflow-hidden">
                              {usedWidth * scale > 8 && row.used}
                            </div>
                          </button>
                        )}

                        {/* Stolen/Lost - Red */}
                        {row.stolenOrLost > 0 && (
                          <button
                            onClick={() => setStatusModal({ item: row, statusType: "stolenOrLost" })}
                            className="group relative transition-all hover:brightness-110 cursor-pointer"
                            style={{ width: `${stolenWidth * scale}%` }}
                            title={`אבד/נגנב: ${row.stolenOrLost}`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-b from-red-500/90 to-red-600/90" />
                            <div className="relative h-full flex items-center justify-center px-1 text-white text-xs font-bold whitespace-nowrap overflow-hidden">
                              {stolenWidth * scale > 8 && row.stolenOrLost}
                            </div>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => setEditingItem(row)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer"
                        >
                          עריכה
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setEditingItem(null)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 p-8 shadow-2xl overflow-hidden border border-zinc-800 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-zinc-50">עריכת מלאי</h3>
              <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="mb-6 p-4 rounded-xl border border-zinc-800 bg-zinc-950">
              <div className="text-lg font-bold text-zinc-50 mb-1">{editingItem.equipmentItem.name}</div>
              <div className="text-sm text-zinc-400">{divisionLabel(editingItem.equipmentItem.category.division)}</div>
            </div>

            <form action={async (fd) => { await upsertStorageInventoryAction(fd); setEditingItem(null); }} className="grid gap-6">
              <input type="hidden" name="equipmentItemId" value={editingItem.equipmentItem.id} />
              
              <div>
                <label className="text-sm font-bold text-blue-400 mb-2 block">נופק (לחיילים)</label>
                <div className="h-12 w-full rounded-xl border border-blue-900/40 bg-blue-900/10 px-4 text-xl font-bold text-blue-300 flex items-center">
                  {editingItem.assignedHealthy}
                </div>
                <div className="mt-1 text-xs text-zinc-500">לא ניתן לעריכה · מחושב אוטומטית</div>
              </div>

              <div>
                <label className="text-sm font-bold text-green-400 mb-2 block">במלאי</label>
                <input 
                  name="quantity" 
                  type="number" 
                  min="0"
                  defaultValue={editingItem.inStorage} 
                  className="h-12 w-full rounded-xl border border-green-900/40 bg-green-900/10 px-4 text-xl font-bold text-green-300 focus:ring-2 focus:ring-green-500 outline-none transition-all" 
                  required 
                  autoFocus
                />
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950">
                <div className="text-xs text-zinc-500 mb-2">סה״כ מלאי (לאחר שמירה)</div>
                <div className="text-sm text-zinc-400 space-y-1">
                  <div><span className="text-emerald-400">במלאי</span> + <span className="text-amber-400">{editingItem.inBoxes} בקרטונים</span> + <span className="text-blue-400">{editingItem.assignedHealthy} מוקצה</span> + <span className="text-orange-400">{editingItem.damaged} בלאי</span> + <span className="text-yellow-400">{editingItem.used} שומש</span> + <span className="text-red-400">{editingItem.stolenOrLost} אבד/נגנב</span></div>
                  <div className="text-xl font-bold text-zinc-50">= {editingItem.total} סה״כ</div>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button type="submit" className="flex-1 h-14 inline-flex items-center justify-center rounded-2xl bg-zinc-50 text-base font-bold text-zinc-950 hover:bg-zinc-200 transition-all shadow-lg shadow-zinc-100/5 cursor-pointer">שמירה</button>
                <button type="button" onClick={() => setEditingItem(null)} className="flex-1 h-14 inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 text-base font-bold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Detail Modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            onClick={() => setStatusModal(null)}
          />
          <div className="relative w-full max-w-2xl rounded-3xl bg-zinc-900 p-6 sm:p-8 shadow-2xl overflow-hidden border border-zinc-800 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-zinc-50">
                  {statusModal.item.equipmentItem.name}
                </h3>
                <div className="mt-1 text-sm text-zinc-400">
                  {statusModal.statusType === "inStorage" && "פריטים במלאי"}
                  {statusModal.statusType === "inBoxes" && "פריטים בקרטונים"}
                  {statusModal.statusType === "assigned" && "פריטים מוקצים לחיילים"}
                  {statusModal.statusType === "damaged" && "פריטים בבלאי"}
                  {statusModal.statusType === "used" && "פריטים שומשים"}
                  {statusModal.statusType === "stolenOrLost" && "פריטים אבודים/גנובים"}
                </div>
              </div>
              <button
                onClick={() => setStatusModal(null)}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {statusModal.statusType === "inStorage" ? (
              <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/10 p-6">
                <div className="text-center">
                  <div className="text-4xl sm:text-6xl font-black text-emerald-400 mb-2">
                    {statusModal.item.inStorage}
                  </div>
                  <div className="text-sm text-zinc-400">יחידות זמינות במחסן</div>
                  <div className="mt-4 text-xs text-zinc-500">
                    פריטים אלו נמצאים במלאי ולא הוקצו לאיש.
                  </div>
                </div>
              </div>
            ) : statusModal.statusType === "inBoxes" ? (
              <div className="rounded-xl border border-amber-900/40 bg-amber-900/10 p-6">
                <div className="text-center">
                  <div className="text-4xl sm:text-6xl font-black text-amber-400 mb-2">
                    {statusModal.item.inBoxes}
                  </div>
                  <div className="text-sm text-zinc-400">יחידות בקרטונים</div>
                  <div className="mt-4 text-xs text-zinc-500">
                    פריטים אלו מאוחסנים בקרטונים של חיילים. צפה ב<a href="/admin/boxes" className="text-amber-400 hover:underline">רשימת הקרטונים</a> לפרטים.
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {(() => {
                  const relevantAssignments = statusModal.item.equipmentItem.assignments.filter((a) => {
                    if (statusModal.statusType === "assigned") return a.status === "ASSIGNED";
                    if (statusModal.statusType === "damaged") return a.status === "DAMAGED";
                    if (statusModal.statusType === "used") return a.status === "USED";
                    if (statusModal.statusType === "stolenOrLost") return a.status === "STOLEN" || a.status === "MISSING";
                    return false;
                  });

                  if (relevantAssignments.length === 0) {
                    return (
                      <div className="py-12 text-center text-sm text-zinc-500">
                        אין פריטים בסטטוס זה
                      </div>
                    );
                  }

                  const canRecover = statusModal.statusType === "damaged" || statusModal.statusType === "used" || statusModal.statusType === "stolenOrLost";

                  return (
                    <div className="rounded-xl border border-zinc-800 overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                            <th className="px-4 py-3 text-right">חייל</th>
                            <th className="px-4 py-3 text-right">מספר אישי</th>
                            {relevantAssignments.some(a => a.serialNumber) && (
                              <th className="px-4 py-3 text-right">מספר סידורי</th>
                            )}
                            <th className="px-4 py-3 text-center">כמות</th>
                            <th className="px-4 py-3 text-center">סטטוס</th>
                            {canRecover && <th className="px-4 py-3 text-center">פעולות</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {relevantAssignments.map((assignment) => (
                            <tr key={assignment.id} className="border-t border-zinc-800">
                              <td className="px-4 py-3 text-sm font-medium text-zinc-50">
                                {assignment.user.name}
                              </td>
                              <td className="px-4 py-3 text-sm text-zinc-400">
                                {assignment.user.personalNumber || "-"}
                              </td>
                              {relevantAssignments.some(a => a.serialNumber) && (
                                <td className="px-4 py-3 text-sm text-zinc-400">
                                  {assignment.serialNumber || "-"}
                                </td>
                              )}
                              <td className="px-4 py-3 text-center">
                                <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg border border-zinc-700 bg-zinc-800 text-sm font-bold text-zinc-50">
                                  {assignment.quantity}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold border ${
                                  assignment.status === "ASSIGNED"
                                    ? "bg-blue-900/20 text-blue-400 border-blue-900/40"
                                    : assignment.status === "DAMAGED"
                                    ? "bg-orange-900/20 text-orange-400 border-orange-900/40"
                                    : assignment.status === "USED"
                                    ? "bg-yellow-900/20 text-yellow-400 border-yellow-900/40"
                                    : "bg-red-900/20 text-red-400 border-red-900/40"
                                }`}>
                                  {assignment.status === "ASSIGNED" && "מוקצה"}
                                  {assignment.status === "DAMAGED" && "בלאי"}
                                  {assignment.status === "USED" && "שומש"}
                                  {assignment.status === "STOLEN" && "נגנב"}
                                  {assignment.status === "MISSING" && "אבד"}
                                </span>
                              </td>
                              {canRecover && (
                                <td className="px-4 py-3 text-center">
                                  <button
                                    onClick={() => {
                                      setRecoveryModal({
                                        assignment,
                                        itemName: statusModal.item.equipmentItem.name,
                                        maxQuantity: assignment.quantity,
                                      });
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-800 text-emerald-200 hover:bg-emerald-700 hover:text-emerald-50 transition-all border border-emerald-900/40 cursor-pointer"
                                  >
                                    {assignment.status === "DAMAGED" ? "החלף" : assignment.status === "USED" ? "הוחלף בציוד חדש" : "שחזר"}
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recovery Modal */}
      {recoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            onClick={() => setRecoveryModal(null)}
          />
          <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 p-8 shadow-2xl overflow-hidden border border-zinc-800 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-zinc-50">
                {recoveryModal.assignment.status === "DAMAGED" ? "החלפת פריט" : recoveryModal.assignment.status === "USED" ? "החלפה בציוד חדש" : "שחזור פריט"}
              </h3>
              <button
                onClick={() => setRecoveryModal(null)}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6 p-4 rounded-xl border border-zinc-800 bg-zinc-950 space-y-2">
              <div className="text-lg font-bold text-zinc-50">{recoveryModal.itemName}</div>
              <div className="text-sm text-zinc-400">חייל: {recoveryModal.assignment.user.name}</div>
              {recoveryModal.assignment.user.personalNumber && (
                <div className="text-sm text-zinc-400">מספר אישי: {recoveryModal.assignment.user.personalNumber}</div>
              )}
              {recoveryModal.assignment.serialNumber && (
                <div className="text-sm text-zinc-400">מספר סידורי: {recoveryModal.assignment.serialNumber}</div>
              )}
              <div className="text-sm text-zinc-400">
                כמות זמינה: <span className="font-bold text-zinc-200">{recoveryModal.maxQuantity}</span>
              </div>
            </div>

            <form
              action={async (fd) => {
                setIsRecovering(true);
                try {
                  await recoverAssignmentToStorageAction(fd);
                  setRecoveryModal(null);
                  setStatusModal(null);
                } finally {
                  setIsRecovering(false);
                }
              }}
              className="space-y-6"
            >
              <input type="hidden" name="assignmentId" value={recoveryModal.assignment.id} />
              
              <div>
                <label className="text-sm font-bold text-emerald-400 mb-2 block">
                  כמות {recoveryModal.assignment.status === "DAMAGED" ? "להחלפה" : recoveryModal.assignment.status === "USED" ? "להחלפה" : "לשחזור"}
                </label>
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  max={recoveryModal.maxQuantity}
                  defaultValue={recoveryModal.maxQuantity}
                  className="h-12 w-full rounded-xl border border-emerald-900/40 bg-emerald-900/10 px-4 text-xl font-bold text-emerald-300 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  required
                  autoFocus
                />
                <div className="mt-2 text-xs text-zinc-500">
                  {recoveryModal.assignment.status === "USED" 
                    ? "הכמות תופחת מ'שומש' ותתווסף למלאי. החייל יישאר עם היתרה (אם קיימת)"
                    : "הפריט יוחזר למלאי והחייל יישאר עם היתרה (אם קיימת)"
                  }
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  type="submit"
                  disabled={isRecovering}
                  className="flex-1 h-14 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-bold text-white hover:bg-emerald-500 transition-all shadow-lg cursor-pointer disabled:opacity-50"
                >
                  {isRecovering ? <LoadingSpinner size="sm" /> : (recoveryModal.assignment.status === "DAMAGED" ? "החלף והחזר למלאי" : recoveryModal.assignment.status === "USED" ? "החלף בציוד חדש" : "שחזר והחזר למלאי")}
                </button>
                <button
                  type="button"
                  onClick={() => setRecoveryModal(null)}
                  className="flex-1 h-14 inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 text-base font-bold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
