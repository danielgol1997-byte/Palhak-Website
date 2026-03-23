"use client";

import { useState, useMemo, Fragment } from "react";

interface TemplateItemStatus {
  equipmentItemId: string;
  name: string;
  required: number;
  inBox: number;
  missing: number;
  missingReason: string | null;
  inStorage: number;
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
}

interface BoxListProps {
  rows: BoxRow[];
}

export function BoxList({ rows }: BoxListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "complete" | "incomplete">("all");
  const [expandedBoxId, setExpandedBoxId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchesSearch =
        !searchQuery ||
        r.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.personalNumber && r.personalNumber.includes(searchQuery)) ||
        (r.department && r.department.toLowerCase().includes(searchQuery.toLowerCase()));

      const isComplete = r.inBoxTotal >= r.totalRequired;
      const matchesFilter =
        filterStatus === "all" ||
        (filterStatus === "complete" && isComplete) ||
        (filterStatus === "incomplete" && !isComplete);

      return matchesSearch && matchesFilter;
    });
  }, [rows, searchQuery, filterStatus]);

  const totalBoxes = rows.length;
  const completeBoxes = rows.filter((r) => r.inBoxTotal >= r.totalRequired).length;

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
      </div>

      {/* Filters */}
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
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-2xl border border-zinc-800 border-dashed">
          {rows.length === 0 ? "אין קרטונים במערכת" : "לא נמצאו קרטונים תואמים"}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                <th className="px-4 py-3 text-right">חייל</th>
                <th className="px-4 py-3 text-right">מחלקה</th>
                <th className="px-4 py-3 text-center">מצב קרטון</th>
                <th className="px-4 py-3 text-center">מילוי</th>
                <th className="px-4 py-3 text-right">תאריך יצירה</th>
                <th className="px-4 py-3 text-center">פרטים</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
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
                        <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer">
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
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="bg-zinc-950/70 px-4 pb-4 pt-2">
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
                                {row.templateStatus.map((ts) => (
                                  <tr
                                    key={ts.equipmentItemId}
                                    className={`border-b border-zinc-800 last:border-0 ${ts.missing > 0 ? "bg-red-950/5" : ""}`}
                                  >
                                    <td className="px-4 py-2.5 text-sm font-medium text-zinc-50">
                                      {ts.name}
                                    </td>
                                    <td className="px-4 py-2.5 text-center text-sm text-zinc-400">{ts.required}</td>
                                    <td className="px-4 py-2.5 text-center">
                                      <span
                                        className={`text-sm font-bold ${
                                          ts.inBox >= ts.required ? "text-emerald-400" : "text-amber-400"
                                        }`}
                                      >
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
                                    <td className="px-4 py-2.5 text-sm text-zinc-400">
                                      {ts.missingReason ?? "-"}
                                    </td>
                                    <td className="px-4 py-2.5 text-center text-sm text-zinc-400">
                                      {ts.inStorage}
                                    </td>
                                  </tr>
                                ))}
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
    </div>
  );
}
