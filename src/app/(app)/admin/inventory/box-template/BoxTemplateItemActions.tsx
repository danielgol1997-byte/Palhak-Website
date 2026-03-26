"use client";

import { useState } from "react";
import { Division } from "@prisma/client";
import { divisionLabel } from "@/lib/he";
import {
  addBoxTemplateItemAction,
  removeBoxTemplateItemAction,
  addAlternativeAction,
  removeAlternativeAction,
  updateGroupNameAction,
} from "./actions";

interface AltItem {
  id: string;
  equipmentItemId: string;
  name: string;
  division: Division;
  categoryName: string;
}

interface AvailableItem {
  id: string;
  name: string;
  category: { division: Division; name: string };
}

interface Props {
  templateItemId: string;
  equipmentItemId: string;
  itemName: string;
  division: Division;
  categoryName: string;
  quantity: number;
  groupName: string | null;
  alternatives: AltItem[];
  availableItems: AvailableItem[];
}

export function BoxTemplateItemActions({
  templateItemId,
  equipmentItemId,
  itemName,
  division,
  categoryName,
  quantity,
  groupName,
  alternatives,
  availableItems,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAltPicker, setShowAltPicker] = useState(false);
  const [altSearch, setAltSearch] = useState("");
  const [groupNameValue, setGroupNameValue] = useState(groupName ?? "");

  const existingIds = new Set([equipmentItemId, ...alternatives.map((a) => a.equipmentItemId)]);

  const filteredAvailable = availableItems.filter(
    (item) =>
      !existingIds.has(item.id) &&
      (!altSearch ||
        item.name.toLowerCase().includes(altSearch.toLowerCase()) ||
        item.category.name.toLowerCase().includes(altSearch.toLowerCase()))
  );

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

  const handleAddAlt = async (altItemId: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("templateItemId", templateItemId);
      fd.append("alternativeItemId", altItemId);
      const result = await addAlternativeAction(fd);
      if (!result.success) setError(result.error || "אירעה שגיאה");
      else setShowAltPicker(false);
    } catch {
      setError("אירעה שגיאה בלתי צפויה");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveAlt = async (altId: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("altId", altId);
      const result = await removeAlternativeAction(fd);
      if (!result.success) setError(result.error || "אירעה שגיאה");
    } catch {
      setError("אירעה שגיאה בלתי צפויה");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveGroupName = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("templateItemId", templateItemId);
      fd.append("groupName", groupNameValue);
      const result = await updateGroupNameAction(fd);
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

        {/* Group display name */}
        <form onSubmit={handleSaveGroupName} className="border-t border-zinc-800 pt-4 mt-1">
          <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">
            שם קבוצה (לתצוגה בסינון)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={groupNameValue}
              onChange={(e) => setGroupNameValue(e.target.value)}
              placeholder={itemName}
              maxLength={80}
              className="h-10 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-sm text-zinc-50 placeholder:text-zinc-600 focus:ring-2 focus:ring-zinc-500 outline-none"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-4 rounded-xl bg-zinc-800 text-xs font-bold text-zinc-100 hover:bg-zinc-700 transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              שמור
            </button>
          </div>
          <p className="mt-1 text-[11px] text-zinc-600">
            שם גנרי לקבוצה זו בסינון הקרטונים. אם ריק — ישתמש בשם הפריט הראשי.
          </p>
        </form>

        {/* Alternatives section */}
        <div className="border-t border-zinc-800 pt-4 mt-1">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-zinc-400">
              פריטים חלופיים
              {alternatives.length > 0 && (
                <span className="text-xs text-zinc-500 font-normal mr-1">
                  ({alternatives.length})
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setShowAltPicker(!showAltPicker); setAltSearch(""); }}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-violet-900/20 text-violet-400 border border-violet-900/40 hover:bg-violet-900/40 transition-all cursor-pointer disabled:opacity-50"
            >
              {showAltPicker ? "סגור" : "+ הוסף חלופה"}
            </button>
          </div>

          {alternatives.length === 0 && !showAltPicker && (
            <div className="text-xs text-zinc-600">
              אין חלופות. אם יש סוגים שונים של פריט זה (לדוגמה: קסדות שונות), הוסף אותם כחלופות.
            </div>
          )}

          {alternatives.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {alternatives.map((alt) => (
                <div
                  key={alt.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-violet-900/30 bg-violet-950/10"
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-50">{alt.name}</div>
                    <div className="text-xs text-zinc-500">
                      {divisionLabel(alt.division)} · {alt.categoryName}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAlt(alt.id)}
                    disabled={isSubmitting}
                    className="p-1 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-red-400 disabled:opacity-50 cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAltPicker && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="p-3 border-b border-zinc-800">
                <input
                  type="text"
                  value={altSearch}
                  onChange={(e) => setAltSearch(e.target.value)}
                  placeholder="חפש פריט חלופי..."
                  className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-50 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-violet-500"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredAvailable.length === 0 ? (
                  <div className="py-4 text-center text-xs text-zinc-500">לא נמצאו פריטים</div>
                ) : (
                  filteredAvailable.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleAddAlt(item.id)}
                      disabled={isSubmitting}
                      className="w-full px-4 py-2.5 text-right border-b border-zinc-800 last:border-0 hover:bg-zinc-800 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <div className="text-sm font-medium text-zinc-50">{item.name}</div>
                      <div className="text-xs text-zinc-500">
                        {divisionLabel(item.category.division)} · {item.category.name}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
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
