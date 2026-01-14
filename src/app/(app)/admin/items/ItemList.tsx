"use client";

import { useState, useEffect } from "react";
import { updateItemAction, deleteItemAction } from "./actions";
import { divisionLabel } from "@/lib/he";
import { Pagination } from "@/components/table/Pagination";
import { Division } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";

interface Item {
  id: string;
  name: string;
  active: boolean;
  categoryId: string;
  isWeapon: boolean;
  isSight: boolean;
  isClothing: boolean;
  isShoe: boolean;
  category: { id: string; name: string; division: string };
}

export default function ItemList({ 
  initialRows, 
  page,
  totalPages,
  total,
  searchParams: initialSearchParams
}: { 
  initialRows: Item[], 
  page: number,
  totalPages: number,
  total: number,
  searchParams: any
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState(initialRows);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedDivision, setSelectedDivision] = useState<Division | "ALL">((searchParams.get("division") as Division) || "ALL");

  useEffect(() => { setItems(initialRows); }, [initialRows]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const params = new URLSearchParams(searchParams.toString());
    if (query) {
      params.set("q", query);
    } else {
      params.delete("q");
    }
    params.set("page", "1");
    router.push(`/admin/items?${params.toString()}`);
  };

  const handleDivisionFilter = (division: Division | "ALL") => {
    setSelectedDivision(division);
    const params = new URLSearchParams(searchParams.toString());
    if (division && division !== "ALL") {
      params.set("division", division);
    } else {
      params.delete("division");
    }
    params.set("page", "1");
    router.push(`/admin/items?${params.toString()}`);
  };

  return (
    <>
      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="חיפוש לפי שם פריט..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all placeholder:text-zinc-700"
        />
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-2xl border border-zinc-800 border-dashed">
          לא נמצאו פריטים
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                <th className="px-4 py-3 text-right">
                  שם פריט
                </th>
                <th className="px-4 py-3 text-right">
                  <div className="flex flex-col gap-1">
                    <span>קטגוריה</span>
                    <select
                      value={selectedDivision}
                      onChange={(e) => handleDivisionFilter(e.target.value as Division | "ALL")}
                      className="mt-1 px-2 py-1 rounded border border-zinc-700 bg-zinc-900 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="ALL">הכל</option>
                      <option value="COMBAT">ציוד קרבי</option>
                      <option value="LOGISTICS">ציוד משקי</option>
                      <option value="MEDICAL">ציוד רפואי</option>
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3 text-center">סטטוס</th>
                <th className="px-4 py-3 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr 
                  key={item.id} 
                  className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors"
                >
                  <td className="px-4 py-4 text-sm font-bold text-zinc-50">
                    {item.name}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-400">
                    {divisionLabel(item.category.division as any)}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${
                      item.active
                        ? "bg-green-900/20 text-green-400 border-green-900/40"
                        : "bg-zinc-800 text-zinc-500 border-zinc-700"
                    }`}>
                      {item.active ? "פעיל" : "לא פעיל"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => setEditingItem(item)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer"
                      >
                        עריכה
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 border-t border-zinc-800 pt-8">
        <Pagination page={page} totalPages={totalPages} basePath="/admin/items" searchParams={initialSearchParams} />
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => !isDeleting && setEditingItem(null)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 p-8 shadow-2xl overflow-hidden border border-zinc-800 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-zinc-50">עריכת פריט: {editingItem.name}</h3>
              <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <form action={async (fd) => { await updateItemAction(fd); setEditingItem(null); }} className="grid gap-6">
              <input type="hidden" name="id" value={editingItem.id} />
              
              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">שם הפריט</label>
                <input name="name" defaultValue={editingItem.name} className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all" required />
              </div>

              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">חלוקה</label>
                <select name="division" defaultValue={editingItem.category.division} className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all" required>
                  {Object.values(Division).map((d) => (
                    <option key={d} value={d} className="bg-zinc-900">{divisionLabel(d)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">סטטוס</label>
                <select name="active" defaultValue={String(editingItem.active)} className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all">
                  <option value="true">פעיל</option>
                  <option value="false">לא פעיל</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-zinc-400 mb-3 block">סמן אם רלוונטי לפריט</label>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950 cursor-pointer hover:border-zinc-700 transition-colors">
                    <input
                      type="checkbox"
                      name="isWeapon"
                      value="true"
                      defaultChecked={editingItem.isWeapon}
                      className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-zinc-50 focus:ring-2 focus:ring-zinc-500 cursor-pointer"
                    />
                    <span className="text-sm text-zinc-50">נשק</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950 cursor-pointer hover:border-zinc-700 transition-colors">
                    <input
                      type="checkbox"
                      name="isSight"
                      value="true"
                      defaultChecked={editingItem.isSight}
                      className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-zinc-50 focus:ring-2 focus:ring-zinc-500 cursor-pointer"
                    />
                    <span className="text-sm text-zinc-50">צלמ</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950 cursor-pointer hover:border-zinc-700 transition-colors">
                    <input
                      type="checkbox"
                      name="isClothing"
                      value="true"
                      defaultChecked={editingItem.isClothing}
                      className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-zinc-50 focus:ring-2 focus:ring-zinc-500 cursor-pointer"
                    />
                    <span className="text-sm text-zinc-50">בגד</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950 cursor-pointer hover:border-zinc-700 transition-colors">
                    <input
                      type="checkbox"
                      name="isShoe"
                      value="true"
                      defaultChecked={editingItem.isShoe}
                      className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-zinc-50 focus:ring-2 focus:ring-zinc-500 cursor-pointer"
                    />
                    <span className="text-sm text-zinc-50">נעליים</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-4">
                <button type="submit" className="h-14 w-full inline-flex items-center justify-center rounded-2xl bg-zinc-50 text-base font-bold text-zinc-950 hover:bg-zinc-200 transition-all shadow-lg shadow-zinc-100/5 cursor-pointer">שמירת שינויים</button>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setIsDeleting(true)} className="flex-1 h-12 inline-flex items-center justify-center rounded-2xl border border-red-900/50 bg-red-950/20 text-sm font-bold text-red-500 hover:bg-red-950/40 transition-all cursor-pointer">מחיקה</button>
                  <button type="button" onClick={() => setEditingItem(null)} className="flex-1 h-12 inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 text-sm font-bold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer">ביטול</button>
                </div>
              </div>
            </form>

            {isDeleting && (
              <div className="absolute inset-0 z-10 flex items-center justify-center p-8 bg-zinc-900/95 backdrop-blur-md animate-in fade-in zoom-in duration-200">
                <div className="text-center w-full max-w-sm">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-950/50 text-red-500 mb-6 border border-red-900/50">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" /></svg>
                  </div>
                  <h4 className="text-2xl font-bold text-zinc-50 mb-3">האם אתה בטוח?</h4>
                  <p className="text-zinc-400 mb-10 leading-relaxed px-4">פעולה זו תמחק את הפריט מהמערכת. לא ניתן למחוק פריטים עם היסטוריה.</p>
                  <div className="flex flex-col gap-3">
                    <form action={async (fd) => { try { await deleteItemAction(fd); setIsDeleting(false); setEditingItem(null); } catch (e: any) { alert(e.message); setIsDeleting(false); } }}>
                      <input type="hidden" name="id" value={editingItem.id} />
                      <button type="submit" className="h-14 w-full inline-flex items-center justify-center rounded-2xl bg-red-600 text-base font-bold text-white hover:bg-red-700 transition-all shadow-lg shadow-red-950/20 cursor-pointer">כן, מחק פריט</button>
                    </form>
                    <button onClick={() => setIsDeleting(false)} className="h-12 w-full inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 text-sm font-bold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer">ביטול</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
