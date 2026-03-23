"use client";

import { useState } from "react";
import { Division } from "@prisma/client";
import { divisionLabel } from "@/lib/he";
import { adminAssignEquipmentAction, adminUnassignEquipmentAction } from "./equipment-actions";
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
    category: {
      division: Division;
      name: string;
    };
  };
}

interface EquipmentItem {
  id: string;
  name: string;
  isWeapon: boolean;
  isSight: boolean;
  isClothing: boolean;
  isShoe: boolean;
  category: {
    division: Division;
    name: string;
  };
}

interface UnitTemplate {
  id: string;
  name: string;
  division: Division;
  items: {
    equipmentItemId: string;
    quantityRequired: number;
    equipmentItem: EquipmentItem;
  }[];
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

interface EquipmentTabProps {
  user: {
    id: string;
    name: string;
    assignments: Assignment[];
  };
  availableEquipment: EquipmentItem[];
  unitTemplates: UnitTemplate[];
}

type UnassignModal = {
  assignment: Assignment;
  quantity: number;
};

export function EquipmentTab({ user, availableEquipment, unitTemplates }: EquipmentTabProps) {
  const [unassignModal, setUnassignModal] = useState<UnassignModal | null>(null);
  const [assignModal, setAssignModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [adminNotes, setAdminNotes] = useState("");

  const handleUnassign = async (formData: FormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await adminUnassignEquipmentAction(formData);
      if (!result.success) {
        setError(result.error || "אירעה שגיאה");
      } else {
        setUnassignModal(null);
      }
    } catch {
      setError("אירעה שגיאה בלתי צפויה");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (selectedItems.length === 0) {
      setError("יש לבחור לפחות פריט אחד");
      return;
    }

    // Validate serial numbers
    for (const item of selectedItems) {
      if ((item.isWeapon || item.isSight) && !item.serialNumber) {
        setError(`נדרש מספר סידורי עבור ${item.name}`);
        return;
      }
    }

    if (!adminNotes.trim()) {
      setError("יש להוסיף הערות");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      for (const item of selectedItems) {
        const formData = new FormData();
        formData.append("userId", user.id);
        formData.append("equipmentItemId", item.equipmentItemId);
        formData.append("quantity", item.quantity.toString());
        if (item.serialNumber) {
          formData.append("serialNumber", item.serialNumber);
        }
        formData.append("adminNotes", adminNotes);

        const result = await adminAssignEquipmentAction(formData);
        if (!result.success) {
          setError(result.error || "אירעה שגיאה");
          setIsSubmitting(false);
          return;
        }
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

  return (
    <div className="flex flex-col gap-6">
      {/* Assign New Equipment Button */}
      <div>
        <button
          onClick={() => setAssignModal(true)}
          className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-all cursor-pointer"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          הקצאת ציוד חדש
        </button>
      </div>

      {/* Assigned Equipment List */}
      {user.assignments.length === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-2xl border border-zinc-800 border-dashed">
          אין ציוד משויך למשתמש זה
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                <th className="px-4 py-3 text-right">פריט</th>
                <th className="px-4 py-3 text-right">קטגוריה</th>
                <th className="px-4 py-3 text-center">כמות</th>
                <th className="px-4 py-3 text-right">פרטים</th>
                <th className="px-4 py-3 text-right">תאריך הקצאה</th>
                <th className="px-4 py-3 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {user.assignments.map((assignment) => (
                <tr key={assignment.id} className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors">
                  <td className="px-4 py-4 text-sm font-bold text-zinc-50">
                    {assignment.equipmentItem.name}
                  </td>
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
                    {assignment.serialNumber && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">צ:</span>
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-50 font-mono">
                          {assignment.serialNumber}
                        </span>
                      </div>
                    )}
                    {!assignment.serialNumber && <span className="text-zinc-600">-</span>}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-400">
                    {new Date(assignment.assignedAt).toLocaleDateString("he-IL")}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => setUnassignModal({ assignment, quantity: assignment.quantity })}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-900/20 text-red-400 border border-red-900/40 hover:bg-red-900/40 transition-all cursor-pointer"
                    >
                      ביטול הקצאה
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Unassign Modal */}
      {unassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            onClick={() => !isSubmitting && setUnassignModal(null)}
          />
          <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 p-8 shadow-2xl border border-zinc-800 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-zinc-50">ביטול הקצאת ציוד</h3>
              <button
                onClick={() => !isSubmitting && setUnassignModal(null)}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer"
                disabled={isSubmitting}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6 p-4 rounded-xl border border-zinc-800 bg-zinc-950">
              <div className="text-lg font-bold text-zinc-50">{unassignModal.assignment.equipmentItem.name}</div>
              <div className="text-sm text-zinc-400 mt-1">כמות זמינה: {unassignModal.assignment.quantity}</div>
              {unassignModal.assignment.serialNumber && (
                <div className="text-sm text-zinc-400 mt-1">
                  מספר סידורי: <span className="font-mono text-zinc-300">{unassignModal.assignment.serialNumber}</span>
                </div>
              )}
            </div>

            <form action={handleUnassign} className="space-y-6">
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="assignmentId" value={unassignModal.assignment.id} />

              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">כמות לביטול</label>
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  max={unassignModal.assignment.quantity}
                  defaultValue={unassignModal.assignment.quantity}
                  onChange={(e) => setUnassignModal({ 
                    ...unassignModal, 
                    quantity: Math.min(Math.max(1, parseInt(e.target.value) || 1), unassignModal.assignment.quantity)
                  })}
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-lg font-bold text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-bold text-red-400 mb-2 block">
                  הערות <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="adminNotes"
                  rows={4}
                  placeholder="הסבר מדוע הציוד מוחזר למלאי (חובה)..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-zinc-500 transition-all resize-none"
                  required
                />
                <p className="mt-2 text-xs text-zinc-500">
                  הערות אלו יתועדו בהיסטוריית הניהול השרירותי
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-14 inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 text-base font-bold text-white hover:bg-red-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <LoadingSpinner size="sm" /> : "ביטול הקצאה"}
                </button>
                <button
                  type="button"
                  onClick={() => setUnassignModal(null)}
                  disabled={isSubmitting}
                  className="flex-1 h-14 inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 text-base font-bold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer disabled:opacity-50"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            onClick={() => !isSubmitting && setAssignModal(false)}
          />
          <div className="relative w-full max-w-4xl rounded-3xl bg-zinc-900 p-8 shadow-2xl border border-zinc-800 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-zinc-50">הקצאת ציוד חדש</h3>
              <button
                onClick={() => !isSubmitting && setAssignModal(false)}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer"
                disabled={isSubmitting}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAssign} className="space-y-6">
              <EquipmentSelector
                availableItems={availableEquipment}
                availableUnits={unitTemplates}
                selectedItems={selectedItems}
                onItemsChange={setSelectedItems}
                mode="assign"
              />

              <div>
                <label className="text-sm font-bold text-emerald-400 mb-2 block">
                  הערות <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={4}
                  placeholder="הסבר מדוע הציוד מוקצה (חובה)..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-zinc-500 transition-all resize-none"
                  required
                />
                <p className="mt-2 text-xs text-zinc-500">
                  הערות אלו יתועדו בהיסטוריית הניהול השרירותי
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting || selectedItems.length === 0}
                  className="flex-1 h-14 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-bold text-white hover:bg-emerald-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <LoadingSpinner size="sm" /> : selectedItems.length > 0 ? `הקצאת ${selectedItems.length} פריטים` : "בחר פריטים תחילה"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAssignModal(false);
                    setSelectedItems([]);
                    setAdminNotes("");
                    setError(null);
                  }}
                  disabled={isSubmitting}
                  className="flex-1 h-14 inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 text-base font-bold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer disabled:opacity-50"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

