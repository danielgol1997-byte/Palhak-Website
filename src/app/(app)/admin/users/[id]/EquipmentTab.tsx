"use client";

import { useState } from "react";
import { Division } from "@prisma/client";
import { divisionLabel } from "@/lib/he";
import { adminAssignEquipmentAction, adminUnassignEquipmentAction, moveToBoxAction, restoreFromBoxAction } from "./equipment-actions";
import { EquipmentSelector } from "@/components/equipment/EquipmentSelector";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface Assignment {
  id: string;
  quantity: number;
  serialNumber: string | null;
  assignedAt: Date;
  equipmentItem: {
    id: string;
    name: string;
    isWeapon: boolean;
    isSight: boolean;
    isClothing: boolean;
    isShoe: boolean;
    category: { division: Division; name: string };
  };
}

interface EquipmentItem {
  id: string;
  name: string;
  isWeapon: boolean;
  isSight: boolean;
  isClothing: boolean;
  isShoe: boolean;
  category: { division: Division; name: string };
}

interface UnitTemplate {
  id: string;
  name: string;
  division: Division;
  items: { equipmentItemId: string; quantityRequired: number; equipmentItem: EquipmentItem }[];
}

interface SelectedItem {
  id: string;
  equipmentItemId: string;
  name: string;
  quantity: number;
  serialNumber?: string;
  isWeapon: boolean;
  isSight: boolean;
  isClothing: boolean;
  isShoe: boolean;
  fromUnit?: string;
}

interface BoxTemplateAlt {
  equipmentItemId: string;
  equipmentItem: { id: string; name: string };
}

interface BoxTemplateItem {
  equipmentItemId: string;
  quantity: number;
  equipmentItem: { id: string; name: string };
  alternatives: BoxTemplateAlt[];
}

interface BoxItemData {
  id: string;
  equipmentItemId: string;
  quantity: number;
  serialNumber: string | null;
  movedAt: Date;
  equipmentItem: {
    id: string;
    name: string;
    category: { division: Division; name: string };
  };
}

interface EquipmentTabProps {
  user: { id: string; name: string; assignments: Assignment[] };
  availableEquipment: EquipmentItem[];
  unitTemplates: UnitTemplate[];
  boxTemplate: { id: string; items: BoxTemplateItem[] } | null;
  userBox: { id: string; items: BoxItemData[] } | null;
}

type UnassignModal = { assignment: Assignment; quantity: number };
type MoveToBoxModal = { assignment: Assignment; quantity: number; maxQuantity: number };
type RestoreModal = { boxItem: BoxItemData; quantity: number };

type BulkMode = "unassign" | "moveToBox";

