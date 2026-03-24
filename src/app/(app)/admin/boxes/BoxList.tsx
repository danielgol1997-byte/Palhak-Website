"use client";

import { useState, useMemo, Fragment } from "react";
import { BoxEditModal } from "./BoxEditModal";

interface TemplateItemStatus {
  equipmentItemId: string;
  name: string;
  required: number;
  inBox: number;
  missing: number;
  missingReason: string | null;
  inStorage: number;
}

interface BoxItemRow {
  id: string;
  equipmentItemId: string;
  quantity: number;
  serialNumber: string | null;
  movedAt: Date;
  equipmentItem: { id: string; name: string };
}

interface BoxRow {
  id: string;
  userId: string;
  userName: string;
  personalNumber: string | null;
  department: string | null;
  userActive: boolean;
  createdAt: Date;
  inBoxTotal: number;
  totalRequired: number;
  templateStatus: TemplateItemStatus[];
  items: BoxItemRow[];
}

interface TransferUser {
  id: string;
  name: string;
  personalNumber: string | null;
}

interface BoxListProps {
  rows: BoxRow[];
  allUsers: TransferUser[];
}

type SortField = "userName" | "department" | "pct" | "inBoxTotal" | "createdAt";
type SortDir = "asc" | "desc";

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  const active = sortField === field;
  return (
    <span className={`inline-flex flex-col gap-0 ml-1 ${active ? "opacity-100" : "opacity-30"}`}>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor" className={active && sortDir === "asc" ? "text-zinc-50" : "text-zinc-500"}>
        <path d="M4 0L8 5H0L4 0Z" />
      </svg>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor" className={active && sortDir === "desc" ? "text-zinc-50" : "text-zinc-500"}>
        <path d="M4 5L0 0H8L4 5Z" />
      </svg>
    </span>
  );
}

