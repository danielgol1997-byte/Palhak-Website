"use client";

import { useState, useMemo, useRef } from "react";
import { Division, RequestType, ClothingSize, ShoeSize } from "@prisma/client";
import { divisionLabel } from "@/lib/he";
import { createRequestAction } from "./actions";
import { LoadingOverlay } from "@/components/ui/LoadingSpinner";
import { SuccessModal } from "@/components/ui/SuccessModal";

interface Item {
  id: string;
  name: string;
  isClothing: boolean;
  isShoe: boolean;
  isWeapon: boolean;
  isSight: boolean;
  category: {
    division: Division;
  };
}

interface Assignment {
  equipmentItemId: string;
  quantity: number;
  serialNumber: string | null;
  clothingSize: ClothingSize | null;
  shoeSize: ShoeSize | null;
  equipmentItem: Item;
}

interface UnitTemplate {
  id: string;
  name: string;
  items: {
    quantityRequired: number;
    equipmentItem: Item;
  }[];
}

interface User {
  id: string;
  name: string;
  personalNumber: string;
  role: string;
}

interface SelectedItem extends Item {
  quantity: number;
  serialNumber?: string | null;
  clothingSize?: ClothingSize | null;
  shoeSize?: ShoeSize | null;
}

interface TransferFormProps {
  currentUserId: string;
  userAssignments: Assignment[];
  availableUnits: UnitTemplate[];
  allUsers: User[];
  pendingTransferItems: { equipmentItemId: string; serialNumber: string | null; quantity: number }[];
}