interface BulkProgress {
  mode: BulkMode;
  done: number;
  total: number;
  errors: string[];
  finished: boolean;
}

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export function EquipmentTab({ user, availableEquipment, unitTemplates, boxTemplate, userBox }: EquipmentTabProps) {
  // Single-item modals
  const [unassignModal, setUnassignModal] = useState<UnassignModal | null>(null);
  const [assignModal, setAssignModal] = useState(false);
  const [moveToBoxModal, setMoveToBoxModal] = useState<MoveToBoxModal | null>(null);
  const [restoreModal, setRestoreModal] = useState<RestoreModal | null>(null);

  // Assign modal state
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [adminNotes, setAdminNotes] = useState("");

  // Generic submitting / error state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bulk selection state
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set());

  // Bulk action modals
  const [bulkUnassignModal, setBulkUnassignModal] = useState(false);
  const [bulkUnassignNotes, setBulkUnassignNotes] = useState("");
  const [bulkMoveToBoxModal, setBulkMoveToBoxModal] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);

  // ---------- Box template helpers ----------
  const findTemplateItemForEquipment = (equipmentItemId: string) => {
    if (!boxTemplate) return null;
    return boxTemplate.items.find((i) => {
      if (i.equipmentItemId === equipmentItemId) return true;
      return i.alternatives.some((a) => a.equipmentItemId === equipmentItemId);
    }) ?? null;
  };

  const boxTemplateAllItemIds = new Set<string>();
  if (boxTemplate) {
    for (const item of boxTemplate.items) {
      boxTemplateAllItemIds.add(item.equipmentItemId);
      for (const alt of item.alternatives) {
        boxTemplateAllItemIds.add(alt.equipmentItemId);
      }
    }
  }

  const getBoxRemainingCapacity = (equipmentItemId: string) => {
    const tplItem = findTemplateItemForEquipment(equipmentItemId);
    if (!tplItem) return 0;
    const groupIds = [tplItem.equipmentItemId, ...tplItem.alternatives.map((a) => a.equipmentItemId)];
    const inBox = (userBox?.items ?? [])
      .filter((bi) => groupIds.includes(bi.equipmentItemId))
      .reduce((sum, bi) => sum + bi.quantity, 0);
    return Math.max(0, tplItem.quantity - inBox);
  };

  // ---------- Selection helpers ----------
  const selectedAssignments = user.assignments.filter((a) => selectedAssignmentIds.has(a.id));
  const allSelected = user.assignments.length > 0 && user.assignments.every((a) => selectedAssignmentIds.has(a.id));
  const someSelected = selectedAssignmentIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedAssignmentIds(new Set());
    } else {
      setSelectedAssignmentIds(new Set(user.assignments.map((a) => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedAssignmentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedAssignmentIds(next);
  };

  const clearSelection = () => setSelectedAssignmentIds(new Set());

  // Which selected assignments are eligible for box move
  const boxEligibleAssignments = selectedAssignments.filter(
    (a) => boxTemplateAllItemIds.has(a.equipmentItem.id) && getBoxRemainingCapacity(a.equipmentItem.id) > 0
  );
  const boxIneligibleAssignments = selectedAssignments.filter(
    (a) => !boxTemplateAllItemIds.has(a.equipmentItem.id) || getBoxRemainingCapacity(a.equipmentItem.id) === 0
  );

  // ---------- Single-item handlers ----------
  const handleUnassign = async (formData: FormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await adminUnassignEquipmentAction(formData);
      if (!result.success) setError(result.error || "אירעה שגיאה");
      else setUnassignModal(null);
    } catch {
      setError("אירעה שגיאה בלתי צפויה");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) { setError("יש לבחור לפחות פריט אחד"); return; }
    for (const item of selectedItems) {
      if ((item.isWeapon || item.isSight) && !item.serialNumber) {
        setError(`נדרש מספר סידורי עבור ${item.name}`); return;
      }
    }
    if (!adminNotes.trim()) { setError("יש להוסיף הערות"); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      for (const item of selectedItems) {
        const formData = new FormData();
        formData.append("userId", user.id);
        formData.append("equipmentItemId", item.equipmentItemId);
        formData.append("quantity", item.quantity.toString());
        if (item.serialNumber) formData.append("serialNumber", item.serialNumber);
        formData.append("adminNotes", adminNotes);
        const result = await adminAssignEquipmentAction(formData);
        if (!result.success) { setError(result.error || "אירעה שגיאה"); setIsSubmitting(false); return; }
      }
      setAssignModal(false);
      setSelectedItems([]);
      setAdminNotes("");
    } catch {
      setError("אירעה שגיאה בלתי צפויה");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveToBox = async () => {
    if (!moveToBoxModal) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("userId", user.id);
      formData.append("assignmentId", moveToBoxModal.assignment.id);
      formData.append("quantity", moveToBoxModal.quantity.toString());
      const result = await moveToBoxAction(formData);
      if (!result.success) setError(result.error || "אירעה שגיאה");
      else setMoveToBoxModal(null);
    } catch {
      setError("אירעה שגיאה בלתי צפויה");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreModal) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("userId", user.id);
      formData.append("boxItemId", restoreModal.boxItem.id);
      formData.append("quantity", restoreModal.quantity.toString());
      const result = await restoreFromBoxAction(formData);
      if (!result.success) setError(result.error || "אירעה שגיאה");
      else setRestoreModal(null);
    } catch {
      setError("אירעה שגיאה בלתי צפויה");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openMoveToBox = (assignment: Assignment) => {
    const remaining = getBoxRemainingCapacity(assignment.equipmentItem.id);
    const maxQty = Math.min(assignment.quantity, remaining);
    setMoveToBoxModal({ assignment, quantity: maxQty, maxQuantity: maxQty });
    setError(null);
  };

  // ---------- Bulk handlers ----------
  const handleBulkUnassign = async () => {
    if (!bulkUnassignNotes.trim()) return;
    const assignments = selectedAssignments;
    setBulkProgress({ mode: "unassign", done: 0, total: assignments.length, errors: [], finished: false });
    setIsSubmitting(true);
    const errors: string[] = [];
    for (let i = 0; i < assignments.length; i++) {
      const assignment = assignments[i];
      try {
        const fd = new FormData();
        fd.append("userId", user.id);
        fd.append("assignmentId", assignment.id);
        fd.append("quantity", assignment.quantity.toString());
        fd.append("adminNotes", bulkUnassignNotes);
        const result = await adminUnassignEquipmentAction(fd);
        if (!result.success) errors.push(`${assignment.equipmentItem.name}: ${result.error || "שגיאה"}`);
      } catch {
        errors.push(`${assignment.equipmentItem.name}: שגיאה בלתי צפויה`);
      }
      setBulkProgress({ mode: "unassign", done: i + 1, total: assignments.length, errors: [...errors], finished: i === assignments.length - 1 });
    }
    setIsSubmitting(false);
    if (errors.length === 0) {
      setBulkUnassignModal(false);
      setBulkUnassignNotes("");
      clearSelection();
      setBulkProgress(null);
    }
  };

  const handleBulkMoveToBox = async () => {
    const assignments = boxEligibleAssignments;
    setBulkProgress({ mode: "moveToBox", done: 0, total: assignments.length, errors: [], finished: false });
    setIsSubmitting(true);
    const errors: string[] = [];
    for (let i = 0; i < assignments.length; i++) {
      const assignment = assignments[i];
      const qty = Math.min(assignment.quantity, getBoxRemainingCapacity(assignment.equipmentItem.id));
      try {
        const fd = new FormData();
        fd.append("userId", user.id);
        fd.append("assignmentId", assignment.id);
        fd.append("quantity", qty.toString());
        const result = await moveToBoxAction(fd);
        if (!result.success) errors.push(`${assignment.equipmentItem.name}: ${result.error || "שגיאה"}`);
      } catch {
        errors.push(`${assignment.equipmentItem.name}: שגיאה בלתי צפויה`);
      }
      setBulkProgress({ mode: "moveToBox", done: i + 1, total: assignments.length, errors: [...errors], finished: i === assignments.length - 1 });
    }
    setIsSubmitting(false);
    if (errors.length === 0) {
      setBulkMoveToBoxModal(false);
      clearSelection();
      setBulkProgress(null);
    }
  };

  // ---------- Render ----------
  return (
    <div className="flex flex-col gap-6">
      {/* Top toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setAssignModal(true)}
          className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-all cursor-pointer"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          הקצאת ציוד חדש
        </button>

        {someSelected && (
          <div className="flex items-center gap-2 flex-wrap animate-in fade-in duration-150">
            <span className="text-sm font-bold text-zinc-400 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900">
              {selectedAssignmentIds.size} נבחרו
            </span>
            <button
              onClick={() => { setBulkUnassignModal(true); setBulkUnassignNotes(""); setError(null); }}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-red-900/20 text-red-400 border border-red-900/40 text-sm font-bold hover:bg-red-900/40 transition-all cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
              </svg>
              ביטול הקצאה ({selectedAssignmentIds.size})
            </button>
            {boxEligibleAssignments.length > 0 && (
              <button
                onClick={() => { setBulkMoveToBoxModal(true); setError(null); }}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-amber-900/20 text-amber-400 border border-amber-900/40 text-sm font-bold hover:bg-amber-900/40 transition-all cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                  <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
                </svg>
                העבר לקרטון ({boxEligibleAssignments.length})
              </button>
            )}
            <button
              onClick={clearSelection}
              className="h-10 px-3 rounded-xl bg-zinc-800 text-zinc-400 text-sm hover:bg-zinc-700 transition-all cursor-pointer"
            >
              נקה בחירה
            </button>
          </div>
        )}
      </div>

      {/* Assigned Equipment Table */}
      {user.assignments.length === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-2xl border border-zinc-800 border-dashed">
          אין ציוד משויך למשתמש זה
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                <th className="px-4 py-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-zinc-50 cursor-pointer accent-zinc-50"
                  />
                </th>
                <th className="px-4 py-3 text-right">פריט</th>
                <th className="px-4 py-3 text-right">קטגוריה</th>
                <th className="px-4 py-3 text-center">כמות</th>
                <th className="px-4 py-3 text-right">פרטים</th>
                <th className="px-4 py-3 text-right">תאריך הקצאה</th>
                <th className="px-4 py-3 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {user.assignments.map((assignment: Assignment) => {
                const isSelected = selectedAssignmentIds.has(assignment.id);
                const canMoveToBox = boxTemplateAllItemIds.has(assignment.equipmentItem.id) && getBoxRemainingCapacity(assignment.equipmentItem.id) > 0;
                return (
                  <tr
                    key={assignment.id}
                    className={`border-b border-zinc-800 transition-colors ${isSelected ? "bg-zinc-800/60" : "hover:bg-zinc-900/50"}`}
                  >
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(assignment.id)}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 cursor-pointer accent-zinc-50"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm font-bold text-zinc-50">{assignment.equipmentItem.name}</td>
                    <td className="px-4 py-4 text-sm text-zinc-400">
                      <div>{divisionLabel(assignment.equipmentItem.category.division)}</div>
                      <div className="text-xs text-zinc-500">{assignment.equipmentItem.category.name}</div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg border border-zinc-700 bg-zinc-800 text-sm font-bold text-zinc-50">
                        {assignment.quantity}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs text-zinc-400">
                      {assignment.serialNumber ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-500">צ:</span>
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-50 font-mono">{assignment.serialNumber}</span>
                        </div>
                      ) : <span className="text-zinc-600">-</span>}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400">
                      {new Date(assignment.assignedAt).toLocaleDateString("he-IL")}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {canMoveToBox && (
                          <button
                            onClick={() => openMoveToBox(assignment)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-900/20 text-amber-400 border border-amber-900/40 hover:bg-amber-900/40 transition-all cursor-pointer"
                          >
                            העבר לקרטון
                          </button>
                        )}
                        <button
                          onClick={() => { setUnassignModal({ assignment, quantity: assignment.quantity }); setError(null); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-900/20 text-red-400 border border-red-900/40 hover:bg-red-900/40 transition-all cursor-pointer"
                        >
                          ביטול הקצאה
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

      {/* Box Section */}
      {boxTemplate && boxTemplate.items.length > 0 && (
        <div className="rounded-2xl border border-amber-900/40 bg-amber-950/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
              <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
            </svg>
            <h3 className="text-lg font-bold text-amber-400">
              קרטון
              {userBox && userBox.items.length > 0 && (
                <span className="text-sm font-normal text-zinc-400 mr-2">
                  ({userBox.items.reduce((s, i) => s + i.quantity, 0)}/{boxTemplate.items.reduce((s, i) => s + i.quantity, 0)} פריטים)
                </span>
              )}
            </h3>
          </div>

          {(!userBox || userBox.items.length === 0) ? (
            <div className="py-6 text-center text-sm text-zinc-500">
              אין פריטים בקרטון. העבר פריטים מהציוד המשויך למעלה.
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                    <th className="px-4 py-3 text-right">פריט</th>
                    <th className="px-4 py-3 text-center">כמות</th>
                    <th className="px-4 py-3 text-right">פרטים</th>
                    <th className="px-4 py-3 text-right">תאריך העברה</th>
                    <th className="px-4 py-3 text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {userBox.items.map((boxItem: BoxItemData) => (
                    <tr key={boxItem.id} className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-bold text-zinc-50">{boxItem.equipmentItem.name}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg border border-amber-900/40 bg-amber-900/20 text-sm font-bold text-amber-400">
                          {boxItem.quantity}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {boxItem.serialNumber ? (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-50 font-mono">{boxItem.serialNumber}</span>
                        ) : <span className="text-zinc-600">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400">
                        {new Date(boxItem.movedAt).toLocaleDateString("he-IL")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => { setRestoreModal({ boxItem, quantity: boxItem.quantity }); setError(null); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-900/20 text-blue-400 border border-blue-900/40 hover:bg-blue-900/40 transition-all cursor-pointer"
                        >
                          שחזר מקרטון
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== BULK UNASSIGN MODAL ===== */}
      {bulkUnassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => !isSubmitting && !bulkProgress?.finished ? setBulkUnassignModal(false) : undefined} />
          <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 p-8 shadow-2xl border border-zinc-800 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-red-400">ביטול הקצאה ({selectedAssignments.length})</h3>
              {!isSubmitting && (
                <button onClick={() => { setBulkUnassignModal(false); setBulkProgress(null); }} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer">
                  <CloseIcon />
                </button>
              )}
            </div>

            {/* Item list */}
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden max-h-48 overflow-y-auto">
              {selectedAssignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 last:border-0">
                  <div>
                    <div className="text-sm font-bold text-zinc-50">{a.equipmentItem.name}</div>
                    {a.serialNumber && <div className="text-xs text-zinc-500 font-mono">צ: {a.serialNumber}</div>}
                  </div>
                  <div className="text-sm font-bold text-red-400">×{a.quantity}</div>
                </div>
              ))}
            </div>

            {/* Progress */}
            {bulkProgress && bulkProgress.mode === "unassign" && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">{bulkProgress.done}/{bulkProgress.total} פריטים</span>
                  {bulkProgress.finished && bulkProgress.errors.length === 0 && (
                    <span className="text-sm font-bold text-emerald-400">הושלם בהצלחה ✓</span>
                  )}
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all"
                    style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
                  />
                </div>
                {bulkProgress.errors.length > 0 && (
                  <div className="mt-3 rounded-xl border border-red-900/40 bg-red-900/10 p-3 space-y-1">
                    {bulkProgress.errors.map((e, i) => (
                      <div key={i} className="text-xs text-red-400">{e}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!bulkProgress && (
              <>
                <div className="mb-6">
                  <label className="text-sm font-bold text-red-400 mb-2 block">הערות <span className="text-red-500">*</span></label>
                  <textarea
                    value={bulkUnassignNotes}
                    onChange={(e) => setBulkUnassignNotes(e.target.value)}
                    rows={3}
                    placeholder="הסבר מדוע הציוד מוחזר למלאי (חובה)..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-zinc-500 transition-all resize-none"
                  />
                  <p className="mt-1.5 text-xs text-zinc-500">הערות אלו יחולו על כל הפריטים הנבחרים</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleBulkUnassign}
                    disabled={!bulkUnassignNotes.trim() || isSubmitting}
                    className="flex-1 h-14 inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 text-base font-bold text-white hover:bg-red-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ביטול הקצאת {selectedAssignments.length} פריטים
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkUnassignModal(false)}
                    className="flex-1 h-14 inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 text-base font-bold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer"
                  >
                    ביטול
                  </button>
                </div>
              </>
            )}

            {bulkProgress?.finished && (
              <button
                onClick={() => { setBulkUnassignModal(false); setBulkProgress(null); if (bulkProgress.errors.length === 0) clearSelection(); }}
                className="w-full h-14 inline-flex items-center justify-center rounded-2xl bg-zinc-700 text-base font-bold text-zinc-50 hover:bg-zinc-600 transition-all cursor-pointer"
              >
                סגור
              </button>
            )}
          </div>
        </div>
      )}

      {/* ===== BULK MOVE TO BOX MODAL ===== */}
      {bulkMoveToBoxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => !isSubmitting && !bulkProgress?.finished ? setBulkMoveToBoxModal(false) : undefined} />
          <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 p-8 shadow-2xl border border-zinc-800 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-amber-400">העברה לקרטון</h3>
              {!isSubmitting && (
                <button onClick={() => { setBulkMoveToBoxModal(false); setBulkProgress(null); }} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer">
                  <CloseIcon />
                </button>
              )}
            </div>

            {/* Eligible items */}
            <div className="mb-4">
              <div className="text-sm font-bold text-zinc-400 mb-2">פריטים שיועברו לקרטון ({boxEligibleAssignments.length})</div>
              <div className="rounded-xl border border-amber-900/30 bg-amber-950/10 overflow-hidden max-h-40 overflow-y-auto">
                {boxEligibleAssignments.map((a) => {
                  const cap = getBoxRemainingCapacity(a.equipmentItem.id);
                  const moveQty = Math.min(a.quantity, cap);
                  return (
                    <div key={a.id} className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 last:border-0">
                      <div>
                        <div className="text-sm font-bold text-zinc-50">{a.equipmentItem.name}</div>
                        {a.serialNumber && <div className="text-xs text-zinc-500 font-mono">צ: {a.serialNumber}</div>}
                      </div>
                      <div className="text-sm font-bold text-amber-400">×{moveQty}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ineligible items */}
            {boxIneligibleAssignments.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-bold text-zinc-500 mb-2">פריטים שלא יועברו ({boxIneligibleAssignments.length})</div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden max-h-32 overflow-y-auto">
                  {boxIneligibleAssignments.map((a) => {
                    const inTemplate = boxTemplateAllItemIds.has(a.equipmentItem.id);
                    const reason = !inTemplate ? "לא בתבנית הקרטון" : "הקרטון מלא לפריט זה";
                    return (
                      <div key={a.id} className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 last:border-0">
                        <div className="text-sm text-zinc-400">{a.equipmentItem.name}</div>
                        <div className="text-xs text-zinc-600">{reason}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Progress */}
            {bulkProgress && bulkProgress.mode === "moveToBox" && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">{bulkProgress.done}/{bulkProgress.total} פריטים</span>
                  {bulkProgress.finished && bulkProgress.errors.length === 0 && (
                    <span className="text-sm font-bold text-emerald-400">הושלם בהצלחה ✓</span>
                  )}
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
                  />
                </div>
                {bulkProgress.errors.length > 0 && (
                  <div className="mt-3 rounded-xl border border-red-900/40 bg-red-900/10 p-3 space-y-1">
                    {bulkProgress.errors.map((e, i) => (
                      <div key={i} className="text-xs text-red-400">{e}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!bulkProgress && (
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleBulkMoveToBox}
                  disabled={isSubmitting || boxEligibleAssignments.length === 0}
                  className="flex-1 h-14 inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 text-base font-bold text-white hover:bg-amber-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  העבר {boxEligibleAssignments.length} פריטים לקרטון
                </button>
                <button
                  type="button"
                  onClick={() => setBulkMoveToBoxModal(false)}
                  className="flex-1 h-14 inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 text-base font-bold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer"
                >
                  ביטול
                </button>
              </div>
            )}

            {bulkProgress?.finished && (
              <button
                onClick={() => { setBulkMoveToBoxModal(false); setBulkProgress(null); if (bulkProgress.errors.length === 0) clearSelection(); }}
                className="w-full h-14 inline-flex items-center justify-center rounded-2xl bg-zinc-700 text-base font-bold text-zinc-50 hover:bg-zinc-600 transition-all cursor-pointer"
              >
                סגור
              </button>
            )}
          </div>
        </div>
      )}

      {/* ===== SINGLE UNASSIGN MODAL ===== */}
      {unassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => !isSubmitting && setUnassignModal(null)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 p-8 shadow-2xl border border-zinc-800 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-zinc-50">ביטול הקצאת ציוד</h3>
              <button onClick={() => !isSubmitting && setUnassignModal(null)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer" disabled={isSubmitting}>
                <CloseIcon />
              </button>
            </div>
            <div className="mb-6 p-4 rounded-xl border border-zinc-800 bg-zinc-950">
              <div className="text-lg font-bold text-zinc-50">{unassignModal.assignment.equipmentItem.name}</div>
              <div className="text-sm text-zinc-400 mt-1">כמות זמינה: {unassignModal.assignment.quantity}</div>
              {unassignModal.assignment.serialNumber && (
                <div className="text-sm text-zinc-400 mt-1">מספר סידורי: <span className="font-mono text-zinc-300">{unassignModal.assignment.serialNumber}</span></div>
              )}
            </div>
            <form action={handleUnassign} className="space-y-6">
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="assignmentId" value={unassignModal.assignment.id} />
              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">כמות לביטול</label>
                <input name="quantity" type="number" min="1" max={unassignModal.assignment.quantity} defaultValue={unassignModal.assignment.quantity}
                  onChange={(e) => setUnassignModal({ ...unassignModal, quantity: Math.min(Math.max(1, parseInt(e.target.value) || 1), unassignModal.assignment.quantity) })}
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-lg font-bold text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all" required />
              </div>
              <div>
                <label className="text-sm font-bold text-red-400 mb-2 block">הערות <span className="text-red-500">*</span></label>
                <textarea name="adminNotes" rows={4} placeholder="הסבר מדוע הציוד מוחזר למלאי (חובה)..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-zinc-500 transition-all resize-none" required />
                <p className="mt-2 text-xs text-zinc-500">הערות אלו יתועדו בהיסטוריית הניהול השרירותי</p>
              </div>
              {error && <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-3 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3">
                <button type="submit" disabled={isSubmitting} className="flex-1 h-14 inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 text-base font-bold text-white hover:bg-red-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? <LoadingSpinner size="sm" /> : "ביטול הקצאה"}
                </button>
                <button type="button" onClick={() => setUnassignModal(null)} disabled={isSubmitting} className="flex-1 h-14 inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 text-base font-bold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer disabled:opacity-50">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== SINGLE MOVE TO BOX MODAL ===== */}
      {moveToBoxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => !isSubmitting && setMoveToBoxModal(null)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 p-8 shadow-2xl border border-zinc-800 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-amber-400">העברה לקרטון</h3>
              <button onClick={() => !isSubmitting && setMoveToBoxModal(null)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer" disabled={isSubmitting}>
                <CloseIcon />
              </button>
            </div>
            <div className="mb-6 p-4 rounded-xl border border-amber-900/40 bg-amber-950/10">
              <div className="text-lg font-bold text-zinc-50">{moveToBoxModal.assignment.equipmentItem.name}</div>
              <div className="text-sm text-zinc-400 mt-1">כמות אצל החייל: {moveToBoxModal.assignment.quantity}</div>
              <div className="text-sm text-amber-400 mt-1">מקום פנוי בקרטון: {moveToBoxModal.maxQuantity}</div>
              {moveToBoxModal.assignment.serialNumber && (
                <div className="text-sm text-zinc-400 mt-1">מספר סידורי: <span className="font-mono text-zinc-300">{moveToBoxModal.assignment.serialNumber}</span></div>
              )}
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">כמות להעברה</label>
                <input type="number" min="1" max={moveToBoxModal.maxQuantity} value={moveToBoxModal.quantity}
                  onChange={(e) => setMoveToBoxModal({ ...moveToBoxModal, quantity: Math.min(Math.max(1, parseInt(e.target.value) || 1), moveToBoxModal.maxQuantity) })}
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-lg font-bold text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all" />
              </div>
              {error && <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-3 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3">
                <button onClick={handleMoveToBox} disabled={isSubmitting} className="flex-1 h-14 inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 text-base font-bold text-white hover:bg-amber-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? <LoadingSpinner size="sm" /> : "העבר לקרטון"}
                </button>
                <button onClick={() => setMoveToBoxModal(null)} disabled={isSubmitting} className="flex-1 h-14 inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 text-base font-bold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer disabled:opacity-50">ביטול</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== RESTORE FROM BOX MODAL ===== */}
      {restoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => !isSubmitting && setRestoreModal(null)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 p-8 shadow-2xl border border-zinc-800 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-blue-400">שחזור מקרטון</h3>
              <button onClick={() => !isSubmitting && setRestoreModal(null)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer" disabled={isSubmitting}>
                <CloseIcon />
              </button>
            </div>
            <div className="mb-6 p-4 rounded-xl border border-blue-900/40 bg-blue-950/10">
              <div className="text-lg font-bold text-zinc-50">{restoreModal.boxItem.equipmentItem.name}</div>
              <div className="text-sm text-zinc-400 mt-1">כמות בקרטון: {restoreModal.boxItem.quantity}</div>
              {restoreModal.boxItem.serialNumber && (
                <div className="text-sm text-zinc-400 mt-1">מספר סידורי: <span className="font-mono text-zinc-300">{restoreModal.boxItem.serialNumber}</span></div>
              )}
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">כמות לשחזור</label>
                <input type="number" min="1" max={restoreModal.boxItem.quantity} value={restoreModal.quantity}
                  onChange={(e) => setRestoreModal({ ...restoreModal, quantity: Math.min(Math.max(1, parseInt(e.target.value) || 1), restoreModal.boxItem.quantity) })}
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-lg font-bold text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all" />
              </div>
              {error && <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-3 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3">
                <button onClick={handleRestore} disabled={isSubmitting} className="flex-1 h-14 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 text-base font-bold text-white hover:bg-blue-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? <LoadingSpinner size="sm" /> : "שחזר לחייל"}
                </button>
                <button onClick={() => setRestoreModal(null)} disabled={isSubmitting} className="flex-1 h-14 inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 text-base font-bold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer disabled:opacity-50">ביטול</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== ASSIGN MODAL ===== */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => !isSubmitting && setAssignModal(false)} />
          <div className="relative w-full max-w-4xl rounded-3xl bg-zinc-900 p-8 shadow-2xl border border-zinc-800 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-zinc-50">הקצאת ציוד חדש</h3>
              <button onClick={() => !isSubmitting && setAssignModal(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer" disabled={isSubmitting}>
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={handleAssign} className="space-y-6">
              <EquipmentSelector availableItems={availableEquipment} availableUnits={unitTemplates} selectedItems={selectedItems} onItemsChange={setSelectedItems} mode="assign" />
              <div>
                <label className="text-sm font-bold text-emerald-400 mb-2 block">הערות <span className="text-red-500">*</span></label>
                <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={4} placeholder="הסבר מדוע הציוד מוקצה (חובה)..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-zinc-500 transition-all resize-none" required />
                <p className="mt-2 text-xs text-zinc-500">הערות אלו יתועדו בהיסטוריית הניהול השרירותי</p>
              </div>
              {error && <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-3 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3">
                <button type="submit" disabled={isSubmitting || selectedItems.length === 0} className="flex-1 h-14 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-bold text-white hover:bg-emerald-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? <LoadingSpinner size="sm" /> : selectedItems.length > 0 ? `הקצאת ${selectedItems.length} פריטים` : "בחר פריטים תחילה"}
                </button>
                <button type="button" onClick={() => { setAssignModal(false); setSelectedItems([]); setAdminNotes(""); setError(null); }} disabled={isSubmitting}
                  className="flex-1 h-14 inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 text-base font-bold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer disabled:opacity-50">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
