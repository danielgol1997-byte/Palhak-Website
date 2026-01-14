"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Division, RequestType, ClothingSize, ShoeSize } from "@prisma/client";
import { divisionLabel } from "@/lib/he";
import { requestTypeLabel } from "@/lib/he";
import { createRequestAction } from "./actions";
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

interface SelectedItem extends Item {
  quantity: number;
  clothingSize?: ClothingSize;
  shoeSize?: ShoeSize;
  serialNumber?: string | null;
  assignmentSerialNumber?: string | null; // For tracking which specific assignment to declare/return
}

interface UnitTemplate {
  id: string;
  name: string;
  division: Division;
  items: {
    quantityRequired: number;
    equipmentItem: Item;
  }[];
}

interface RequestFormProps {
  items: Item[];
  unitTemplates: UnitTemplate[];
  userAssignments: { equipmentItemId: string; quantity: number; serialNumber: string | null }[];
  pendingDeclarationItems: { equipmentItemId: string; serialNumber: string | null; quantity: number }[];
  userSizes: {
    shirtSize: ClothingSize | null;
    pantsSize: ClothingSize | null;
    shoeSize: ShoeSize | null;
  };
  defaultRequestType?: RequestType;
  hideRequestTypeSelector?: boolean;
}

export function RequestForm({ items, unitTemplates, userAssignments, pendingDeclarationItems, userSizes, defaultRequestType, hideRequestTypeSelector }: RequestFormProps) {
  const [requestType, setRequestType] = useState<RequestType>(defaultRequestType || RequestType.NEW_EQUIPMENT);
  const [search, setSearch] = useState("");
  const [selectedDivision, setSelectedDivision] = useState<Division | "ALL">("ALL");
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [userNotes, setUserNotes] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUnits, setShowUnits] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedItemIds = useMemo(
    () => new Set(selectedItems.map((i) => i.id)),
    [selectedItems]
  );

  const userAssignedItemIds = useMemo(
    () => new Set(userAssignments.map((a) => a.equipmentItemId)),
    [userAssignments]
  );

  const userAssignedQuantities = useMemo(
    () => new Map(userAssignments.map((a) => [a.equipmentItemId, a.quantity])),
    [userAssignments]
  );

  const userAssignedSerialNumbers = useMemo(
    () => new Map(userAssignments.map((a) => [a.equipmentItemId, a.serialNumber])),
    [userAssignments]
  );

  // Create a Set of unique keys for pending serial declarations
  const pendingDeclarationKeys = useMemo(
    () => new Set(
      pendingDeclarationItems
        .filter(item => item.serialNumber) // Only serial items
        .map(item => `${item.equipmentItemId}_${item.serialNumber}`)
    ),
    [pendingDeclarationItems]
  );

  // Track pending quantities for non-serial items
  const pendingQuantitiesByItemId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of pendingDeclarationItems) {
      if (!item.serialNumber) { // Only non-serial items
        const currentQty = map.get(item.equipmentItemId) || 0;
        map.set(item.equipmentItemId, currentQty + item.quantity);
      }
    }
    return map;
  }, [pendingDeclarationItems]);

  const availableItems = useMemo(() => {
    const s = search.toLowerCase().trim();
    const isDeclarationOrReturn = requestType === RequestType.STOLEN || requestType === RequestType.DAMAGED || requestType === RequestType.MISSING || requestType === RequestType.USED || requestType === RequestType.RETURN_EQUIPMENT;
    
    if (!isDeclarationOrReturn) {
      // For NEW_EQUIPMENT, show all items as before
      return items.filter((item) => {
        const matchesSearch = !s || item.name.toLowerCase().includes(s);
        const matchesDivision =
          selectedDivision === "ALL" || item.category.division === selectedDivision;
        const notSelected = !selectedItemIds.has(item.id);
        return matchesSearch && matchesDivision && notSelected;
      });
    }
    
    // For declarations/returns: expand items with serial numbers
    const expandedItems: Array<Item & { displayName: string; assignmentSerialNumber?: string | null }> = [];
    
    // Calculate total selected quantities for non-serial items
    const selectedQuantitiesByItemId = new Map<string, number>();
    for (const selected of selectedItems) {
      const realItemId = selected.id.includes('_') ? selected.id.split('_')[0] : selected.id;
      const currentQty = selectedQuantitiesByItemId.get(realItemId) || 0;
      selectedQuantitiesByItemId.set(realItemId, currentQty + selected.quantity);
    }
    
    for (const item of items) {
      // Get all assignments for this item
      const itemAssignments = userAssignments.filter(a => a.equipmentItemId === item.id);
      
      if (itemAssignments.length === 0) continue; // User doesn't have this item
      
      const hasSerialNumber = item.isWeapon || item.isSight;
      
      if (hasSerialNumber && itemAssignments.length > 0) {
        // For items with serial numbers, create a separate entry for each serial
        for (const assignment of itemAssignments) {
          const uniqueId = assignment.serialNumber ? `${item.id}_${assignment.serialNumber}` : item.id;
          
          // Skip if already selected or has a pending declaration
          if (selectedItemIds.has(uniqueId)) continue;
          if (pendingDeclarationKeys.has(uniqueId)) continue;
          
          expandedItems.push({
            ...item,
            id: uniqueId,
            displayName: assignment.serialNumber 
              ? `${item.name} (צ: ${assignment.serialNumber})`
              : item.name,
            assignmentSerialNumber: assignment.serialNumber,
          });
        }
      } else {
        // For items without serial numbers, check if all available quantity is already selected/pending
        const totalUserHas = userAssignedQuantities.get(item.id) || 0;
        const totalSelected = selectedQuantitiesByItemId.get(item.id) || 0;
        const totalPending = pendingQuantitiesByItemId.get(item.id) || 0;
        const remainingQuantity = totalUserHas - totalSelected - totalPending;
        
        // Skip if all quantity is already selected or pending
        if (remainingQuantity <= 0) continue;
        
        expandedItems.push({
          ...item,
          displayName: `${item.name} (זמין: ${remainingQuantity}/${totalUserHas})`,
          assignmentSerialNumber: null,
        });
      }
    }
    
    // Apply search and division filters
    return expandedItems.filter((item) => {
      const matchesSearch = !s || item.displayName.toLowerCase().includes(s);
      const matchesDivision =
        selectedDivision === "ALL" || item.category.division === selectedDivision;
      return matchesSearch && matchesDivision;
    });
  }, [items, search, selectedDivision, selectedItemIds, requestType, userAssignments, pendingDeclarationKeys, pendingQuantitiesByItemId, selectedItems, userAssignedQuantities]);

  // Show dropdown when typing
  useEffect(() => {
    if (search.trim().length > 0) {
      setShowDropdown(true);
    }
  }, [search]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync with defaultRequestType when it changes (tab switching)
  useEffect(() => {
    if (defaultRequestType) {
      setRequestType(defaultRequestType);
    }
  }, [defaultRequestType]);

  // Filter selected items when request type changes
  useEffect(() => {
    if (requestType === RequestType.STOLEN || requestType === RequestType.DAMAGED || requestType === RequestType.MISSING || requestType === RequestType.RETURN_EQUIPMENT) {
      setSelectedItems((prev) => 
        prev.filter((item) => {
          // Extract the real item ID (remove serial suffix if present)
          const realItemId = item.id.includes('_') ? item.id.split('_')[0] : item.id;
          
          // Check if user has this item
          const hasItem = userAssignedItemIds.has(realItemId);
          if (!hasItem) return false;
          
          // For serial items, check if this specific serial has a pending declaration
          if (item.assignmentSerialNumber) {
            const hasPending = pendingDeclarationKeys.has(item.id);
            return !hasPending;
          }
          
          // For non-serial items, check if all available quantity is pending/selected
          const totalUserHas = userAssignedQuantities.get(realItemId) || 0;
          const pendingQty = pendingQuantitiesByItemId.get(realItemId) || 0;
          return totalUserHas > pendingQty; // Allow if there's still room
        })
      );
    }
  }, [requestType, userAssignedItemIds, pendingDeclarationKeys, pendingQuantitiesByItemId, userAssignedQuantities]);

  const handleSelectItem = (item: Item & { assignmentSerialNumber?: string | null }) => {
    // Extract the real item ID (remove serial suffix if present)
    const realItemId = item.id.includes('_') ? item.id.split('_')[0] : item.id;
    
    let initialQuantity = 1;
    
    // For declarations and returns with serial numbers, quantity is always 1 (one specific item)
    const isDeclarationOrReturn = requestType === RequestType.STOLEN || requestType === RequestType.DAMAGED || requestType === RequestType.MISSING || requestType === RequestType.RETURN_EQUIPMENT;
    if (isDeclarationOrReturn) {
      if (item.assignmentSerialNumber) {
        // For serialized items, can only declare/return 1 at a time
        initialQuantity = 1;
      } else {
        // For non-serialized items, calculate available quantity
        const totalUserHas = userAssignedQuantities.get(realItemId) || 0;
        
        // Calculate how much is already selected
        const alreadySelected = selectedItems
          .filter(selected => {
            const selectedRealItemId = selected.id.includes('_') ? selected.id.split('_')[0] : selected.id;
            return selectedRealItemId === realItemId;
          })
          .reduce((sum, selected) => sum + selected.quantity, 0);
        
        // Calculate how much is pending
        const pendingQty = pendingQuantitiesByItemId.get(realItemId) || 0;
        
        const remainingQuantity = totalUserHas - alreadySelected - pendingQty;
        initialQuantity = Math.min(1, remainingQuantity);
      }
    }
    
    // Auto-populate size based on item type and user's personal sizes
    const newItem: SelectedItem = {
      ...item,
      id: item.id, // Keep the unique ID for UI tracking
      quantity: initialQuantity,
      assignmentSerialNumber: item.assignmentSerialNumber,
    };
    
    if (item.isClothing && userSizes.shirtSize) {
      newItem.clothingSize = userSizes.shirtSize;
    }
    
    if (item.isShoe && userSizes.shoeSize) {
      newItem.shoeSize = userSizes.shoeSize;
    }
    
    setSelectedItems((prev) => [newItem, ...prev]);
    setSearch("");
    setShowDropdown(false);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSelectUnitTemplate = (unitTemplateId: string) => {
    const template = unitTemplates.find((t) => t.id === unitTemplateId);
    if (!template) return;

    const newItems: SelectedItem[] = [];
    
    template.items.forEach(({ equipmentItem, quantityRequired }) => {
      const existingItem = selectedItems.find((i) => i.id === equipmentItem.id);
      if (!existingItem) {
        newItems.push({ ...equipmentItem, quantity: quantityRequired });
      }
    });

    if (newItems.length > 0) {
      setSelectedItems((prev) => [...newItems, ...prev]);
      setSuccessMessage(`נוספו ${newItems.length} פריטים מתבנית "${template.name}"`);
      setErrorMessage(null);
    } else {
      setErrorMessage("כל הפריטים מתבנית זו כבר נבחרו");
    }
  };

  const handleRemoveItem = (itemId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    setSelectedItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        
        let finalQuantity = Math.max(1, quantity);
        
        // For declarations and returns, limit to what user actually has
        if (requestType === RequestType.STOLEN || requestType === RequestType.DAMAGED || requestType === RequestType.MISSING || requestType === RequestType.RETURN_EQUIPMENT) {
          // Extract the real equipment item ID
          const realItemId = i.id.includes('_') ? i.id.split('_')[0] : i.id;
          
          // For serial items, quantity is always 1
          if (i.assignmentSerialNumber) {
            finalQuantity = 1;
          } else {
            // For non-serial items, calculate how much is available
            const totalUserHas = userAssignedQuantities.get(realItemId) || 0;
            
            // Calculate how much is already selected in OTHER entries
            const otherSelectedQty = prev
              .filter(item => {
                if (item.id === itemId) return false; // Skip current item
                const otherRealItemId = item.id.includes('_') ? item.id.split('_')[0] : item.id;
                return otherRealItemId === realItemId;
              })
              .reduce((sum, item) => sum + item.quantity, 0);
            
            // Calculate how much is pending
            const pendingQty = pendingQuantitiesByItemId.get(realItemId) || 0;
            
            const maxAvailable = totalUserHas - otherSelectedQty - pendingQty;
            finalQuantity = Math.min(finalQuantity, maxAvailable);
          }
        }
        
        return { ...i, quantity: finalQuantity };
      })
    );
  };

  const handleQuantityBlur = () => {
    setEditingItemId(null);
  };

  const handleUpdateClothingSize = (itemId: string, size: ClothingSize) => {
    setSelectedItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, clothingSize: size } : i))
    );
  };

  const handleUpdateShoeSize = (itemId: string, size: ShoeSize) => {
    setSelectedItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, shoeSize: size } : i))
    );
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) return;
    
    // Validate notes for declarations
    const isDeclaration = requestType === RequestType.DAMAGED || 
                          requestType === RequestType.STOLEN || 
                          requestType === RequestType.MISSING;
    
    if (isDeclaration && !userNotes.trim()) {
      setErrorMessage("הערות הן שדה חובה עבור הצהרות");
      return;
    }
    
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("type", requestType);
      if (userNotes.trim()) {
        formData.append("userNotes", userNotes.trim());
      }
      formData.append(
        "items",
        JSON.stringify(
          selectedItems.map((item) => {
            // Extract the real equipment item ID (remove serial suffix if present)
            const realItemId = item.id.includes('_') ? item.id.split('_')[0] : item.id;
            return {
              equipmentItemId: realItemId,
              quantity: item.quantity,
              clothingSize: item.clothingSize,
              shoeSize: item.shoeSize,
              serialNumber: item.assignmentSerialNumber,
            };
          })
        )
      );

      await createRequestAction(formData);
      
      setSuccessMessage(`בקשה נשלחה בהצלחה! (${selectedItems.length} פריטים)`);
      setSelectedItems([]);
      setUserNotes("");
      setSearch("");
      setRequestType(RequestType.NEW_EQUIPMENT);
    } catch (error: any) {
      setErrorMessage(error.message || "אירעה שגיאה בשליחת הבקשה");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Error Message */}
      {errorMessage && (
        <div className="rounded-2xl border border-red-900/40 bg-red-900/20 p-4 text-red-400 text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {/* Request Type Selection */}
      {!hideRequestTypeSelector && (
        <div>
          <p className="text-sm text-zinc-400 mb-3">בחר את סוג הבקשה</p>
          <div className="grid grid-cols-3 gap-3">
            {Object.values(RequestType)
              .filter((type) => type !== RequestType.MISSING)
              .map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setRequestType(type)}
                  className={`h-12 rounded-xl px-4 text-sm font-bold transition-all cursor-pointer ${
                    requestType === type
                      ? "bg-zinc-50 text-zinc-950 scale-105"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50"
                  }`}
                >
                  {requestTypeLabel(type)}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Equipment Selection */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-sm text-zinc-400 mb-4">
          חפש והוסף פריטים לבקשה
          {(requestType === RequestType.STOLEN || requestType === RequestType.DAMAGED || requestType === RequestType.MISSING) && (
            <span className="mr-2 text-amber-400">· רק פריטים מהמלאי האישי שלך ללא הצהרות ממתינות יוצגו</span>
          )}
        </p>

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
          <div className="relative">
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none z-10">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-zinc-600"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="חפש או גלול לבחירת פריט..."
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 pr-10 pl-3 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all placeholder:text-zinc-700"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setShowDropdown(true)}
            />

            {/* Always-visible Dropdown */}
            {showDropdown && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-2 max-h-80 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl z-50"
              >
                {availableItems.length > 0 ? (
                  <div className="p-2">
                    <div className="text-xs text-zinc-500 px-3 py-2 sticky top-0 bg-zinc-900 border-b border-zinc-800">
                      {availableItems.length} פריטים זמינים
                    </div>
                    {availableItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectItem(item)}
                        className="w-full text-right px-3 py-3 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <span className="text-sm font-medium text-zinc-50 group-hover:text-zinc-50">
                          {('displayName' in item) ? (item as any).displayName : item.name}
                        </span>
                        <span className="text-xs text-zinc-500 px-2 py-1 rounded-md bg-zinc-800 group-hover:bg-zinc-700">
                          {divisionLabel(item.category.division)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-zinc-500">
                    לא נמצאו פריטים מתאימים
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Toggle between Items and Units */}
        {unitTemplates.length > 0 && requestType === RequestType.NEW_EQUIPMENT && (
          <div className="mb-4">
            <div className="flex gap-2 border-b border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setShowUnits(false);
                  setShowDropdown(true);
                }}
                className={`px-4 py-2 text-sm font-bold transition-all ${
                  !showUnits
                    ? "text-zinc-50 border-b-2 border-zinc-50"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                פריטים ({availableItems.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnits(true);
                  setShowDropdown(true);
                }}
                className={`px-4 py-2 text-sm font-bold transition-all ${
                  showUnits
                    ? "text-zinc-50 border-b-2 border-zinc-50"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                יחידות ({unitTemplates.length})
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
            {showUnits && unitTemplates.length > 0 && requestType === RequestType.NEW_EQUIPMENT ? (
              unitTemplates.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-500">לא נמצאו יחידות</div>
              ) : (
                unitTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelectUnitTemplate(template.id)}
                    className="w-full px-4 py-3 text-right border-b border-zinc-800 last:border-0 hover:bg-zinc-900 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm text-zinc-50">{template.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {divisionLabel(template.division)} · {template.items.length} פריטים
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
              availableItems.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-500">לא נמצאו פריטים</div>
              ) : (
                availableItems.map((item) => {
                  const needsSerial = item.isWeapon || item.isSight;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      className="w-full px-4 py-3 text-right border-b border-zinc-800 last:border-0 hover:bg-zinc-900 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {needsSerial && (
                            <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-orange-900/20 text-orange-400 border border-orange-900/40 text-xs font-bold">
                              צ
                            </span>
                          )}
                          <div>
                            <div className="font-bold text-sm text-zinc-50">
                              {('displayName' in item) ? (item as any).displayName : item.name}
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5">
                              {divisionLabel(item.category.division)}
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

      {/* Selected Items */}
      {selectedItems.length > 0 && (
        <div>
          <p className="text-sm text-zinc-400 mb-3">
            פריטים שנבחרו ({selectedItems.length}) · לחץ על פריט לשינוי כמות
          </p>
          <div className="flex flex-col gap-3">
            {selectedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 transition-all hover:border-zinc-700"
              >
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-red-300 transition-all shrink-0"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-50">{item.name}</div>
                  {(item.isWeapon || item.isSight) && requestType !== RequestType.NEW_EQUIPMENT && (
                    <div className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">
                      <span className="text-zinc-500">מס׳ סידורי:</span>
                      {item.assignmentSerialNumber ? (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-50 font-mono">
                          {item.assignmentSerialNumber}
                        </span>
                      ) : (
                        <span className="text-zinc-600">לא זמין</span>
                      )}
                    </div>
                  )}
                  {item.isClothing && (
                    <div className="text-xs text-zinc-500 mt-1">בגד - נדרשת בחירת מידה</div>
                  )}
                  {item.isShoe && (
                    <div className="text-xs text-zinc-500 mt-1">נעליים - נדרשת בחירת מידה</div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {item.isClothing && (
                    <select
                      value={item.clothingSize || ""}
                      onChange={(e) => handleUpdateClothingSize(item.id, e.target.value as ClothingSize)}
                      disabled={requestType === RequestType.STOLEN || requestType === RequestType.DAMAGED || requestType === RequestType.MISSING || requestType === RequestType.RETURN_EQUIPMENT}
                      className={`h-8 rounded-lg border border-zinc-800 px-2 text-xs text-zinc-50 outline-none focus:ring-1 focus:ring-zinc-500 ${
                        requestType === RequestType.STOLEN || requestType === RequestType.DAMAGED || requestType === RequestType.MISSING || requestType === RequestType.RETURN_EQUIPMENT
                          ? "bg-zinc-900 cursor-not-allowed opacity-60"
                          : "bg-zinc-950"
                      }`}
                      required
                    >
                      <option value="">מידה</option>
                      <option value={ClothingSize.XS}>XS</option>
                      <option value={ClothingSize.S}>S</option>
                      <option value={ClothingSize.M}>M</option>
                      <option value={ClothingSize.L}>L</option>
                      <option value={ClothingSize.XL}>XL</option>
                      <option value={ClothingSize.XXL}>XXL</option>
                      <option value={ClothingSize.XXXL}>XXXL</option>
                    </select>
                  )}
                  {item.isShoe && (
                    <select
                      value={item.shoeSize || ""}
                      onChange={(e) => handleUpdateShoeSize(item.id, e.target.value as ShoeSize)}
                      disabled={requestType === RequestType.STOLEN || requestType === RequestType.DAMAGED || requestType === RequestType.MISSING || requestType === RequestType.RETURN_EQUIPMENT}
                      className={`h-8 rounded-lg border border-zinc-800 px-2 text-xs text-zinc-50 outline-none focus:ring-1 focus:ring-zinc-500 ${
                        requestType === RequestType.STOLEN || requestType === RequestType.DAMAGED || requestType === RequestType.MISSING || requestType === RequestType.RETURN_EQUIPMENT
                          ? "bg-zinc-900 cursor-not-allowed opacity-60"
                          : "bg-zinc-950"
                      }`}
                      required
                    >
                      <option value="">מידה</option>
                      <option value={ShoeSize.SIZE_36}>36</option>
                      <option value={ShoeSize.SIZE_37}>37</option>
                      <option value={ShoeSize.SIZE_38}>38</option>
                      <option value={ShoeSize.SIZE_39}>39</option>
                      <option value={ShoeSize.SIZE_40}>40</option>
                      <option value={ShoeSize.SIZE_41}>41</option>
                      <option value={ShoeSize.SIZE_42}>42</option>
                      <option value={ShoeSize.SIZE_43}>43</option>
                      <option value={ShoeSize.SIZE_44}>44</option>
                      <option value={ShoeSize.SIZE_45}>45</option>
                      <option value={ShoeSize.SIZE_46}>46</option>
                      <option value={ShoeSize.SIZE_47}>47</option>
                      <option value={ShoeSize.SIZE_48}>48</option>
                    </select>
                  )}
                  <div
                    onClick={() => setEditingItemId(editingItemId === item.id ? null : item.id)}
                    className="cursor-pointer"
                  >
                    {editingItemId === item.id ? (
                      <input
                        type="number"
                        min="1"
                        max={(requestType === RequestType.STOLEN || requestType === RequestType.DAMAGED || requestType === RequestType.MISSING || requestType === RequestType.RETURN_EQUIPMENT) 
                          ? userAssignedQuantities.get(item.id) || 1 
                          : undefined
                        }
                        value={item.quantity}
                        onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                        onBlur={handleQuantityBlur}
                        onClick={(e) => e.stopPropagation()}
                        className="h-8 w-16 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-center text-xs text-zinc-50 outline-none focus:ring-1 focus:ring-zinc-500"
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-center gap-1 px-3 py-1 rounded-lg bg-zinc-800 text-xs font-bold text-zinc-50 hover:bg-zinc-700 transition-colors">
                        <span>כמות:</span>
                        {(requestType === RequestType.STOLEN || requestType === RequestType.DAMAGED || requestType === RequestType.MISSING || requestType === RequestType.RETURN_EQUIPMENT) ? (
                          <span>{item.quantity}/{userAssignedQuantities.get(item.id) || 1}</span>
                        ) : (
                          <span>{item.quantity}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Notes Field */}
      {selectedItems.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
          <label className="block mb-2">
            <span className="text-sm font-bold text-zinc-300">
              הערות
              {(requestType === RequestType.DAMAGED || requestType === RequestType.STOLEN || requestType === RequestType.MISSING) && (
                <span className="text-red-400 mr-1">*</span>
              )}
            </span>
            {(requestType === RequestType.DAMAGED || requestType === RequestType.STOLEN || requestType === RequestType.MISSING) && (
              <span className="text-xs text-zinc-500 mr-2">(חובה עבור הצהרות)</span>
            )}
          </label>
          <textarea
            value={userNotes}
            onChange={(e) => setUserNotes(e.target.value)}
            placeholder={
              requestType === RequestType.DAMAGED 
                ? "נא לפרט את מצב הפריט, נסיבות הבלאי, וכל מידע רלוונטי אחר..."
                : requestType === RequestType.STOLEN || requestType === RequestType.MISSING
                ? "נא לפרט את נסיבות האובדן/הגניבה, מיקום אחרון ידוע, ותיאור המקרה..."
                : requestType === RequestType.RETURN_EQUIPMENT
                ? "נא לפרט את מצב הפריט המוחזר (אופציונלי)..."
                : "הוסף הערות לבקשה (אופציונלי)..."
            }
            rows={4}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-50 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-zinc-500 transition-all resize-none"
          />
          {(requestType === RequestType.DAMAGED || requestType === RequestType.STOLEN || requestType === RequestType.MISSING) && !userNotes.trim() && (
            <p className="mt-2 text-xs text-orange-400">
              שדה זה הוא חובה עבור הצהרות. נא למלא פרטים.
            </p>
          )}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={selectedItems.length === 0 || isSubmitting}
        className={`h-14 w-full inline-flex items-center justify-center rounded-2xl px-6 text-base font-bold shadow-lg transition-all ${
          selectedItems.length === 0 || isSubmitting
            ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            : "bg-zinc-50 text-zinc-950 hover:bg-zinc-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
        }`}
      >
        {isSubmitting 
          ? "שולח..." 
          : requestType === RequestType.RETURN_EQUIPMENT
            ? `החזר ציוד (${selectedItems.length} פריטים)`
            : requestType === RequestType.DAMAGED || requestType === RequestType.STOLEN || requestType === RequestType.MISSING
              ? `הצהר (${selectedItems.length} פריטים)`
              : `שלח בקשה (${selectedItems.length} פריטים)`
        }
      </button>

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