export function BoxList({ rows, allUsers }: BoxListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "complete" | "incomplete">("all");
  const [expandedBoxId, setExpandedBoxId] = useState<string | null>(null);
  const [editBoxId, setEditBoxId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("userName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedItemFilters, setSelectedItemFilters] = useState<Set<string>>(new Set());
  const [showItemFilter, setShowItemFilter] = useState(false);

  // Derive template items from any row (all rows share the same template)
  const templateItems = useMemo<TemplateItemStatus[]>(() => {
    if (rows.length === 0) return [];
    // Build a deduplicated list from first row
    return rows[0].templateStatus.map((ts) => ({
      equipmentItemId: ts.equipmentItemId,
      name: ts.name,
      required: ts.required,
      inBox: 0,
      missing: 0,
      missingReason: null,
      inStorage: ts.inStorage,
    }));
  }, [rows]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const toggleItemFilter = (id: string) => {
    setSelectedItemFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearItemFilters = () => setSelectedItemFilters(new Set());

  const filteredAndSorted = useMemo(() => {
    let result = rows.filter((r) => {
      // Text search
      const matchesSearch =
        !searchQuery ||
        r.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.personalNumber && r.personalNumber.includes(searchQuery)) ||
        (r.department && r.department.toLowerCase().includes(searchQuery.toLowerCase()));

      // Complete / incomplete
      const isComplete = r.inBoxTotal >= r.totalRequired;
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "complete" && isComplete) ||
        (filterStatus === "incomplete" && !isComplete);

      // Item filter: show only rows missing ANY of the selected items
      const matchesItems =
        selectedItemFilters.size === 0 ||
        r.templateStatus.some(
          (ts) => selectedItemFilters.has(ts.equipmentItemId) && ts.missing > 0
        );

      return matchesSearch && matchesStatus && matchesItems;
    });

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      const pctA = a.totalRequired > 0 ? a.inBoxTotal / a.totalRequired : 0;
      const pctB = b.totalRequired > 0 ? b.inBoxTotal / b.totalRequired : 0;

      switch (sortField) {
        case "userName":
          cmp = a.userName.localeCompare(b.userName, "he");
          break;
        case "department":
          cmp = (a.department ?? "").localeCompare(b.department ?? "", "he");
          break;
        case "pct":
          cmp = pctA - pctB;
          break;
        case "inBoxTotal":
          cmp = a.inBoxTotal - b.inBoxTotal;
          break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [rows, searchQuery, filterStatus, selectedItemFilters, sortField, sortDir]);

  const totalBoxes = rows.length;
  const completeBoxes = rows.filter((r) => r.inBoxTotal >= r.totalRequired).length;

  // Count how many boxes are missing each item (for the filter chips)
  const missingCountByItem = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of rows) {
      for (const ts of row.templateStatus) {
        if (ts.missing > 0) {
          map[ts.equipmentItemId] = (map[ts.equipmentItemId] ?? 0) + 1;
        }
      }
    }
    return map;
  }, [rows]);

  const SortHeader = ({
    field,
    label,
    className = "",
  }: {
    field: SortField;
    label: string;
    className?: string;
  }) => (
    <th className={`px-4 py-3 ${className}`}>
      <button
        onClick={() => handleSort(field)}
        className="inline-flex items-center gap-1 hover:text-zinc-300 transition-colors cursor-pointer select-none"
      >
        {label}
        <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
      </button>
    </th>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Stats Bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[140px] rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-2xl font-bold text-zinc-50">{totalBoxes}</div>
          <div className="text-xs text-zinc-500 mt-1">סה״כ קרטונים</div>
        </div>
        <div className="flex-1 min-w-[140px] rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-4">
          <div className="text-2xl font-bold text-emerald-400">{completeBoxes}</div>
          <div className="text-xs text-zinc-500 mt-1">מלאים</div>
        </div>
        <div className="flex-1 min-w-[140px] rounded-xl border border-amber-900/40 bg-amber-950/10 p-4">
          <div className="text-2xl font-bold text-amber-400">{totalBoxes - completeBoxes}</div>
          <div className="text-xs text-zinc-500 mt-1">חסרים</div>
        </div>
        <div className="flex-1 min-w-[140px] rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-2xl font-bold text-zinc-50">{filteredAndSorted.length}</div>
          <div className="text-xs text-zinc-500 mt-1">מוצגים</div>
        </div>
      </div>

      {/* Search + Status filter row */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="חיפוש לפי שם, מ״א או מחלקה..."
          className="h-12 flex-1 min-w-[200px] rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 placeholder:text-zinc-600 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
        />
        <div className="flex gap-2">
          {(["all", "complete", "incomplete"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`h-12 px-5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === status
                  ? status === "all"
                    ? "bg-zinc-50 text-zinc-950"
                    : status === "complete"
                      ? "bg-emerald-600 text-white"
                      : "bg-amber-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50"
              }`}
            >
              {status === "all" ? "הכל" : status === "complete" ? "מלאים" : "חסרים"}
            </button>
          ))}
        </div>
        {/* Toggle item filter panel */}
        <button
          onClick={() => setShowItemFilter((v) => !v)}
          className={`h-12 px-5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            showItemFilter || selectedItemFilters.size > 0
              ? "bg-violet-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          סינון לפי פריט
          {selectedItemFilters.size > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-white text-[10px] font-black">
              {selectedItemFilters.size}
            </span>
          )}
        </button>
      </div>

      {/* Item filter panel */}
      {showItemFilter && (
        <div className="rounded-2xl border border-violet-900/30 bg-violet-950/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-zinc-300">
              סנן לפי פריטים חסרים
              <span className="text-xs text-zinc-500 font-normal mr-2">
                — הצג רק חיילים שחסר להם הפריט
              </span>
            </div>
            {selectedItemFilters.size > 0 && (
              <button
                onClick={clearItemFilters}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
              >
                נקה הכל
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {templateItems.map((item) => {
              const missingCount = missingCountByItem[item.equipmentItemId] ?? 0;
              const isActive = selectedItemFilters.has(item.equipmentItemId);
              return (
                <button
                  key={item.equipmentItemId}
                  onClick={() => toggleItemFilter(item.equipmentItemId)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    isActive
                      ? "bg-violet-600 text-white border-violet-500"
                      : missingCount > 0
                        ? "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                        : "bg-zinc-900 text-zinc-600 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-400"
                  }`}
                >
                  {item.name}
                  {missingCount > 0 && (
                    <span
                      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black ${
                        isActive ? "bg-white/20 text-white" : "bg-red-900/40 text-red-400"
                      }`}
                    >
                      {missingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedItemFilters.size > 0 && (
            <div className="mt-3 text-xs text-zinc-500">
              מציג {filteredAndSorted.length} חיילים שחסר להם לפחות אחד מהפריטים שנבחרו
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {filteredAndSorted.length === 0 ? (
        <div className="py-10 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-2xl border border-zinc-800 border-dashed">
          {rows.length === 0 ? "אין קרטונים במערכת" : "לא נמצאו קרטונים תואמים"}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                <SortHeader field="userName" label="חייל" className="text-right" />
                <SortHeader field="department" label="מחלקה" className="text-right" />
                <SortHeader field="inBoxTotal" label="מצב קרטון" className="text-center" />
                <SortHeader field="pct" label="מילוי" className="text-center" />
                <SortHeader field="createdAt" label="תאריך יצירה" className="text-right" />
                <th className="px-4 py-3 text-center">פרטים</th>
                <th className="px-4 py-3 text-center">עריכה</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((row) => {
                const isComplete = row.inBoxTotal >= row.totalRequired;
                const pct = row.totalRequired > 0 ? Math.round((row.inBoxTotal / row.totalRequired) * 100) : 0;
                const isExpanded = expandedBoxId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr
                      className={`border-b border-zinc-800 transition-colors cursor-pointer ${isExpanded ? "bg-zinc-900" : "hover:bg-zinc-900/50"}`}
                      onClick={() => setExpandedBoxId(isExpanded ? null : row.id)}
                    >
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-zinc-50">{row.userName}</span>
                          {row.personalNumber && (
                            <span className="text-xs text-zinc-500 mt-0.5">מ״א: {row.personalNumber}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-400">{row.department ?? "-"}</td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                            isComplete
                              ? "bg-emerald-900/20 text-emerald-400 border border-emerald-900/40"
                              : pct >= 50
                                ? "bg-amber-900/20 text-amber-400 border border-amber-900/40"
                                : "bg-red-900/20 text-red-400 border border-red-900/40"
                          }`}
                        >
                          {row.inBoxTotal}/{row.totalRequired}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="w-full max-w-[120px] mx-auto">
                          <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isComplete ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"
                              }`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <div className="text-xs text-zinc-500 text-center mt-1">{pct}%</div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-400">
                        {new Date(row.createdAt).toLocaleDateString("he-IL")}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedBoxId(isExpanded ? null : row.id); }}
                          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditBoxId(row.id); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-900/20 text-amber-400 border border-amber-900/40 hover:bg-amber-900/40 transition-all cursor-pointer"
                        >
                          עריכה
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="bg-zinc-950/70 px-4 pb-4 pt-2">
                          <div className="rounded-xl border border-zinc-800 overflow-hidden">
                            <table className="w-full">
                              <thead>
                                <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase border-b border-zinc-800">
                                  <th className="px-4 py-2 text-right">פריט</th>
                                  <th className="px-4 py-2 text-center">נדרש</th>
                                  <th className="px-4 py-2 text-center">בקרטון</th>
                                  <th className="px-4 py-2 text-center">חסר</th>
                                  <th className="px-4 py-2 text-right">סיבה</th>
                                  <th className="px-4 py-2 text-center">במלאי ימ״ח</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.templateStatus.map((ts) => {
                                  const isFilteredItem = selectedItemFilters.has(ts.equipmentItemId);
                                  return (
                                    <tr
                                      key={ts.equipmentItemId}
                                      className={`border-b border-zinc-800 last:border-0 ${
                                        ts.missing > 0
                                          ? isFilteredItem
                                            ? "bg-violet-950/20"
                                            : "bg-red-950/5"
                                          : ""
                                      }`}
                                    >
                                      <td className="px-4 py-2.5 text-sm font-medium text-zinc-50">
                                        <span className="flex items-center gap-2">
                                          {ts.name}
                                          {isFilteredItem && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-900/30 text-violet-400 border border-violet-900/40">
                                              מסונן
                                            </span>
                                          )}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 text-center text-sm text-zinc-400">{ts.required}</td>
                                      <td className="px-4 py-2.5 text-center">
                                        <span className={`text-sm font-bold ${ts.inBox >= ts.required ? "text-emerald-400" : "text-amber-400"}`}>
                                          {ts.inBox}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 text-center">
                                        {ts.missing > 0 ? (
                                          <span className="text-sm font-bold text-red-400">{ts.missing}</span>
                                        ) : (
                                          <span className="text-sm text-emerald-400">✓</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2.5 text-sm text-zinc-400">{ts.missingReason ?? "-"}</td>
                                      <td className="px-4 py-2.5 text-center text-sm text-zinc-400">{ts.inStorage}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Box Edit Modal */}
      {editBoxId && (() => {
        const boxRow = rows.find((r) => r.id === editBoxId);
        if (!boxRow) return null;
        return (
          <BoxEditModal
            box={{ id: boxRow.id, userId: boxRow.userId, userName: boxRow.userName, personalNumber: boxRow.personalNumber, items: boxRow.items }}
            allUsers={allUsers}
            onClose={() => setEditBoxId(null)}
          />
        );
      })()}
    </div>
  );
}