export function TransferForm({ currentUserId, userAssignments, availableUnits, allUsers, pendingTransferItems }: TransferFormProps) {
  const recipientRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [selectedDivision, setSelectedDivision] = useState<Division | "ALL">("ALL");
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [showUnits, setShowUnits] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [unitNotes, setUnitNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recipientError, setRecipientError] = useState(false);
  const [quantityPrompt, setQuantityPrompt] = useState<{ item: Item; maxQuantity: number } | null>(null);

  // Get available items from assignments (deduplicated)
  const availableItems = useMemo(() => {
    const itemMap = new Map<string, Item>();
    (userAssignments || [])
      .filter(a => a.equipmentItem)
      .forEach(a => {
        if (!itemMap.has(a.equipmentItem.id)) {
          itemMap.set(a.equipmentItem.id, a.equipmentItem);
        }
      });
    return Array.from(itemMap.values());
  }, [userAssignments]);

  // Get users excluding current user
  const selectableUsers = useMemo(() => {
    return (allUsers || []).filter(u => u.id !== currentUserId);
  }, [allUsers, currentUserId]);

  // Create a map of what the user has (item -> quantity, serial if applicable)
  const userItemsMap = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    (userAssignments || []).forEach(assignment => {
      const key = assignment.equipmentItemId;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(assignment);
    });
    return map;
  }, [userAssignments]);

  // Calculate available quantities after subtracting pending transfers and selected items
  const getAvailableQuantity = (itemId: string, serialNumber: string | null = null) => {
    const userHas = userItemsMap.get(itemId) || [];
    
    // Get quantity from user assignments
    let assignedQuantity = 0;
    if (serialNumber) {
      const assignment = userHas.find(a => a.serialNumber === serialNumber);
      assignedQuantity = assignment?.quantity || 0;
    } else {
      assignedQuantity = userHas.reduce((sum, a) => sum + a.quantity, 0);
    }
    
    // Subtract pending transfers
    const pendingTransferQty = (pendingTransferItems || [])
      .filter(pt => pt.equipmentItemId === itemId && pt.serialNumber === serialNumber)
      .reduce((sum, pt) => sum + pt.quantity, 0);
    
    // Subtract already selected items
    const selectedQty = selectedItems
      .filter(si => {
        const siItemId = si.id.split('_')[0];
        return siItemId === itemId && si.serialNumber === serialNumber;
      })
      .reduce((sum, si) => sum + si.quantity, 0);
    
    return Math.max(0, assignedQuantity - pendingTransferQty - selectedQty);
  };

  const filteredItems = useMemo(() => {
    return availableItems.filter((item) => {
      if (!item || !item.id || !item.category) return false; // Skip invalid items
      
      // Check if item has any available quantity left
      const availableQty = getAvailableQuantity(item.id);
      if (availableQty <= 0) return false; // Hide items that are fully allocated
      
      const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
      const matchesDivision = selectedDivision === "ALL" || item.category.division === selectedDivision;
      return matchesSearch && matchesDivision;
    });
  }, [availableItems, search, selectedDivision, pendingTransferItems, selectedItems, userItemsMap]);

  const handleAddItem = (item: Item) => {
    const userHas = userItemsMap.get(item.id);
    if (!userHas || userHas.length === 0) return;

    // For serial items, add each one separately (only if available)
    if (item.isWeapon || item.isSight) {
      userHas.forEach(assignment => {
        const availableQty = getAvailableQuantity(item.id, assignment.serialNumber);
        if (availableQty <= 0) return; // Skip if already allocated
        
        const itemId = `${item.id}_${assignment.serialNumber}`;
        if (!selectedItems.find(si => si.id === itemId)) {
          setSelectedItems(prev => [{
            ...item,
            id: itemId,
            quantity: 1,
            serialNumber: assignment.serialNumber,
          }, ...prev]);
        }
      });
    } else {
      // For non-serial items, check available quantity
      const availableQty = getAvailableQuantity(item.id);
      if (availableQty <= 0) return; // All allocated
      
      if (!selectedItems.find(si => si.id === item.id)) {
        // If more than 1 available, prompt for quantity
        if (availableQty > 1) {
          setQuantityPrompt({ item, maxQuantity: availableQty });
        } else {
          // Only 1 available, add it directly
          const firstAssignment = userHas && userHas.length > 0 ? userHas[0] : null;
          setSelectedItems(prev => [{
            ...item,
            quantity: 1,
            serialNumber: null,
            clothingSize: firstAssignment?.clothingSize || null,
            shoeSize: firstAssignment?.shoeSize || null,
          }, ...prev]);
        }
      }
    }
  };

  const handleQuantitySelect = (quantity: number) => {
    if (!quantityPrompt) return;
    
    const item = quantityPrompt.item;
    const userHas = userItemsMap.get(item.id);
    const firstAssignment = userHas && userHas.length > 0 ? userHas[0] : null;
    
    setSelectedItems(prev => [{
      ...item,
      quantity,
      serialNumber: null,
      clothingSize: firstAssignment?.clothingSize || null,
      shoeSize: firstAssignment?.shoeSize || null,
    }, ...prev]);
    
    setQuantityPrompt(null);
  };

  const handleAddUnit = (unit: UnitTemplate) => {
    const missingItems: string[] = [];
    const addedItems: SelectedItem[] = [];

    unit.items.forEach((unitItem, index) => {
      const item = unitItem.equipmentItem;
      const userHas = userItemsMap.get(item.id);
      
      if (!userHas || userHas.length === 0) {
        missingItems.push(`${item.name} (${unitItem.quantityRequired})`);
        return;
      }

      // Calculate total user has
      const totalUserHas = userHas.reduce((sum, a) => sum + a.quantity, 0);

      if (totalUserHas < unitItem.quantityRequired) {
        missingItems.push(`${item.name} (נדרש: ${unitItem.quantityRequired}, יש: ${totalUserHas})`);
      }

      // For serial items, add each one
      if (item.isWeapon || item.isSight) {
        const count = Math.min(unitItem.quantityRequired, userHas.length);
        for (let i = 0; i < count; i++) {
          const assignment = userHas[i];
          const itemId = `${item.id}_${assignment.serialNumber}`;
          if (!selectedItems.find(si => si.id === itemId)) {
            addedItems.push({
              ...item,
              id: itemId,
              quantity: 1,
              serialNumber: assignment.serialNumber,
            });
          }
        }
      } else {
        // For non-serial items
        const quantityToAdd = Math.min(unitItem.quantityRequired, totalUserHas);
        if (!selectedItems.find(si => si.id === item.id)) {
          const firstAssignment = userHas && userHas.length > 0 ? userHas[0] : null;
          addedItems.push({
            ...item,
            quantity: quantityToAdd,
            serialNumber: null,
            clothingSize: firstAssignment?.clothingSize || null,
            shoeSize: firstAssignment?.shoeSize || null,
          });
        }
      }
    });

    if (missingItems.length > 0) {
      setUnitNotes(`הפריטים הבאים חסרים אצלך ולא יכללו בבקשת ההעברה:\n${missingItems.join('\n')}`);
    }

    setSelectedItems(prev => [...addedItems, ...prev]);
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    setSelectedItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      
      // Get max available (accounting for pending transfers and other selected items)
      const realItemId = item.id ? item.id.split('_')[0] : item.id;
      const maxAvailable = getAvailableQuantity(realItemId, item.serialNumber);
      
      return {
        ...item,
        quantity: Math.max(1, Math.min(quantity, maxAvailable))
      };
    }));
  };

  const handleRemoveItem = (itemId: string) => {
    setSelectedItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      setErrorMessage("יש לבחור לפחות פריט אחד");
      return;
    }

    if (!recipientId) {
      setErrorMessage("יש לבחור מקבל להעברה");
      setRecipientError(true);
      // Scroll to recipient selector
      recipientRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      // Clear error highlight after 3 seconds
      setTimeout(() => setRecipientError(false), 3000);
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setRecipientError(false);

    try {
      const formData = new FormData();
      formData.append("type", RequestType.TRANSFER);
      formData.append("recipientId", recipientId);
      
      const notes = [userNotes, unitNotes].filter(Boolean).join('\n\n');
      if (notes) {
        formData.append("userNotes", notes);
      }

      const itemsData = selectedItems.map((item, index) => {
        const realItemId = item.id.includes('_') ? item.id.split('_')[0] : item.id;
        return {
          equipmentItemId: realItemId,
          quantity: item.quantity,
          serialNumber: item.serialNumber,
          clothingSize: item.clothingSize,
          shoeSize: item.shoeSize,
        };
      });

      formData.append("items", JSON.stringify(itemsData));

      await createRequestAction(formData);
      
      setSuccessMessage(`בקשת העברה נשלחה בהצלחה! (${selectedItems.length} פריטים)`);
      setSelectedItems([]);
      setRecipientId("");
      setUserNotes("");
      setUnitNotes("");
      setSearch("");
    } catch (error: any) {
      setErrorMessage(error.message || "אירעה שגיאה בשליחת הבקשה");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 relative">
      {isSubmitting && <LoadingOverlay text="מעביר ציוד..." />}
      
      {/* Error Message */}
      {errorMessage && (
        <div className="rounded-2xl border border-red-900/40 bg-red-900/20 p-4 text-red-400 text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {/* Recipient Selection */}
      <div 
        ref={recipientRef}
        className={`rounded-2xl border p-6 shadow-sm transition-all duration-300 ${
          recipientError 
            ? "border-red-500 bg-red-900/10 animate-pulse" 
            : "border-zinc-800 bg-zinc-900"
        }`}
      >
        <label className={`text-sm font-bold mb-2 block ${recipientError ? "text-red-400" : "text-zinc-400"}`}>
          העבר אל ({selectableUsers.length} משתמשים זמינים) {recipientError && "⚠️ חובה לבחור מקבל"}
        </label>
        {selectableUsers.length === 0 ? (
          <div className="rounded-xl border border-orange-900/40 bg-orange-900/10 p-4 text-orange-400 text-sm">
            <div className="font-bold mb-1">⚠️ אין משתמשים זמינים להעברה</div>
            <div className="text-xs text-orange-300">
              ייתכן שאין משתמשים פעילים נוספים במערכת, או שכולם כבר מסוננים.
            </div>
          </div>
        ) : (
          <select
            value={recipientId}
            onChange={(e) => {
              setRecipientId(e.target.value);
              setRecipientError(false);
            }}
            className={`h-12 w-full rounded-xl border px-4 text-sm text-zinc-50 focus:ring-2 outline-none transition-all ${
              recipientError 
                ? "border-red-500 bg-red-950/20 focus:ring-red-500" 
                : "border-zinc-800 bg-zinc-950 focus:ring-zinc-500"
            }`}
            required
          >
            <option value="">בחר מקבל...</option>
            {selectableUsers.map(user => (
              <option key={user.id} value={user.id}>
                {user.name} {user.personalNumber ? `(${user.personalNumber})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Equipment Selection */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <p className="text-sm text-zinc-400 mb-4">בחר פריטים להעברה</p>

        {/* Division Filters */}
        <div className="mb-4">
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

        {/* Search */}
        <div className="mb-4">
          <label className="text-sm font-bold text-zinc-400 mb-2 block">חיפוש פריטים</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חפש בציוד המוקצה..."
            className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 placeholder:text-zinc-600 focus:ring-2 focus:ring-zinc-500 outline-none"
          />
        </div>

        {/* Toggle between Items and Units */}
        {availableUnits.length > 0 && (
          <div className="mb-4">
            <div className="flex gap-2 border-b border-zinc-800">
              <button
                type="button"
                onClick={() => setShowUnits(false)}
                className={`px-4 py-2 text-sm font-bold transition-all ${
                  !showUnits
                    ? "text-zinc-50 border-b-2 border-zinc-50"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                פריטים ({filteredItems.length})
              </button>
              <button
                type="button"
                onClick={() => setShowUnits(true)}
                className={`px-4 py-2 text-sm font-bold transition-all ${
                  showUnits
                    ? "text-zinc-50 border-b-2 border-zinc-50"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                יחידות ({availableUnits.length})
              </button>
            </div>
          </div>
        )}

        {/* Available Items or Units List */}
        <div>
          <label className="text-sm font-bold text-zinc-400 mb-2 block">
            {showUnits ? "בחר יחידה להוספה" : "בחר פריטים להוספה"}
          </label>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 max-h-64 overflow-y-auto scrollbar-hide">
            {showUnits && availableUnits.length > 0 ? (
              availableUnits.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-500">לא נמצאו יחידות</div>
              ) : (
                availableUnits.map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => handleAddUnit(unit)}
                    className="w-full px-4 py-3 text-right border-b border-zinc-800 last:border-0 hover:bg-zinc-900 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm text-zinc-50">{unit.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {unit.items.length} פריטים ביחידה
                        </div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </div>
                  </button>
                ))
              )
            ) : (
              filteredItems.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-500">אין ציוד מוקצה</div>
              ) : (
                filteredItems.map((item) => {
                  const userHas = userItemsMap.get(item.id);
                  const totalQty = userHas ? userHas.reduce((sum, a) => sum + a.quantity, 0) : 0;
                  const isSerial = item.isWeapon || item.isSight;
                  
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleAddItem(item)}
                      className="w-full px-4 py-3 text-right border-b border-zinc-800 last:border-0 hover:bg-zinc-900 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isSerial && (
                            <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-orange-900/20 text-orange-400 border border-orange-900/40 text-xs font-bold">
                              צ
                            </span>
                          )}
                          <div>
                            <div className="font-bold text-sm text-zinc-50">{item.name}</div>
                            <div className="text-xs text-zinc-500 mt-0.5">
                              {divisionLabel(item.category.division)} · זמין: {getAvailableQuantity(item.id)}
                            </div>
                          </div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </div>
                    </button>
                  );
                })
              )
            )}
          </div>
        </div>
      </div>

      {/* Unit Notes (if any items were removed) */}
      {unitNotes && (
        <div className="rounded-2xl border border-orange-900/40 bg-orange-900/10 p-4 text-orange-400 text-sm">
          <div className="font-bold mb-2">⚠️ שים לב</div>
          <div className="whitespace-pre-line">{unitNotes}</div>
        </div>
      )}

      {/* Selected Items */}
      {selectedItems.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <label className="text-sm font-bold text-zinc-400 mb-4 block">
            פריטים נבחרים להעברה ({selectedItems.length})
          </label>
          <div className="space-y-3">
            {selectedItems.map((item, index) => {
              const isSerial = item.isWeapon || item.isSight;
              const realItemId = item.id ? item.id.split('_')[0] : item.id;
              // Get available quantity + current item quantity (since it's already selected)
              const maxQty = getAvailableQuantity(realItemId, item.serialNumber) + item.quantity;

              return (
                <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="font-bold text-sm text-zinc-50 mb-2 flex items-center gap-2">
                        {item.name}
                        {isSerial && (
                          <span className="px-2 py-0.5 rounded-full bg-orange-900/20 text-orange-400 border border-orange-900/40 text-xs font-bold">
                            צ
                          </span>
                        )}
                        {isSerial && item.serialNumber && (
                          <span className="text-xs text-zinc-500">({item.serialNumber})</span>
                        )}
                      </div>
                      {!isSerial && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-zinc-500">כמות</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max={maxQty}
                            value={item.quantity}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 1 : parseInt(e.target.value);
                              handleUpdateQuantity(item.id, val);
                            }}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              handleUpdateQuantity(item.id, Math.max(1, Math.min(val, maxQty)));
                            }}
                            className="h-10 w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm font-bold text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
                          />
                          <span className="text-xs text-zinc-500">מתוך {maxQty}</span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="flex-shrink-0 p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-red-400"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* User Notes */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <label className="text-sm font-bold text-zinc-400 mb-2 block">הערות (אופציונלי)</label>
        <textarea
          value={userNotes}
          onChange={(e) => setUserNotes(e.target.value)}
          rows={4}
          placeholder="הוסף הערות להעברה..."
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-zinc-500 transition-all resize-none"
        />
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || selectedItems.length === 0}
        className="h-14 w-full inline-flex items-center justify-center rounded-2xl bg-purple-600 text-base font-bold text-white hover:bg-purple-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
      >
        {isSubmitting ? "מעביר..." : "העבר ציוד"}
      </button>

      {/* Quantity Prompt Modal */}
      {quantityPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setQuantityPrompt(null)}>
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" />
          <div 
            className="relative rounded-3xl bg-zinc-900 p-8 shadow-2xl border border-zinc-800 w-full max-w-md animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold text-zinc-50 mb-4">כמה יחידות להעביר?</h3>
            <p className="text-zinc-400 mb-6">
              {quantityPrompt.item.name} - יש לך {quantityPrompt.maxQuantity} יחידות זמינות
            </p>
            
            <div className="grid grid-cols-5 gap-3 mb-6">
              {Array.from({ length: Math.min(quantityPrompt.maxQuantity, 10) }, (_, i) => i + 1).map(num => (
                <button
                  key={num}
                  onClick={() => handleQuantitySelect(num)}
                  className="h-12 rounded-xl border-2 border-purple-900/40 bg-purple-900/20 text-purple-400 hover:bg-purple-900/40 hover:border-purple-600 transition-all font-bold"
                >
                  {num}
                </button>
              ))}
            </div>
            
            {quantityPrompt.maxQuantity > 10 && (
              <div className="mb-6">
                <label className="text-sm font-bold text-zinc-400 mb-2 block">או הזן כמות מותאמת אישית:</label>
                <input
                  type="number"
                  min="1"
                  max={quantityPrompt.maxQuantity}
                  placeholder={`1-${quantityPrompt.maxQuantity}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseInt((e.target as HTMLInputElement).value);
                      if (val >= 1 && val <= quantityPrompt.maxQuantity) {
                        handleQuantitySelect(val);
                      }
                    }
                  }}
                  className="w-full h-12 rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-sm font-bold text-zinc-50 focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            )}
            
            <button
              onClick={() => setQuantityPrompt(null)}
              className="w-full h-12 rounded-xl border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-all"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successMessage && (
        <SuccessModal
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
    </div>
  );
}

