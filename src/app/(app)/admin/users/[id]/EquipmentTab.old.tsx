"use client";

import { useState, useMemo } from "react";
import { Division } from "@prisma/client";
import { divisionLabel } from "@/lib/he";
import { adminAssignEquipmentAction, adminUnassignEquipmentAction } from "./equipment-actions";

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

interface EquipmentTabProps {
  user: {
    id: string;
    name: string;
    assignments: Assignment[];
  };
  availableEquipment: {
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
  }[];
}

type UnassignModal = {
  assignment: Assignment;
  quantity: number;
};

type AssignModal = {
  open: boolean;
};

export function EquipmentTab({ user, availableEquipment }: EquipmentTabProps) {
  const [unassignModal, setUnassignModal] = useState<UnassignModal | null>(null);
  const [assignModal, setAssignModal] = useState<AssignModal | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDivision, setSelectedDivision] = useState<Division | "ALL">("ALL");
  const [selectedItemId, setSelectedItemId] = useState<string>("");

  // Filter equipment based on search and division
  const filteredEquipment = useMemo(() => {
    return availableEquipment.filter((item) => {
      const matchesSearch = !searchQuery || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDivision = selectedDivision === "ALL" || 
        item.category.division === selectedDivision;
      
      return matchesSearch && matchesDivision;
    });
  }, [availableEquipment, searchQuery, selectedDivision]);

  // Get selected item details
  const selectedItem = useMemo(() => {
    return availableEquipment.find(item => item.id === selectedItemId);
  }, [availableEquipment, selectedItemId]);

  // Check if selected item requires serial number
  const requiresSerial = selectedItem?.isWeapon || selectedItem?.isSight;

  const handleUnassign = async (formData: FormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await adminUnassignEquipmentAction(formData);
      setUnassignModal(null);
    } catch (err: any) {
      setError(err.message || "אירעה שגיאה");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssign = async (formData: FormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await adminAssignEquipmentAction(formData);
      setAssignModal(null);
      // Reset filters
      setSearchQuery("");
      setSelectedDivision("ALL");
      setSelectedItemId("");
    } catch (err: any) {
      setError(err.message || "אירעה שגיאה");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Assign New Equipment Button */}
      <div>
        <button
          onClick={() => setAssignModal({ open: true })}
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
                  className="flex-1 h-14 inline-flex items-center justify-center rounded-2xl bg-red-600 text-base font-bold text-white hover:bg-red-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "מבטל..." : "ביטול הקצאה"}
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
            onClick={() => !isSubmitting && setAssignModal(null)}
          />
          <div className="relative w-full max-w-2xl rounded-3xl bg-zinc-900 p-8 shadow-2xl border border-zinc-800 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-zinc-50">הקצאת ציוד חדש</h3>
              <button
                onClick={() => !isSubmitting && setAssignModal(null)}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer"
                disabled={isSubmitting}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form action={handleAssign} className="space-y-6">
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="equipmentItemId" value={selectedItemId} />

              {/* Search Bar */}
              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">חיפוש פריט</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="חפש לפי שם פריט או קטגוריה..."
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 placeholder:text-zinc-600 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
                />
              </div>

              {/* Division Filters */}
              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">סינון לפי חטיבה</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDivision("ALL")}
                    className={`flex-1 h-10 px-4 rounded-xl text-xs font-bold transition-all ${
                      selectedDivision === "ALL"
                        ? "bg-zinc-50 text-zinc-950"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50"
                    }`}
                  >
                    הכל
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDivision(Division.LOGISTICS)}
                    className={`flex-1 h-10 px-4 rounded-xl text-xs font-bold transition-all ${
                      selectedDivision === Division.LOGISTICS
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50"
                    }`}
                  >
                    {divisionLabel(Division.LOGISTICS)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDivision(Division.COMBAT)}
                    className={`flex-1 h-10 px-4 rounded-xl text-xs font-bold transition-all ${
                      selectedDivision === Division.COMBAT
                        ? "bg-red-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50"
                    }`}
                  >
                    {divisionLabel(Division.COMBAT)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDivision(Division.MEDICAL)}
                    className={`flex-1 h-10 px-4 rounded-xl text-xs font-bold transition-all ${
                      selectedDivision === Division.MEDICAL
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50"
                    }`}
                  >
                    {divisionLabel(Division.MEDICAL)}
                  </button>
                </div>
              </div>

              {/* Equipment List */}
              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">
                  בחר פריט <span className="text-red-500">*</span>
                </label>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 max-h-64 overflow-y-auto">
                  {filteredEquipment.length === 0 ? (
                    <div className="py-8 text-center text-sm text-zinc-500">
                      לא נמצאו פריטים
                    </div>
                  ) : (
                    filteredEquipment.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedItemId(item.id)}
                        className={`w-full px-4 py-3 text-right border-b border-zinc-800 last:border-0 transition-all ${
                          selectedItemId === item.id
                            ? "bg-emerald-600 text-white"
                            : "hover:bg-zinc-900 text-zinc-50"
                        }`}
                      >
                        <div className="font-bold text-sm">{item.name}</div>
                        <div className={`text-xs mt-0.5 ${
                          selectedItemId === item.id ? "text-emerald-100" : "text-zinc-500"
                        }`}>
                          {divisionLabel(item.category.division)} · {item.category.name}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">כמות</label>
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  defaultValue="1"
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-lg font-bold text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
                  required
                />
                {requiresSerial && (
                  <p className="mt-2 text-xs text-orange-400">
                    ⚠️ פריט זה דורש מספר סידורי
                  </p>
                )}
              </div>

              {requiresSerial && (
                <div>
                  <label className="text-sm font-bold text-zinc-400 mb-2 block">
                    מספר סידורי <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="serialNumber"
                    type="text"
                    placeholder="הזן מספר סידורי..."
                    className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 placeholder:text-zinc-600 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
                    required
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    {selectedItem?.isWeapon && selectedItem?.isSight 
                      ? "פריט זה מסומן כנשק וצלמ ודורש מספר סידורי"
                      : selectedItem?.isWeapon 
                      ? "נשק זה דורש מספר סידורי"
                      : "צלמ זה דורש מספר סידורי"}
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-bold text-emerald-400 mb-2 block">
                  הערות <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="adminNotes"
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
                  disabled={isSubmitting || !selectedItemId}
                  className="flex-1 h-14 inline-flex items-center justify-center rounded-2xl bg-emerald-600 text-base font-bold text-white hover:bg-emerald-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "מקצה..." : selectedItemId ? "הקצאת ציוד" : "בחר פריט תחילה"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAssignModal(null);
                    setSearchQuery("");
                    setSelectedDivision("ALL");
                    setSelectedItemId("");
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

