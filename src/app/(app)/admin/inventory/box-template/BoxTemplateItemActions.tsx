"use client";

import { useState } from "react";
import { Division } from "@prisma/client";
import { divisionLabel } from "@/lib/he";
import { addBoxTemplateItemAction, removeBoxTemplateItemAction } from "./actions";

interface Props {
  equipmentItemId: string;
  itemName: string;
  division: Division;
  categoryName: string;
  quantity: number;
}

export function BoxTemplateItemActions({ equipmentItemId, itemName, division, categoryName, quantity }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdate = async (formData: FormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await addBoxTemplateItemAction(formData);
      if (!result.success) setError(result.error || "אירעה שגיאה");
    } catch {
      setError("אירעה שגיאה בלתי צפויה");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (formData: FormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await removeBoxTemplateItemAction(formData);
      if (!result.success) setError(result.error || "אירעה שגיאה");
    } catch {
      setError("אירעה שגיאה בלתי צפויה");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-inner">
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-lg font-bold text-zinc-50">{itemName}</div>
          <div className="text-sm text-zinc-400 mt-1">
            {divisionLabel(division)} · {categoryName}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <form action={handleUpdate} className="flex items-center gap-3 flex-1 min-w-[200px]">
            <input type="hidden" name="equipmentItemId" value={equipmentItemId} />
            <div className="flex-1">
              <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">כמות</label>
              <input
                name="quantity"
                type="number"
                min={1}
                defaultValue={quantity}
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
                required
              />
            </div>
            <button
              disabled={isSubmitting}
              className="h-12 px-6 self-end rounded-xl bg-zinc-800 text-sm font-bold text-zinc-100 hover:bg-zinc-700 transition-all cursor-pointer disabled:opacity-50"
            >
              עדכן
            </button>
          </form>

          <form action={handleRemove} className="self-end">
            <input type="hidden" name="equipmentItemId" value={equipmentItemId} />
            <button
              disabled={isSubmitting}
              className="h-12 px-6 rounded-xl border border-red-900/50 bg-red-950/20 text-sm font-bold text-red-500 hover:bg-red-950/40 transition-all cursor-pointer disabled:opacity-50"
            >
              הסרה
            </button>
          </form>
        </div>

        {error && (
          <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
