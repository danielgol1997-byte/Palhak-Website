"use client";

import { useState } from "react";
import { Division, RequestType, ClothingSize, ShoeSize } from "@prisma/client";
import { createRequestAction } from "./actions";
import { EquipmentSelector } from "@/components/equipment/EquipmentSelector";
import { LoadingOverlay } from "@/components/ui/LoadingSpinner";
import { SuccessModal } from "@/components/ui/SuccessModal";

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
  clothingSize?: ClothingSize;
  shoeSize?: ShoeSize;
}

interface NewEquipmentFormProps {
  items: EquipmentItem[];
  unitTemplates: UnitTemplate[];
  userSizes: {
    shirtSize: ClothingSize | null;
    pantsSize: ClothingSize | null;
    shoeSize: ShoeSize | null;
  };
}

export function NewEquipmentForm({ items, unitTemplates, userSizes }: NewEquipmentFormProps) {
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [userNotes, setUserNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleItemsChange = (newItems: SelectedItem[]) => {
    // Add default sizes for clothing/shoes based on user profile for NEW items only
    const itemsWithSizes = newItems.map((item) => {
      const existingItem = selectedItems.find((si) => si.id === item.id);
      
      // If item already exists and has sizes set, preserve the sizes but use new quantity/serial
      if (existingItem && (existingItem.clothingSize || existingItem.shoeSize)) {
        return {
          ...item,
          clothingSize: existingItem.clothingSize,
          shoeSize: existingItem.shoeSize,
        };
      }

      // For new items, set default sizes based on item name
      if (item.isClothing && !item.clothingSize) {
        const itemNameLower = item.name.toLowerCase();
        let defaultSize = userSizes.shirtSize; // Default to shirt size
        
        // Check if it's pants - use pants size
        if (itemNameLower.includes('מכנס')) {
          defaultSize = userSizes.pantsSize;
        }
        // Check if it's a shirt - use shirt size
        else if (itemNameLower.includes('חולצת') || itemNameLower.includes('חולצה')) {
          defaultSize = userSizes.shirtSize;
        }
        // Check if it's a coat or raincoat - use shirt size
        else if (itemNameLower.includes('מעיל') || itemNameLower.includes('חלפ״ס')) {
          defaultSize = userSizes.shirtSize;
        }
        
        return {
          ...item,
          clothingSize: defaultSize || undefined,
        };
      }

      if (item.isShoe && !item.shoeSize) {
        return {
          ...item,
          shoeSize: userSizes.shoeSize || undefined,
        };
      }

      return item;
    });

    setSelectedItems(itemsWithSizes);
  };

  const handleSizeChange = (itemId: string, type: "clothing" | "shoe", size: string) => {
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...(type === "clothing" ? { clothingSize: size as ClothingSize } : {}),
              ...(type === "shoe" ? { shoeSize: size as ShoeSize } : {}),
            }
          : item
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (selectedItems.length === 0) {
      setErrorMessage("יש לבחור לפחות פריט אחד");
      return;
    }

    // Validate sizes for clothing/shoes
    for (const item of selectedItems) {
      if (item.isClothing && !item.clothingSize) {
        setErrorMessage(`נדרשת מידה עבור ${item.name}`);
        return;
      }
      if (item.isShoe && !item.shoeSize) {
        setErrorMessage(`נדרשת מידת נעליים עבור ${item.name}`);
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("type", RequestType.NEW_EQUIPMENT);
      formData.append("userNotes", userNotes);

      // Add items as JSON string (no serial numbers - admin assigns those)
      const itemsData = selectedItems.map((item) => ({
        equipmentItemId: item.equipmentItemId,
        quantity: item.quantity,
        ...(item.clothingSize && { clothingSize: item.clothingSize }),
        ...(item.shoeSize && { shoeSize: item.shoeSize }),
      }));

      formData.append("items", JSON.stringify(itemsData));

      await createRequestAction(formData);

      setSuccessMessage(`בקשה נשלחה בהצלחה! (${selectedItems.length} פריטים)`);
      setSelectedItems([]);
      setUserNotes("");
    } catch (err: any) {
      setErrorMessage(err.message || "אירעה שגיאה בשליחת הבקשה");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      {isSubmitting && <LoadingOverlay text="שולח בקשה..." />}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Equipment Selector */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <EquipmentSelector
            availableItems={items}
            availableUnits={unitTemplates}
            selectedItems={selectedItems}
            onItemsChange={handleItemsChange}
            mode="request"
          />

          {/* Size Selection for Clothing/Shoes */}
          {selectedItems.some((item) => item.isClothing || item.isShoe) && (
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <h4 className="text-sm font-bold text-zinc-400 mb-4">בחירת מידות</h4>
              <div className="space-y-4">
                {selectedItems
                  .filter((item) => item.isClothing || item.isShoe)
                  .map((item) => (
                    <div key={item.id} className="flex items-center gap-4">
                      <div className="flex-1">
                        <span className="text-sm font-bold text-zinc-50">{item.name}</span>
                      </div>
                      {item.isClothing && (
                        <select
                          value={item.clothingSize || ""}
                          onChange={(e) => handleSizeChange(item.id, "clothing", e.target.value)}
                          className="h-10 w-32 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
                          required
                        >
                          <option value="">בחר מידה</option>
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
                          onChange={(e) => handleSizeChange(item.id, "shoe", e.target.value)}
                          className="h-10 w-32 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
                          required
                        >
                          <option value="">בחר מידה</option>
                          {Object.values(ShoeSize).map((size) => (
                            <option key={size} value={size}>
                              {size.replace("SIZE_", "")}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* User Notes */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <label className="text-sm font-bold text-zinc-400 mb-2 block">הערות (אופציונלי)</label>
          <textarea
            value={userNotes}
            onChange={(e) => setUserNotes(e.target.value)}
            rows={4}
            placeholder="הוסף הערות לבקשה..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-zinc-500 transition-all resize-none"
          />
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-4 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || selectedItems.length === 0}
          className="w-full h-14 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-bold text-white hover:bg-emerald-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            "שולח בקשה..."
          ) : selectedItems.length > 0 ? (
            <>
              שלח בקשה ({selectedItems.length} פריטים)
            </>
          ) : (
            "בחר פריטים תחילה"
          )}
        </button>
      </form>

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

