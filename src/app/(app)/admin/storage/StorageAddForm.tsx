"use client";

import { useState, useMemo } from "react";
import { Division } from "@prisma/client";
import { divisionLabel } from "@/lib/he";
import { upsertStorageInventoryAction } from "./actions";

interface Item {
  id: string;
  name: string;
  category: {
    division: Division;
  };
}

export default function StorageAddForm({ items }: { items: Item[] }) {
  const [search, setSearch] = useState("");
  const [selectedDivision, setSelectedDivision] = useState<Division | "ALL">("ALL");
  const [selectedItemId, setSelectedItemId] = useState("");

  const filteredItems = useMemo(() => {
    const s = search.toLowerCase().trim();
    return items.filter((item) => {
      const matchesSearch = !s || item.name.toLowerCase().includes(s);
      const matchesDivision = selectedDivision === "ALL" || item.category.division === selectedDivision;
      return matchesSearch && matchesDivision;
    });
  }, [items, search, selectedDivision]);

  // Reset selected item if it's no longer in filtered list
  useMemo(() => {
    if (selectedItemId && !filteredItems.some(i => i.id === selectedItemId)) {
      setSelectedItemId("");
    }
  }, [filteredItems, selectedItemId]);

  return (
    <form action={upsertStorageInventoryAction} className="grid gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-5">
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">חיפוש וסינון פריט</label>
            <div className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <input
                  type="text"
                  placeholder="חיפוש לפי שם..."
                  className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 pr-9 pl-3 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all placeholder:text-zinc-700"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="h-10 rounded-xl border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all cursor-pointer"
                value={selectedDivision}
                onChange={(e) => setSelectedDivision(e.target.value as Division | "ALL")}
              >
                <option value="ALL">הכל</option>
                {Object.values(Division).map((d) => (
                  <option key={d} value={d}>{divisionLabel(d)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">בחירת פריט מהרשימה</label>
            <select
              name="equipmentItemId"
              required
              className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all cursor-pointer"
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
            >
              <option value="" className="text-zinc-500">
                {filteredItems.length === 0 ? "לא נמצאו פריטים" : `בחירת פריט (${filteredItems.length} נמצאו)...`}
              </option>
              {filteredItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} [{divisionLabel(item.category.division)}]
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col justify-end">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">כמות לעדכון במחסן</label>
          <input
            name="quantity"
            type="number"
            min="0"
            required
            placeholder="הזן כמות..."
            className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all placeholder:text-zinc-700"
          />
          <div className="mt-2 text-[10px] text-zinc-500">הערה: עדכון הכמות יחליף את הכמות הקיימת במחסן עבור פריט זה.</div>
        </div>
      </div>

      <button 
        type="submit"
        className="h-14 w-full inline-flex items-center justify-center rounded-2xl bg-zinc-50 px-6 text-base font-bold text-zinc-950 shadow-lg shadow-zinc-100/5 transition-all hover:bg-zinc-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
      >
        עדכון מלאי ימ״ח
      </button>
    </form>
  );
}

