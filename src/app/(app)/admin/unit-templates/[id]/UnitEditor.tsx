"use client";

import { useState } from "react";
import { Division } from "@prisma/client";
import { UnitItemSelector } from "./UnitItemSelector";
import { addMultipleUnitTemplateItemsAction } from "../actions";

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

interface UnitEditorProps {
  unitTemplateId: string;
  availableItems: EquipmentItem[];
}

export function UnitEditor({ unitTemplateId, availableItems }: UnitEditorProps) {
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      formData.append("unitTemplateId", unitTemplateId);
      formData.append("items", JSON.stringify(selectedItems));

      await addMultipleUnitTemplateItemsAction(formData);

      setSuccessMessage(`${selectedItems.length} פריטים נוספו בהצלחה!`);
      setSelectedItems([]);

      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || "אירעה שגיאה בהוספת הפריטים");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <UnitItemSelector
        availableItems={availableItems}
        selectedItems={selectedItems}
        onItemsChange={setSelectedItems}
      />

      {/* Messages */}
      {successMessage && (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/10 p-4 text-sm text-emerald-400">
          ✓ {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-4 text-sm text-red-400">
          {errorMessage}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || selectedItems.length === 0}
        className="w-full h-14 inline-flex items-center justify-center rounded-2xl bg-zinc-50 px-6 text-base font-bold text-zinc-950 shadow-lg shadow-zinc-100/5 transition-all hover:bg-zinc-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          "מוסיף פריטים..."
        ) : selectedItems.length > 0 ? (
          `הוסף ${selectedItems.length} פריטים לתבנית`
        ) : (
          "בחר פריטים תחילה"
        )}
      </button>
    </form>
  );
}

