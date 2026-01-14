"use client";

import { useState, useMemo } from "react";
import { Division } from "@prisma/client";
import { divisionLabel } from "@/lib/he";

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
  items: {
    equipmentItemId: string;
    quantityRequired: number;
    equipmentItem: EquipmentItem;
  }[];
}

interface SelectedItem {
  id: string; // Can be itemId or itemId-serialSuffix
  equipmentItemId: string;
  name: string;
  quantity: number;
  serialNumber?: string;
  isWeapon: boolean;
  isSight: boolean;
  isClothing: boolean;
  isShoe: boolean;
  fromUnit?: string; // Unit template ID if from a unit
}

interface EquipmentSelectorProps {
  availableItems: EquipmentItem[];
  availableUnits: UnitTemplate[];
  selectedItems: SelectedItem[];
  onItemsChange: (items: SelectedItem[]) => void;
  mode?: "request" | "assign";
}

export function EquipmentSelector({
  availableItems,
  availableUnits,
  selectedItems,
  onItemsChange,
  mode = "request",
}: EquipmentSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDivision, setSelectedDivision] = useState<Division | "ALL">("ALL");
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [showUnits, setShowUnits] = useState(false);

  // Filter items
  const filteredItems = useMemo(() => {
    return availableItems.filter((item) => {
      // Defensive check for invalid items
      if (!item || !item.name || !item.category || !item.category.name) {
        return false; // Filter out invalid items
      }
      
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDivision = selectedDivision === "ALL" || item.category.division === selectedDivision;

      return matchesSearch && matchesDivision;
    });
  }, [availableItems, searchQuery, selectedDivision]);

  // Filter units (units are division-independent, only filter by search)
  const filteredUnits = useMemo(() => {
    return availableUnits.filter((unit) => {
      if (!unit || !unit.name) return false; // Filter out invalid units
      const matchesSearch = !searchQuery || unit.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [availableUnits, searchQuery]);

  const handleAddItem = (item: EquipmentItem) => {
    const requiresSerial = item.isWeapon || item.isSight;
    
    const newItem: SelectedItem = {
      id: requiresSerial ? `${item.id}-${Date.now()}` : item.id,
      equipmentItemId: item.id,
      name: item.name,
      quantity: 1,
      isWeapon: item.isWeapon,
      isSight: item.isSight,
      isClothing: item.isClothing,
      isShoe: item.isShoe,
    };

    onItemsChange([...selectedItems, newItem]);
  };

  const handleAddUnit = (unit: UnitTemplate) => {
    const unitItems: SelectedItem[] = unit.items.map((item, index) => {
      const requiresSerial = item.equipmentItem.isWeapon || item.equipmentItem.isSight;
      // Use timestamp + index + random to ensure unique IDs even for multiple items of same type in unit
      const uniqueId = `${item.equipmentItemId}-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
      return {
        id: uniqueId,
        equipmentItemId: item.equipmentItemId,
        name: item.equipmentItem.name,
        quantity: item.quantityRequired,
        isWeapon: item.equipmentItem.isWeapon,
        isSight: item.equipmentItem.isSight,
        isClothing: item.equipmentItem.isClothing,
        isShoe: item.equipmentItem.isShoe,
        fromUnit: unit.id,
      };
    });

    onItemsChange([...selectedItems, ...unitItems]);
    setExpandedUnits((prev) => new Set([...prev, unit.id]));
  };

  const handleRemoveItem = (id: string) => {
    onItemsChange(selectedItems.filter((item) => item.id !== id));
  };

  const handleRemoveUnit = (unitId: string) => {
    // Remove all items that belong to this unit
    onItemsChange(selectedItems.filter((item) => item.fromUnit !== unitId));
    // Also collapse the unit
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      next.delete(unitId);
      return next;
    });
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    onItemsChange(
      selectedItems.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, isNaN(quantity) ? 1 : quantity) } : item
      )
    );
  };

  const handleUpdateSerial = (id: string, serialNumber: string) => {
    onItemsChange(
      selectedItems.map((item) => (item.id === id ? { ...item, serialNumber } : item))
    );
  };

  const toggleUnit = (unitId: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  };

  // Group selected items by unit
  const groupedItems = useMemo(() => {
    const byUnit: Record<string, SelectedItem[]> = {};
    const individual: SelectedItem[] = [];

    selectedItems.forEach((item) => {
      if (item.fromUnit) {
        if (!byUnit[item.fromUnit]) byUnit[item.fromUnit] = [];
        byUnit[item.fromUnit].push(item);
      } else {
        individual.push(item);
      }
    });

    return { byUnit, individual };
  }, [selectedItems]);

  const requiresSerial = (item: SelectedItem) => item.isWeapon || item.isSight;

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div>
        <label className="text-sm font-bold text-zinc-400 mb-2 block">חיפוש פריט או יחידה</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="חפש לפי שם פריט, קטגוריה או יחידה..."
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

      {/* Toggle between Items and Units */}
      <div>
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
            יחידות ({filteredUnits.length})
          </button>
        </div>
      </div>

      {/* Items or Units List */}
      <div>
        <label className="text-sm font-bold text-zinc-400 mb-2 block">
          {showUnits ? "בחר יחידה להוספה" : "בחר פריטים להוספה"}
        </label>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 max-h-64 overflow-y-auto scrollbar-hide">
          {showUnits ? (
            // Units List
            filteredUnits.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">לא נמצאו יחידות</div>
            ) : (
              filteredUnits.map((unit) => (
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
                    <div className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))
            )
          ) : (
            // Items List
            filteredItems.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">לא נמצאו פריטים</div>
            ) : (
              filteredItems.map((item) => {
                const needsSerial = item.isWeapon || item.isSight;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddItem(item)}
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
                          <div className="font-bold text-sm text-zinc-50">{item.name}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">
                            {divisionLabel(item.category.division)} · {item.category.name}
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

      {/* Selected Items */}
      {selectedItems.length > 0 && (
        <div>
          <label className="text-sm font-bold text-zinc-400 mb-2 block">
            פריטים נבחרים ({selectedItems.length})
          </label>

          <div className="space-y-3">
            {/* Individual Items */}
            {groupedItems.individual.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
                {groupedItems.individual.map((item) => (
                  <div key={item.id} className="p-4 border-b border-zinc-800 last:border-0">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {requiresSerial(item) && (
                            <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-orange-900/20 text-orange-400 border border-orange-900/40 text-xs font-bold">
                              צ
                            </span>
                          )}
                          <span className="font-bold text-sm text-zinc-50">{item.name}</span>
                          {requiresSerial(item) && (
                            <span className="text-xs text-zinc-500">(כמות: 1)</span>
                          )}
                        </div>

                        <div className={`grid gap-3 ${requiresSerial(item) && mode === "assign" ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
                          {/* Quantity - Only for non-serial items */}
                          {!requiresSerial(item) && (
                            <div>
                              <label className="text-xs text-zinc-500 mb-1 block">כמות</label>
                              <input
                                type="number"
                                inputMode="numeric"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 1 : parseInt(e.target.value);
                                  handleUpdateQuantity(item.id, val);
                                }}
                                onBlur={(e) => {
                                  const val = parseInt(e.target.value) || 1;
                                  handleUpdateQuantity(item.id, Math.max(1, val));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onFocus={(e) => e.stopPropagation()}
                                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm font-bold text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none touch-manipulation"
                              />
                            </div>
                          )}

                          {/* Serial Number - Only in assign mode */}
                          {requiresSerial(item) && mode === "assign" && (
                            <div>
                              <label className="text-xs text-zinc-500 mb-1 block">
                                מספר סידורי <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                inputMode="text"
                                value={item.serialNumber || ""}
                                onChange={(e) => handleUpdateSerial(item.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onFocus={(e) => e.stopPropagation()}
                                placeholder="הזן מספר סידורי..."
                                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-50 placeholder:text-zinc-600 focus:ring-2 focus:ring-zinc-500 outline-none touch-manipulation"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Remove Button */}
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
                ))}
              </div>
            )}

            {/* Units */}
            {Object.entries(groupedItems.byUnit).map(([unitId, items]) => {
              const unit = availableUnits.find((u) => u.id === unitId);
              if (!unit) return null;

              const isExpanded = expandedUnits.has(unitId);

              return (
                <div key={unitId} className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
                  {/* Unit Header */}
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => toggleUnit(unitId)}
                      className="flex-1 px-4 py-3 flex items-center justify-between hover:bg-zinc-900 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`text-zinc-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                        <div className="text-left">
                          <div className="font-bold text-sm text-zinc-50">{unit.name}</div>
                          <div className="text-xs text-zinc-500">{items.length} פריטים</div>
                        </div>
                      </div>
                      <span className="text-xs text-zinc-600">{isExpanded ? "כווץ" : "הרחב"}</span>
                    </button>
                    
                    {/* Remove Unit Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveUnit(unitId)}
                      className="flex-shrink-0 p-3 hover:bg-red-900/20 transition-colors text-zinc-500 hover:text-red-400 border-r border-zinc-800"
                      title="הסר יחידה"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>

                  {/* Unit Items */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800">
                      {items.map((item) => (
                        <div key={item.id} className="p-4 border-b border-zinc-800 last:border-0 bg-zinc-900/30">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {requiresSerial(item) && (
                                  <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-orange-900/20 text-orange-400 border border-orange-900/40 text-xs font-bold">
                                    צ
                                  </span>
                                )}
                                <span className="font-bold text-sm text-zinc-50">{item.name}</span>
                                {requiresSerial(item) && (
                                  <span className="text-xs text-zinc-500">(כמות: 1)</span>
                                )}
                              </div>

                              <div className={`grid gap-3 ${requiresSerial(item) && mode === "assign" ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
                                {/* Quantity - Only for non-serial items */}
                                {!requiresSerial(item) && (
                                  <div>
                                    <label className="text-xs text-zinc-500 mb-1 block">כמות</label>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const val = e.target.value === '' ? 1 : parseInt(e.target.value);
                                        handleUpdateQuantity(item.id, val);
                                      }}
                                      onBlur={(e) => {
                                        const val = parseInt(e.target.value) || 1;
                                        handleUpdateQuantity(item.id, Math.max(1, val));
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      onFocus={(e) => e.stopPropagation()}
                                      className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm font-bold text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none touch-manipulation"
                                    />
                                  </div>
                                )}

                                {/* Serial Number - Only in assign mode */}
                                {requiresSerial(item) && mode === "assign" && (
                                  <div>
                                    <label className="text-xs text-zinc-500 mb-1 block">
                                      מספר סידורי <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                      type="text"
                                      inputMode="text"
                                      value={item.serialNumber || ""}
                                      onChange={(e) => handleUpdateSerial(item.id, e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      onFocus={(e) => e.stopPropagation()}
                                      placeholder="הזן מספר סידורי..."
                                      className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-50 placeholder:text-zinc-600 focus:ring-2 focus:ring-zinc-500 outline-none touch-manipulation"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Remove Button */}
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
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

