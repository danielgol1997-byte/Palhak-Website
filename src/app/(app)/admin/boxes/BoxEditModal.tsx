"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ModalPortal } from "@/components/ui/ModalPortal";
import {
  addToBoxDirectBulkAction,
  removeFromBoxAction,
  restoreFromBoxAction,
  transferBoxItemAction,
} from "../users/[id]/equipment-actions";

interface BoxItemRow {
  id: string;
  equipmentItemId: string;
  quantity: number;
  serialNumber: string | null;
  movedAt: Date;
  equipmentItem: { id: string; name: string };
}

interface BoxData {
  id: string;
  userId: string;
  userName: string;
  personalNumber: string | null;
  items: BoxItemRow[];
}

interface TransferUser {
  id: string;
  name: string;
  personalNumber: string | null;
}

interface AddableItem {
  id: string;
  name: string;
  stock: number;
  capacity: number;
}

interface BoxEditModalProps {
  box: BoxData;
  allUsers: TransferUser[];
  addableItems: AddableItem[];
  onClose: () => void;
}

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

type ActionMode = "restore" | "remove" | "transfer";

interface PendingAction {
  mode: ActionMode;
  item: BoxItemRow;
  quantity: number;
}

export function BoxEditModal({ box, allUsers, addableItems, onClose }: BoxEditModalProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transferSearch, setTransferSearch] = useState("");
  const [transferToUserId, setTransferToUserId] = useState<string | null>(null);

  // Add-to-box state (multi-select)
  const [showAddPanel, setShowAddPanel] = useState(false);
  /** equipmentItemId -> draft qty + optional serial */
  const [addSelection, setAddSelection] = useState<Record<string, { qty: number; serial: string }>>({});
  const [addNotes, setAddNotes] = useState("");

  const selectedCount = Object.keys(addSelection).length;

  const toggleAddItem = (item: AddableItem) => {
    setAddSelection((prev) => {
      const next = { ...prev };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = { qty: 1, serial: "" };
      return next;
    });
  };

  const setAddLineQty = (itemId: string, qty: number, cap: number, stock: number) => {
    const max = Math.min(Math.max(1, cap), stock);
    setAddSelection((prev) => {
      if (!prev[itemId]) return prev;
      return { ...prev, [itemId]: { ...prev[itemId], qty: Math.min(Math.max(1, qty), max) } };
    });
  };

  const setAddLineSerial = (itemId: string, serial: string) => {
    setAddSelection((prev) => {
      if (!prev[itemId]) return prev;
      return { ...prev, [itemId]: { ...prev[itemId], serial, qty: serial.trim() ? 1 : prev[itemId].qty } };
    });
  };

  const selectAllAddable = () => {
    const next: Record<string, { qty: number; serial: string }> = {};
    for (const item of addableItems) {
      next[item.id] = { qty: 1, serial: "" };
    }
    setAddSelection(next);
  };

  const clearAddSelection = () => setAddSelection({});

  // Exclude current box owner from transfer targets
  const transferTargets = useMemo(
    () => allUsers.filter((u) => u.id !== box.userId),
    [allUsers, box.userId],
  );

  const filteredTransferTargets = useMemo(() => {
    const q = transferSearch.trim().toLowerCase();
    if (!q) return transferTargets;
    return transferTargets.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.personalNumber && t.personalNumber.toLowerCase().includes(q)),
    );
  }, [transferTargets, transferSearch]);

  const openAction = (mode: ActionMode, item: BoxItemRow) => {
    setPendingAction({ mode, item, quantity: item.quantity });
    setError(null);
    setTransferSearch("");
    setTransferToUserId(null);
  };

  const closeAction = () => {
    if (!isSubmitting) {
      setPendingAction(null);
      setError(null);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!pendingAction) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      let result: { success: boolean; error?: string };

      if (pendingAction.mode === "restore") {
        fd.append("userId", box.userId);
        fd.append("boxItemId", pendingAction.item.id);
        fd.append("quantity", pendingAction.quantity.toString());
        result = await restoreFromBoxAction(fd);
      } else if (pendingAction.mode === "remove") {
        fd.append("userId", box.userId);
        fd.append("boxItemId", pendingAction.item.id);
        fd.append("quantity", pendingAction.quantity.toString());
        result = await removeFromBoxAction(fd);
      } else {
        if (!transferToUserId) {
          setError("יש לבחור חייל יעד.");
          setIsSubmitting(false);
          return;
        }
        fd.append("fromUserId", box.userId);
        fd.append("toUserId", transferToUserId);
        fd.append("boxItemId", pendingAction.item.id);
        fd.append("quantity", pendingAction.quantity.toString());
        result = await transferBoxItemAction(fd);
      }

      if (!result.success) {
        setError(result.error || "אירעה שגיאה");
      } else {
        setPendingAction(null);
        router.refresh();
        onClose();
      }
    } catch {
      setError("אירעה שגיאה בלתי צפויה");
    } finally {
      setIsSubmitting(false);
    }
  }, [pendingAction, box.userId, transferToUserId, router, onClose]);

  const handleAddDirect = useCallback(async () => {
    if (selectedCount === 0 || !addNotes.trim()) return;
    const lines = Object.entries(addSelection).map(([equipmentItemId, draft]) => ({
      equipmentItemId,
      quantity: draft.serial.trim() ? 1 : draft.qty,
      ...(draft.serial.trim() ? { serialNumber: draft.serial.trim() } : {}),
    }));
    setIsSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("userId", box.userId);
      fd.append("adminNotes", addNotes.trim());
      fd.append("lines", JSON.stringify(lines));
      const result = await addToBoxDirectBulkAction(fd);
      if (!result.success) {
        setError(result.error || "אירעה שגיאה");
      } else {
        setShowAddPanel(false);
        setAddSelection({});
        setAddNotes("");
        router.refresh();
        onClose();
      }
    } catch {
      setError("אירעה שגיאה בלתי צפויה");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedCount, addSelection, addNotes, box.userId, router, onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        if (pendingAction) closeAction();
        else onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubmitting, pendingAction, onClose]);

  const actionTitle =
    pendingAction?.mode === "restore"
      ? "שחזור מקרטון"
      : pendingAction?.mode === "remove"
        ? "הסרה מקרטון"
        : "העברה לקרטון אחר";

  const actionColor =
    pendingAction?.mode === "restore"
      ? "text-blue-400"
      : pendingAction?.mode === "remove"
        ? "text-red-400"
        : "text-sky-400";

  const confirmBtnClass =
    pendingAction?.mode === "restore"
      ? "bg-blue-600 hover:bg-blue-500"
      : pendingAction?.mode === "remove"
        ? "bg-red-600 hover:bg-red-500"
        : "bg-sky-600 hover:bg-sky-500";

  const borderColor =
    pendingAction?.mode === "restore"
      ? "border-blue-900/40 bg-blue-950/10"
      : pendingAction?.mode === "remove"
        ? "border-red-900/40 bg-red-950/10"
        : "border-sky-900/40 bg-sky-950/10";

  const confirmLabel =
    pendingAction?.mode === "restore"
      ? "שחזר לחייל"
      : pendingAction?.mode === "remove"
        ? "הסר מקרטון"
        : "העבר לקרטון";

  const totalInBox = box.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto overscroll-contain p-4" dir="rtl">
      <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => !isSubmitting && !pendingAction && onClose()} />
      <div className="relative w-full max-w-2xl rounded-3xl bg-zinc-900 shadow-2xl border border-zinc-800 animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-zinc-800 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-zinc-50">{box.userName}</h2>
            {box.personalNumber && <div className="text-xs text-zinc-500 mt-0.5">מ״א: {box.personalNumber}</div>}
            <div className="text-sm text-amber-400 mt-1">{totalInBox} פריטים בקרטון</div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {addableItems.length > 0 && (
              <button
                onClick={() => { setShowAddPanel((v) => !v); setPendingAction(null); setError(null); }}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-900/20 text-emerald-400 border border-emerald-900/40 hover:bg-emerald-900/40 transition-all cursor-pointer disabled:opacity-50"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                {showAddPanel ? "סגור" : "הוסף פריט"}
              </button>
            )}
            <button
              onClick={() => !isSubmitting && onClose()}
              disabled={isSubmitting}
              className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Add to box panel */}
        {showAddPanel && (
          <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-zinc-800 bg-emerald-950/10">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-emerald-400">הוספה ישירה לקרטון מימ״ח</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllAddable}
                  disabled={isSubmitting || addableItems.length === 0}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg border border-emerald-800 text-emerald-400 hover:bg-emerald-900/30 cursor-pointer disabled:opacity-40"
                >
                  בחר הכל
                </button>
                <button
                  type="button"
                  onClick={clearAddSelection}
                  disabled={isSubmitting || selectedCount === 0}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 cursor-pointer disabled:opacity-40"
                >
                  נקה בחירה
                </button>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 mb-2">סמן כמה פריטים, הגדר כמות לכל שורה (ומ״ס אם צריך), ואז אשר הוספה אחת.</p>
            <div className="space-y-3">
              <div className="max-h-44 overflow-y-auto rounded-xl border border-zinc-800 divide-y divide-zinc-800">
                {addableItems.map((item) => {
                  const checked = Boolean(addSelection[item.id]);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 px-4 py-2.5 text-right ${checked ? "bg-emerald-900/20" : "hover:bg-zinc-800/50"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAddItem(item)}
                        disabled={isSubmitting}
                        className="mt-1 h-4 w-4 rounded border-zinc-600 accent-emerald-500 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => toggleAddItem(item)}
                        disabled={isSubmitting}
                        className="flex-1 text-right cursor-pointer disabled:cursor-not-allowed"
                      >
                        <div className="text-sm font-bold text-zinc-100">{item.name}</div>
                        <div className="text-xs text-zinc-500">מלאי ימ״ח: {item.stock} | נותר בקרטון: {item.capacity}</div>
                      </button>
                    </div>
                  );
                })}
              </div>

              {selectedCount > 0 && (
                <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 max-h-48 overflow-y-auto">
                  <div className="text-xs font-bold text-zinc-400">פריטים שנבחרו ({selectedCount})</div>
                  {addableItems.filter((i) => addSelection[i.id]).map((item) => {
                    const draft = addSelection[item.id];
                    const maxQ = Math.min(item.stock, item.capacity);
                    return (
                      <div key={item.id} className="flex flex-wrap gap-2 items-end border-b border-zinc-800/80 pb-2 last:border-0 last:pb-0">
                        <div className="flex-1 min-w-[120px] text-xs font-bold text-zinc-200">{item.name}</div>
                        <div className="flex-shrink-0">
                          <label className="text-[10px] text-zinc-500 block mb-0.5">כמות</label>
                          <input
                            type="number"
                            min={1}
                            max={maxQ}
                            disabled={Boolean(draft.serial.trim())}
                            value={draft.serial.trim() ? 1 : draft.qty}
                            onChange={(e) =>
                              setAddLineQty(item.id, parseInt(e.target.value, 10) || 1, item.capacity, item.stock)
                            }
                            className="h-8 w-16 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-sm font-bold text-zinc-50 outline-none disabled:opacity-50"
                          />
                        </div>
                        <div className="flex-1 min-w-[140px]">
                          <label className="text-[10px] text-zinc-500 block mb-0.5">מ״ס</label>
                          <input
                            type="text"
                            value={draft.serial}
                            onChange={(e) => setAddLineSerial(item.id, e.target.value)}
                            placeholder="אופציונלי"
                            className="h-8 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-50 placeholder:text-zinc-600 font-mono outline-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <label className="text-xs text-zinc-500 mb-1 block">הערות <span className="text-red-500">*</span></label>
                <input
                  type="text" value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  placeholder="סיבת ההוספה (חובה)..."
                  className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-50 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>

              {error && <div className="text-xs text-red-400 bg-red-900/10 border border-red-900/30 rounded-lg px-3 py-2">{error}</div>}

              <button
                onClick={handleAddDirect}
                disabled={isSubmitting || selectedCount === 0 || !addNotes.trim()}
                className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-bold text-white hover:bg-emerald-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <LoadingSpinner size="sm" />
                ) : selectedCount === 1 ? (
                  "הוסף פריט לקרטון"
                ) : (
                  `הוסף ${selectedCount} פריטים לקרטון`
                )}
              </button>
            </div>
          </div>
        )}

        {/* Action confirmation panel */}
        {pendingAction && (
          <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-zinc-800 bg-zinc-950/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold ${actionColor}`}>{actionTitle}</h3>
              <button onClick={closeAction} disabled={isSubmitting} className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer">ביטול</button>
            </div>
            <div className={`p-3 rounded-xl border ${borderColor} mb-4`}>
              <div className="font-bold text-zinc-50 text-sm">{pendingAction.item.equipmentItem.name}</div>
              {pendingAction.item.serialNumber && (
                <div className="text-xs text-zinc-400 mt-0.5">מ״ס: <span className="font-mono text-zinc-300">{pendingAction.item.serialNumber}</span></div>
              )}
              {pendingAction.mode === "remove" && (
                <div className="text-xs text-amber-400 mt-1">הפריט יוחזר למלאי ימ״ח.</div>
              )}
            </div>

            {/* Quantity selector */}
            {!pendingAction.item.serialNumber && pendingAction.mode !== "transfer" && (
              <div className="mb-4">
                <label className="text-xs font-bold text-zinc-500 mb-1 block">
                  {pendingAction.mode === "restore" ? "כמות לשחזור" : "כמות להסרה"}
                </label>
                <input
                  type="number"
                  min="1"
                  max={pendingAction.item.quantity}
                  value={pendingAction.quantity}
                  onChange={(e) =>
                    setPendingAction((p) =>
                      p ? { ...p, quantity: Math.min(Math.max(1, parseInt(e.target.value) || 1), p.item.quantity) } : p,
                    )
                  }
                  className="h-10 w-32 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm font-bold text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
                />
              </div>
            )}

            {!pendingAction.item.serialNumber && pendingAction.mode === "transfer" && (
              <div className="mb-4">
                <label className="text-xs font-bold text-zinc-500 mb-1 block">כמות להעברה</label>
                <input
                  type="number"
                  min="1"
                  max={pendingAction.item.quantity}
                  value={pendingAction.quantity}
                  onChange={(e) =>
                    setPendingAction((p) =>
                      p ? { ...p, quantity: Math.min(Math.max(1, parseInt(e.target.value) || 1), p.item.quantity) } : p,
                    )
                  }
                  className="h-10 w-32 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm font-bold text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
                />
              </div>
            )}

            {/* Transfer user selector */}
            {pendingAction.mode === "transfer" && (
              <div className="mb-4">
                <label className="text-xs font-bold text-zinc-500 mb-1 block">חייל יעד</label>
                <input
                  type="text"
                  value={transferSearch}
                  onChange={(e) => { setTransferSearch(e.target.value); setTransferToUserId(null); }}
                  placeholder="חיפוש לפי שם או מ״א..."
                  className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-50 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-zinc-500 mb-1"
                />
                <div className="max-h-36 overflow-y-auto rounded-xl border border-zinc-800 divide-y divide-zinc-800">
                  {filteredTransferTargets.length === 0 ? (
                    <div className="py-3 text-center text-xs text-zinc-500">לא נמצאו חיילים</div>
                  ) : filteredTransferTargets.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTransferToUserId(t.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-right transition-colors cursor-pointer ${transferToUserId === t.id ? "bg-sky-900/30 text-sky-300" : "hover:bg-zinc-800 text-zinc-300"}`}
                    >
                      <div className="text-right flex-1">
                        <div className="text-xs font-bold">{t.name}</div>
                        {t.personalNumber && <div className="text-[10px] text-zinc-500">מ״א: {t.personalNumber}</div>}
                      </div>
                      {transferToUserId === t.id && (
                        <svg className="flex-shrink-0 text-sky-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                      )}
                    </button>
                  ))}
                </div>
                {transferToUserId && (
                  <div className="mt-1 text-xs text-sky-400 font-bold">
                    נבחר: {transferTargets.find((t) => t.id === transferToUserId)?.name}
                  </div>
                )}
              </div>
            )}

            {error && <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-3 text-xs text-red-400 mb-3">{error}</div>}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || (pendingAction.mode === "transfer" && !transferToUserId)}
              className={`h-12 w-full inline-flex items-center justify-center gap-2 rounded-2xl ${confirmBtnClass} text-sm font-bold text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? <LoadingSpinner size="sm" /> : confirmLabel}
            </button>
          </div>
        )}

        {/* Box items list */}
        <div className="overflow-y-auto flex-1">
          {box.items.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">הקרטון ריק.</div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                  <th className="px-4 py-3 text-right">פריט</th>
                  <th className="px-4 py-3 text-center">כמות</th>
                  <th className="px-4 py-3 text-right">מ״ס</th>
                  <th className="px-4 py-3 text-right">תאריך</th>
                  <th className="px-4 py-3 text-center">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {box.items.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-900/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-bold text-zinc-50">{item.equipmentItem.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg border border-amber-900/40 bg-amber-900/20 text-sm font-bold text-amber-400">
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {item.serialNumber ? (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-50 font-mono">{item.serialNumber}</span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {new Date(item.movedAt).toLocaleDateString("he-IL")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => openAction("restore", item)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-900/20 text-blue-400 border border-blue-900/40 hover:bg-blue-900/40 transition-all cursor-pointer whitespace-nowrap"
                        >
                          שחזר
                        </button>
                        {transferTargets.length > 0 && (
                          <button
                            onClick={() => openAction("transfer", item)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-sky-900/20 text-sky-400 border border-sky-900/40 hover:bg-sky-900/40 transition-all cursor-pointer whitespace-nowrap"
                          >
                            העבר לקרטון
                          </button>
                        )}
                        <button
                          onClick={() => openAction("remove", item)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-900/20 text-red-400 border border-red-900/40 hover:bg-red-900/40 transition-all cursor-pointer whitespace-nowrap"
                        >
                          הסר
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
