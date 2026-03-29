"use client";

import { useState, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { BoxEditModal } from "./BoxEditModal";
import { createEmptyBoxAction } from "./actions";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

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

interface TemplateItemForAdd {
  equipmentItemId: string;
  equipmentItemName: string;
  groupName: string | null;
  quantity: number;
  alternatives: { equipmentItemId: string; equipmentItemName: string }[];
}

interface UserWithoutBox {
  id: string;
  name: string;
  personalNumber: string | null;
  department: string | null;
}

interface BoxListProps {
  rows: BoxRow[];
  allUsers: TransferUser[];
  templateItemsForAdd: TemplateItemForAdd[];
  yamahStockByItemId: Record<string, number>;
  totalActiveUsers: number;
  usersWithoutBox: UserWithoutBox[];
}

interface ItemFilterOption {
  id: string;       // primary equipmentItemId — used for groupIdsByPrimary lookup
  label: string;    // groupName if set, otherwise primary item name
  altCount: number; // number of alternatives in the group
}

function qtyInBox(row: BoxRow, equipmentItemId: string): number {
  return row.items.filter((bi) => bi.equipmentItemId === equipmentItemId).reduce((s, bi) => s + bi.quantity, 0);
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

export function BoxList({ rows, allUsers, templateItemsForAdd, yamahStockByItemId, totalActiveUsers, usersWithoutBox }: BoxListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statFilter, setStatFilter] = useState<"all" | "complete" | "incomplete" | "nobox">("all");
  const [expandedBoxId, setExpandedBoxId] = useState<string | null>(null);
  const [editBoxId, setEditBoxId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("userName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedItemFilters, setSelectedItemFilters] = useState<Set<string>>(new Set());
  const [itemFilterMode, setItemFilterMode] = useState<"missing" | "present">("missing");
  /** When true, item chip counts in "חסר" mode also count active users who have no box row (treated as 0 for every SKU). Default off. */
  const [includeNoBoxInItemCounts, setIncludeNoBoxInItemCounts] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [showItemFilter, setShowItemFilter] = useState(false);
  const [creatingBoxForUserId, setCreatingBoxForUserId] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [recoverResult, setRecoverResult] = useState<string | null>(null);

  async function handleRecoverBoxes() {
    if (!confirm("לשחזר קרטונים אוטומטית מהקצאות קיימות? פעולה זו תעביר הקצאות פעילות (שמוגדרות בתבנית הקרטון) לתוך הקרטונים.")) return;
    setRecovering(true);
    setRecoverResult(null);
    try {
      const res = await fetch("/api/admin/recover-boxes", { method: "POST" });
      const data = await res.json() as { success: boolean; message: string; moved?: number; users?: number };
      setRecoverResult(data.message);
      if (data.success && (data.moved ?? 0) > 0) router.refresh();
    } catch {
      setRecoverResult("שגיאה בשחזור — בדוק את הקונסול");
    } finally {
      setRecovering(false);
    }
  }

  /** One chip per template slot — uses groupName when set, otherwise the primary item name. */
  const itemFilterOptions = useMemo<ItemFilterOption[]>(() =>
    templateItemsForAdd.map((t) => ({
      id: t.equipmentItemId,
      label: t.groupName?.trim() || t.equipmentItemName,
      altCount: t.alternatives.length,
    })),
  [templateItemsForAdd]);

  const groupIdsByPrimary = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const t of templateItemsForAdd) {
      m[t.equipmentItemId] = [t.equipmentItemId, ...t.alternatives.map((a) => a.equipmentItemId)];
    }
    return m;
  }, [templateItemsForAdd]);

  /** Reverse lookup: any item ID (primary OR alt) → all IDs in its template group */
  const groupIdsByAnyId = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const ids of Object.values(groupIdsByPrimary)) {
      for (const id of ids) m[id] = ids;
    }
    return m;
  }, [groupIdsByPrimary]);

  const filteredItemOptions = useMemo(() => {
    const q = itemSearchQuery.trim().toLowerCase();
    if (!q) return itemFilterOptions;
    return itemFilterOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [itemFilterOptions, itemSearchQuery]);

  /** How many people match this mode for the given equipment id.
   *  Counts by GROUP — if any alternative in the same template slot is present, the slot is not missing. */
  const filterMatchCountByItemId = useMemo(() => {
    const map: Record<string, number> = {};
    const noBoxExtra =
      includeNoBoxInItemCounts && itemFilterMode === "missing" ? usersWithoutBox.length : 0;
    for (const opt of itemFilterOptions) {
      const groupIds = groupIdsByAnyId[opt.id] ?? [opt.id];
      let n = noBoxExtra;
      for (const row of rows) {
        const groupQty = groupIds.reduce((s, id) => s + qtyInBox(row, id), 0);
        if (itemFilterMode === "missing") {
          if (groupQty === 0) n++;
        } else if (groupQty > 0) {
          n++;
        }
      }
      map[opt.id] = n;
    }
    return map;
  }, [rows, itemFilterOptions, itemFilterMode, includeNoBoxInItemCounts, usersWithoutBox.length, groupIdsByAnyId]);

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
    if (statFilter === "nobox") return [];

    let result = rows.filter((r) => {
      const matchesSearch =
        !searchQuery ||
        r.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.personalNumber && r.personalNumber.includes(searchQuery)) ||
        (r.department && r.department.toLowerCase().includes(searchQuery.toLowerCase()));

      const isComplete = r.inBoxTotal >= r.totalRequired;
      const matchesStatus =
        statFilter === "all" ||
        (statFilter === "complete" && isComplete) ||
        (statFilter === "incomplete" && !isComplete);

      const matchesItems =
        selectedItemFilters.size === 0 ||
        [...selectedItemFilters].some((fid) => {
          const groupIds = groupIdsByAnyId[fid] ?? [fid];
          const groupQty = groupIds.reduce((s, id) => s + qtyInBox(r, id), 0);
          return itemFilterMode === "missing" ? groupQty === 0 : groupQty > 0;
        });

      return matchesSearch && matchesStatus && matchesItems;
    });

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
  }, [rows, searchQuery, statFilter, selectedItemFilters, itemFilterMode, sortField, sortDir, groupIdsByAnyId]);

  const filteredNoBoxUsers = useMemo(() => {
    if (statFilter !== "nobox") return [];
    if (!searchQuery) return usersWithoutBox;
    const q = searchQuery.toLowerCase();
    return usersWithoutBox.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.personalNumber && u.personalNumber.includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q))
    );
  }, [statFilter, usersWithoutBox, searchQuery]);

  const handleCreateEmptyBox = async (userId: string) => {
    setCreatingBoxForUserId(userId);
    const res = await createEmptyBoxAction(userId);
    setCreatingBoxForUserId(null);
    if (res.success) {
      router.refresh();
    }
  };

  const totalBoxes = rows.length;
  const completeBoxes = rows.filter((r) => r.inBoxTotal >= r.totalRequired).length;

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
      {/* Stats Bar — clickable filters */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setStatFilter("all")}
          className={`flex-1 min-w-[140px] rounded-xl border p-4 text-right transition-all cursor-pointer ${
            statFilter === "all"
              ? "border-zinc-500 bg-zinc-800 ring-2 ring-zinc-500/30"
              : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
          }`}
        >
          <div className="text-2xl font-bold text-zinc-50">{totalBoxes}</div>
          <div className="text-xs text-zinc-500 mt-1">סה״כ קרטונים</div>
        </button>
        <button
          onClick={() => setStatFilter("complete")}
          className={`flex-1 min-w-[140px] rounded-xl border p-4 text-right transition-all cursor-pointer ${
            statFilter === "complete"
              ? "border-emerald-500 bg-emerald-950/30 ring-2 ring-emerald-500/30"
              : "border-emerald-900/40 bg-emerald-950/10 hover:border-emerald-700/60"
          }`}
        >
          <div className="text-2xl font-bold text-emerald-400">{completeBoxes}</div>
          <div className="text-xs text-zinc-500 mt-1">מלאים</div>
        </button>
        <button
          onClick={() => setStatFilter("incomplete")}
          className={`flex-1 min-w-[140px] rounded-xl border p-4 text-right transition-all cursor-pointer ${
            statFilter === "incomplete"
              ? "border-amber-500 bg-amber-950/30 ring-2 ring-amber-500/30"
              : "border-amber-900/40 bg-amber-950/10 hover:border-amber-700/60"
          }`}
        >
          <div className="text-2xl font-bold text-amber-400">{totalBoxes - completeBoxes}</div>
          <div className="text-xs text-zinc-500 mt-1">חסרים</div>
        </button>
        {usersWithoutBox.length > 0 && (
          <button
            onClick={() => setStatFilter("nobox")}
            className={`flex-1 min-w-[140px] rounded-xl border p-4 text-right transition-all cursor-pointer ${
              statFilter === "nobox"
                ? "border-red-500 bg-red-950/30 ring-2 ring-red-500/30"
                : "border-red-900/40 bg-red-950/10 hover:border-red-700/60"
            }`}
          >
            <div className="text-2xl font-bold text-red-400">{usersWithoutBox.length}</div>
            <div className="text-xs text-zinc-500 mt-1">ללא קרטון</div>
          </button>
        )}
      </div>

      {/* Recovery banner — shown when there are no boxes yet */}
      {rows.length === 0 && (
        <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-300">אין קרטונים — שחזר מהקצאות קיימות</p>
            <p className="text-xs text-zinc-400 mt-0.5">אם יש לחיילים ציוד מוקצה שהיה בקרטונים, לחץ על שחזר כדי להעביר אותו בחזרה לקרטונים.</p>
          </div>
          <button
            onClick={handleRecoverBoxes}
            disabled={recovering}
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-60 transition-colors"
          >
            {recovering ? <LoadingSpinner size="sm" /> : "♻ שחזר קרטונים"}
          </button>
          {recoverResult && <p className="text-xs text-emerald-400 sm:self-center">{recoverResult}</p>}
        </div>
      )}

      {/* Search + Item filter toggle */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="חיפוש לפי שם, מ״א או מחלקה..."
          className="h-12 flex-1 min-w-[200px] rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 placeholder:text-zinc-600 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
        />
        {statFilter !== "nobox" && (
          <button
            onClick={() => setShowItemFilter((v) => !v)}
            className={`h-12 px-5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              showItemFilter || selectedItemFilters.size > 0
                ? itemFilterMode === "present"
                  ? "bg-teal-600 text-white shadow-lg shadow-teal-900/30"
                  : "bg-rose-600 text-white shadow-lg shadow-rose-900/30"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            סינון לפי פריט
            {selectedItemFilters.size > 0 && (
              <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1 rounded-full bg-white/20 text-white text-[10px] font-black">
                {selectedItemFilters.size}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Item filter panel */}
      {showItemFilter && (
        <div
          className={`rounded-2xl border p-5 transition-colors ${
            itemFilterMode === "present"
              ? "border-teal-900/40 bg-gradient-to-br from-teal-950/25 to-zinc-950/80"
              : "border-rose-900/40 bg-gradient-to-br from-rose-950/20 to-zinc-950/80"
          }`}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1 space-y-2">
              <h4 className="text-sm font-bold text-zinc-100">סינון לפי פריט בקרטון</h4>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-xl">
                בחירת פריט (כולל חלופות) — כל חלופות בקבוצה נספרות יחד. מצב &quot;חסר&quot;: מי שאין לו שום פריט מהקבוצה. מצב &quot;קיים&quot;: מי שיש לו לפחות אחת.
              </p>
            </div>
            {/* Mode switch */}
            <div className="flex-shrink-0 flex rounded-2xl p-1 bg-zinc-900 border border-zinc-800 shadow-inner">
              <button
                type="button"
                onClick={() => setItemFilterMode("missing")}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  itemFilterMode === "missing"
                    ? "bg-rose-600 text-white shadow-md"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span className="inline-block w-2 h-2 rounded-full bg-current opacity-80" />
                חסר בקרטון
              </button>
              <button
                type="button"
                onClick={() => setItemFilterMode("present")}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  itemFilterMode === "present"
                    ? "bg-teal-600 text-white shadow-md"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span className="inline-block w-2 h-2 rounded-full bg-current opacity-80" />
                קיים בקרטון
              </button>
            </div>
          </div>

          {usersWithoutBox.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <input
                id="includeNoBoxInItemCounts"
                type="checkbox"
                checked={includeNoBoxInItemCounts}
                onChange={(e) => setIncludeNoBoxInItemCounts(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-rose-600 focus:ring-rose-500/40 cursor-pointer"
              />
              <label htmlFor="includeNoBoxInItemCounts" className="text-xs text-zinc-400 cursor-pointer select-none">
                כולל קרטונים ריקים
              </label>
            </div>
          )}

          <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 min-w-0 max-w-md">
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={itemSearchQuery}
                onChange={(e) => setItemSearchQuery(e.target.value)}
                placeholder="חיפוש לפי שם פריט או תיאור חלופה..."
                className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 pr-10 pl-4 text-sm text-zinc-50 placeholder:text-zinc-600 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
              />
            </div>
            {selectedItemFilters.size > 0 && (
              <button
                type="button"
                onClick={clearItemFilters}
                className={`text-xs font-bold px-4 py-2 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                  itemFilterMode === "present"
                    ? "border-teal-800 text-teal-400 hover:bg-teal-950/40"
                    : "border-rose-800 text-rose-400 hover:bg-rose-950/40"
                }`}
              >
                נקה בחירת פריטים
              </button>
            )}
          </div>

          <div className="mt-4 max-h-52 overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-2">
            {filteredItemOptions.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">לא נמצאו פריטים תואמים לחיפוש</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredItemOptions.map((opt) => {
                  const count = filterMatchCountByItemId[opt.id] ?? 0;
                  const isActive = selectedItemFilters.has(opt.id);
                  const dim = count === 0;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleItemFilter(opt.id)}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 transition-all cursor-pointer ${
                        isActive
                          ? itemFilterMode === "present"
                            ? "bg-teal-600 border-teal-500 text-white shadow-md"
                            : "bg-rose-600 border-rose-500 text-white shadow-md"
                          : dim
                            ? "border-zinc-800 bg-zinc-900/40 text-zinc-600 hover:border-zinc-700"
                            : "border-zinc-700 bg-zinc-800/60 text-zinc-200 hover:border-zinc-600"
                      }`}
                    >
                      <span className="text-xs font-bold">{opt.label}</span>
                      {opt.altCount > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                          isActive ? "border-white/30 bg-white/10 text-white" : "border-zinc-700 bg-zinc-800 text-zinc-400"
                        }`}>
                          +{opt.altCount}
                        </span>
                      )}
                      <span className={`shrink-0 inline-flex items-center justify-center min-w-[22px] h-5 px-1 rounded-lg text-[10px] font-black ${
                        isActive ? "bg-black/25 text-white" : itemFilterMode === "present" ? "bg-teal-950/50 text-teal-400" : "bg-rose-950/50 text-rose-400"
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedItemFilters.size > 0 && (
            <div
              className={`mt-4 text-xs font-medium px-3 py-2 rounded-xl border ${
                itemFilterMode === "present"
                  ? "border-teal-900/50 bg-teal-950/15 text-teal-100/90"
                  : "border-rose-900/50 bg-rose-950/15 text-rose-100/90"
              }`}
            >
              מציג <strong>{filteredAndSorted.length}</strong> קרטונים · התאמה אם <strong>לפחות אחד</strong> מהפריטים
              המסומנים:{" "}
              {itemFilterMode === "missing"
                ? "אין לו אותו מק״ט בקרטון (כמות 0)."
                : "יש לו לפחות יחידה אחת מאותו מק״ט בקרטון."}
            </div>
          )}
        </div>
      )}

      {/* "No box" users table */}
      {statFilter === "nobox" && (
        <>
          {filteredNoBoxUsers.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-2xl border border-zinc-800 border-dashed">
              {usersWithoutBox.length === 0 ? "כל המשתמשים הפעילים מחזיקים קרטון" : "לא נמצאו משתמשים תואמים"}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                    <th className="px-4 py-3 text-right">חייל</th>
                    <th className="px-4 py-3 text-right">מ״א</th>
                    <th className="px-4 py-3 text-right">מחלקה</th>
                    <th className="px-4 py-3 text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNoBoxUsers.map((u) => (
                    <tr key={u.id} className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors">
                      <td className="px-4 py-4 font-bold text-sm text-zinc-50">{u.name}</td>
                      <td className="px-4 py-4 text-sm text-zinc-400">{u.personalNumber ?? "-"}</td>
                      <td className="px-4 py-4 text-sm text-zinc-400">{u.department ?? "-"}</td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => handleCreateEmptyBox(u.id)}
                          disabled={creatingBoxForUserId === u.id}
                          className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-900/20 text-emerald-400 border border-emerald-900/40 hover:bg-emerald-900/40 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {creatingBoxForUserId === u.id ? "יוצר..." : "צור קרטון"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Table — boxes with items */}
      {statFilter !== "nobox" && filteredAndSorted.length === 0 ? (
        <div className="py-10 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-2xl border border-zinc-800 border-dashed">
          {rows.length === 0 ? "אין קרטונים במערכת" : "לא נמצאו קרטונים תואמים"}
        </div>
      ) : statFilter !== "nobox" && (
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
                                  const slotGroupIds = groupIdsByPrimary[ts.equipmentItemId] ?? [ts.equipmentItemId];
                                  const isFilteredItem =
                                    selectedItemFilters.size > 0 &&
                                    [...selectedItemFilters].some((fid) => slotGroupIds.includes(fid));
                                  return (
                                    <tr
                                      key={ts.equipmentItemId}
                                      className={`border-b border-zinc-800 last:border-0 ${
                                        isFilteredItem
                                          ? itemFilterMode === "present"
                                            ? "bg-teal-950/25"
                                            : "bg-rose-950/25"
                                          : ts.missing > 0
                                            ? "bg-red-950/5"
                                            : ""
                                      }`}
                                    >
                                      <td className="px-4 py-2.5 text-sm font-medium text-zinc-50">
                                        <span className="flex items-center gap-2">
                                          {ts.name}
                                          {isFilteredItem && (
                                            <span
                                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                                itemFilterMode === "present"
                                                  ? "bg-teal-900/30 text-teal-300 border-teal-800/50"
                                                  : "bg-rose-900/30 text-rose-300 border-rose-800/50"
                                              }`}
                                            >
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
            addableItems={(() => {
              return templateItemsForAdd.flatMap((tplItem) => {
                const groupIds = [tplItem.equipmentItemId, ...tplItem.alternatives.map((a) => a.equipmentItemId)];
                const inBox = boxRow.items
                  .filter((bi) => groupIds.includes(bi.equipmentItemId))
                  .reduce((s, bi) => s + bi.quantity, 0);
                const remaining = tplItem.quantity - inBox;
                const candidates: { id: string; name: string; stock: number; capacity: number }[] = [];
                const addCandidate = (id: string, name: string) => {
                  const stock = yamahStockByItemId[id] ?? 0;
                  if (stock > 0 && remaining > 0) candidates.push({ id, name, stock, capacity: remaining });
                };
                addCandidate(tplItem.equipmentItemId, tplItem.equipmentItemName);
                tplItem.alternatives.forEach((a) => addCandidate(a.equipmentItemId, a.equipmentItemName));
                return candidates;
              });
            })()}
            onClose={() => setEditBoxId(null)}
          />
        );
      })()}
    </div>
  );
}
