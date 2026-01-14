"use client";

import { useState, useMemo } from "react";
import { Division } from "@prisma/client";
import { divisionLabel } from "@/lib/he";

interface EquipmentItem {
  id: string;
  name: string;
  category: {
    division: Division;
    name: string;
  };
}

interface SelectedItem {
  equipmentItemId: string;
  name: string;
  quantity: number;
}

interface UnitItemSelectorProps {
  availableItems: EquipmentItem[];
  selectedItems: SelectedItem[];
  onItemsChange: (items: SelectedItem[]) => void;
}

export function UnitItemSelector({ availableItems, selectedItems, onItemsChange }: UnitItemSelectorProps) {
  const [search, setSearch] = useState("");
  const [selectedDivision, setSelectedDivision] = useState<Division | "ALL">("ALL");

  const selectedItemIds = useMemo(
    () => new Set(selectedItems.map((i) => i.equipmentItemId)),
    [selectedItems]
  );

  const filteredItems = useMemo(() => {
    let filtered = availableItems;

    // Filter by search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          item.category.name.toLowerCase().includes(searchLower)
      );
    }

    // Filter by division
    if (selectedDivision !== "ALL") {
      filtered = filtered.filter((item) => item.category.division === selectedDivision);
    }

    return filtered;
  }, [availableItems, search, selectedDivision]);

  const handleAddItem = (item: EquipmentItem) => {
    if (selectedItemIds.has(item.id)) return;

    const newItem: SelectedItem = {
      equipmentItemId: item.id,
      name: item.name,
      quantity: 1,
    };

    onItemsChange([...selectedItems, newItem]);
  };

  const handleUpdateQuantity = (equipmentItemId: string, quantity: number) => {
    onItemsChange(
      selectedItems.map((item) =>
        item.equipmentItemId === equipmentItemId
          ? { ...item, quantity: Math.max(1, isNaN(quantity) ? 1 : quantity) }
          : item
      )
    );
  };

  const handleRemoveItem = (equipmentItemId: string) => {
    onItemsChange(selectedItems.filter((item) => item.equipmentItemId !== equipmentItemId));
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div>
        <label className="text-sm font-bold text-zinc-400 mb-2 block">חיפוש פריטים</label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חפש לפי שם פריט או קטגוריה..."
          className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 placeholder:text-zinc-600 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
        />
      </div>

      {/* Division Filter */}
      <div>
        <label className="text-sm font-bold text-zinc-400 mb-2 block">סינון לפי חלוקה</label>
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

      {/* Available Items List */}
      <div>
        <label className="text-sm font-bold text-zinc-400 mb-2 block">
          בחר פריטים להוספה ({filteredItems.length} זמינים)
        </label>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 max-h-64 overflow-y-auto scrollbar-hide">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-500">לא נמצאו פריטים</div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = selectedItemIds.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => !isSelected && handleAddItem(item)}
                  disabled={isSelected}
                  className={`w-full px-4 py-3 text-right border-b border-zinc-800 last:border-0 transition-all ${
                    isSelected
                      ? "bg-zinc-900 text-zinc-600 cursor-not-allowed"
                      : "hover:bg-zinc-900 cursor-pointer"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-zinc-50">{item.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {item.category.name} · {divisionLabel(item.category.division)}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-xs text-emerald-500 font-bold">✓ נוסף</span>
                    )}
                  </div>
                </button>
              );
            })
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
            {selectedItems.map((item) => (
              <div
                key={item.equipmentItemId}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-bold text-sm text-zinc-50 mb-2">{item.name}</div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-zinc-500">כמות נדרשת</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 1 : parseInt(e.target.value);
                          handleUpdateQuantity(item.equipmentItemId, val);
                        }}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          handleUpdateQuantity(item.equipmentItemId, Math.max(1, val));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.stopPropagation()}
                        className="h-10 w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm font-bold text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none touch-manipulation"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.equipmentItemId)}
                    className="flex-shrink-0 p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-red-400"
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
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

