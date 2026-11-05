"use client";

import { useState, useEffect } from "react";
import { updateUnitTemplateAction, deleteUnitTemplateAction } from "./actions";
import { Sheet, SheetActions } from "@/components/ui/Sheet";

interface UnitTemplate {
  id: string;
  name: string;
  active: boolean;
  _count: { items: number };
}

export default function UnitTemplateList({ initialRows }: { initialRows: UnitTemplate[] }) {
  const [items, setItems] = useState(initialRows);
  const [editingItem, setEditingItem] = useState<UnitTemplate | null>(null);

  useEffect(() => { setItems(initialRows); }, [initialRows]);

  return (
    <>
      <div className="flex flex-col gap-4">
        {items.map((row) => (
          <div key={row.id} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-inner transition-all hover:border-zinc-700">
            <div className="flex items-start justify-between gap-4">
              <div>
                <a href={`/admin/unit-templates/${row.id}`} className="text-lg font-bold hover:underline text-zinc-50 decoration-zinc-500 underline-offset-4">
                  {row.name}
                </a>
                <div className="mt-1 text-sm text-zinc-400">
                  {row._count.items} פריטים בתבנית · סטטוס: {row.active ? "פעיל" : "לא פעיל"}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row shrink-0">
                <a href={`/admin/unit-templates/${row.id}`} className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-800 px-4 text-xs font-bold text-zinc-100 transition-all hover:bg-zinc-700 hover:scale-105 active:scale-95 cursor-pointer">
                  ניהול תכולה
                </a>
                <button
                  onClick={() => setEditingItem(row)}
                  className="h-10 rounded-xl px-4 text-sm font-bold bg-zinc-800 text-zinc-300 transition-all hover:bg-zinc-700 hover:text-zinc-50 hover:scale-105 active:scale-95 cursor-pointer"
                >
                  עריכה
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="py-10 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-3xl border border-zinc-800 border-dashed">
            לא נמצאו יחידות.
          </div>
        )}
      </div>

      {editingItem && (
        <Sheet
          open
          onClose={() => setEditingItem(null)}
          title={`עריכת יחידה: ${editingItem.name}`}
          size="md"
          footer={
            <SheetActions>
              <button type="submit" form="unit-template-edit-form" className="h-12 w-full sm:w-auto sm:px-8 inline-flex items-center justify-center rounded-2xl bg-zinc-50 text-base font-bold text-zinc-950 hover:bg-zinc-200 transition-all shadow-lg shadow-lg-100/5 cursor-pointer">שמירה</button>
              <button type="button" onClick={() => setEditingItem(null)} className="h-12 w-full sm:w-auto sm:px-8 inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 text-base font-bold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer">ביטול</button>
            </SheetActions>
          }
        >
            <form id="unit-template-edit-form" action={async (fd) => { await updateUnitTemplateAction(fd); setEditingItem(null); }} className="grid gap-6">
              <input type="hidden" name="id" value={editingItem.id} />
              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">שם היחידה</label>
                <input name="name" defaultValue={editingItem.name} className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all" required />
              </div>
              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">סטטוס</label>
                <select name="active" defaultValue={String(editingItem.active)} className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all">
                  <option value="true" className="bg-zinc-900">פעיל</option>
                  <option value="false" className="bg-zinc-900">לא פעיל</option>
                </select>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-zinc-800">
              <form action={async (fd) => { if (confirm(`האם אתה בטוח שברצונך למחוק את ${editingItem.name}?`)) { await deleteUnitTemplateAction(fd); setEditingItem(null); window.location.reload(); } }}>
                <input type="hidden" name="id" value={editingItem.id} />
                <button type="submit" className="w-full h-12 inline-flex items-center justify-center rounded-xl border border-red-900/50 bg-red-950/20 text-sm font-bold text-red-500 hover:bg-red-950/40 transition-all cursor-pointer">
                  מחיקת יחידה
                </button>
              </form>
            </div>
        </Sheet>
      )}
    </>
  );
}
