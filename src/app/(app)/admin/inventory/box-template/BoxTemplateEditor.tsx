"use client";

import { useState, useMemo } from "react";
import { Division } from "@prisma/client";
import { divisionLabel } from "@/lib/he";
import { addMultipleBoxTemplateItemsAction } from "./actions";

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

interface BoxTemplateEditorProps {
  availableItems: EquipmentItem[];
}

export function BoxTemplateEditor({ availableItems }: BoxTemplateEditorProps) {
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDivision, setSelectedDivision] = useState<Division | "ALL">("ALL");

  const filteredItems = useMemo(() => {
    return availableItems.filter((item) => {
      if (!item?.name || !item?.category?.name) return false;
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDivision =
        selectedDivision === "ALL" || item.category.division === selectedDivision;
      return matchesSearch && matchesDivision;
    });
  }, [availableItems, searchQuery, selectedDivision]);

  const handleAddItem = (item: EquipmentItem) => {
    if (selectedItems.some((s) => s.equipmentItemId === item.id)) return;
    setSelectedItems([
      ...selectedItems,
      { equipmentItemId: item.id, name: item.name, quantity: 1 },
    ]);
  };

  const handleRemoveItem = (equipmentItemId: string) => {
    setSelectedItems(selectedItems.filter((i) => i.equipmentItemId !== equipmentItemId));
  };

  const handleUpdateQuantity = (equipmentItemId: string, quantity: number) => {
    setSelectedItems(
      selectedItems.map((i) =>
        i.equipmentItemId === equipmentItemId
          ? { ...i, quantity: Math.max(1, isNaN(quantity) ? 1 : quantity) }
          : i
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      setErrorMessage("יש לבחור לפחות פריט אחד");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("items", JSON.stringify(selectedItems));
      const result = await addMultipleBoxTemplateItemsAction(formData);
      if (!result.success) {
        setErrorMessage(result.error || "אירעה שגיאה");
      } else {
        setSuccessMessage(`${selectedItems.length} פריטים נוספו בהצלחה!`);
        setSelectedItems([]);
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch {
      setErrorMessage("אירעה שגיאה בלתי צפויה");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="text-sm font-bold text-zinc-400 mb-2 block">סינון לפי חטיבה</label>
        <div className="flex gap-2">
          {(["ALL", Division.LOGISTICS, Division.COMBAT, Division.MEDICAL] as const).map(
            (d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDivision(d)}
                className={`flex-1 h-10 px-4 rounded-xl text-xs font-bold transition-all ${
                  selectedDivision === d
                    ? d === "ALL"
                      ? "bg-zinc-50 text-zinc-950"
                      : d === Division.LOGISTICS
                        ? "bg-blue-600 text-white"
                        : d === Division.COMBAT
                          ? "bg-red-600 text-white"
                          : "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50"
                }`}
              >
                {d === "ALL" ? "הכל" : divisionLabel(d)}
              </button>
            )
          )}
        </div>
      </div>

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

      <div>
        <label className="text-sm font-bold text-zinc-400 mb-2 block">
          בחר פריטים להוספה
        </label>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 max-h-64 overflow-y-auto scrollbar-hide">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-500">לא נמצאו פריטים</div>
          ) : (
            filteredItems.map((item) => {
              const alreadySelected = selectedItems.some(
                (s) => s.equipmentItemId === item.id
              );
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleAddItem(item)}
                  disabled={alreadySelected}
                  className={`w-full px-4 py-3 text-right border-b border-zinc-800 last:border-0 transition-all ${
                    alreadySelected
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-zinc-900 cursor-pointer"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-zinc-50">{item.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {divisionLabel(item.category.division)} · {item.category.name}
                      </div>
                    </div>
                    {!alreadySelected && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-zinc-500"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {selectedItems.length > 0 && (
        <div>
          <label className="text-sm font-bold text-zinc-400 mb-2 block">
            פריטים נבחרים ({selectedItems.length})
          </label>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
            {selectedItems.map((item) => (
              <div
                key={item.equipmentItemId}
                className="p-4 border-b border-zinc-800 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <span className="font-bold text-sm text-zinc-50">{item.name}</span>
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        handleUpdateQuantity(
                          item.equipmentItemId,
                          parseInt(e.target.value) || 1
                        )
                      }
                      className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm font-bold text-zinc-50 text-center focus:ring-2 focus:ring-zinc-500 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.equipmentItemId)}
                    className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-red-400"
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

      {successMessage && (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/10 p-4 text-sm text-emerald-400">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-4 text-sm text-red-400">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || selectedItems.length === 0}
        className="w-full h-14 inline-flex items-center justify-center rounded-2xl bg-zinc-50 px-6 text-base font-bold text-zinc-950 shadow-lg shadow-zinc-100/5 transition-all hover:bg-zinc-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting
          ? "מוסיף פריטים..."
          : selectedItems.length > 0
            ? `הוסף ${selectedItems.length} פריטים לתבנית`
            : "בחר פריטים תחילה"}
      </button>
    </form>
  );
}
