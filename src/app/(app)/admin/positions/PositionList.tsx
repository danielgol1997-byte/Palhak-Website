"use client";

import { useState, useEffect, useMemo } from "react";
import { updatePositionAction } from "./actions";
import { Pagination } from "@/components/table/Pagination";

interface Position {
  id: string;
  name: string;
  active: boolean;
  departmentId: string;
  sortOrder: number;
  department: { id: string; name: string };
}

export default function PositionList({ 
  initialRows, 
  departments: rawDepartments,
  page,
  totalPages,
  total,
  searchParams
}: { 
  initialRows: Position[], 
  departments: { id: string; name: string }[],
  page: number,
  totalPages: number,
  total: number,
  searchParams: any
}) {
  const [items, setItems] = useState(initialRows);
  const [editingItem, setEditingItem] = useState<Position | null>(null);

  const departments = useMemo(() => {
    return Array.from(
      rawDepartments.reduce((map, dept) => {
        const name = dept.name.trim();
        if (!map.has(name)) map.set(name, dept);
        return map;
      }, new Map<string, { id: string; name: string }>()).values()
    );
  }, [rawDepartments]);

  useEffect(() => { setItems(initialRows); }, [initialRows]);

  return (
    <>
      <div className="flex flex-col gap-4">
        {items.map((row) => (
          <div key={row.id} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-inner transition-all hover:border-zinc-700">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-bold text-zinc-50">{row.name}</div>
                <div className="mt-1 text-sm text-zinc-400">
                  מחלקה: {row.department.name} · סטטוס: {row.active ? "פעיל" : "לא פעיל"}
                </div>
              </div>
              <button
                onClick={() => setEditingItem(row)}
                className="rounded-xl px-4 py-2 text-sm font-bold bg-zinc-800 text-zinc-300 transition-all hover:bg-zinc-700 hover:text-zinc-50 hover:scale-105 active:scale-95 cursor-pointer"
              >
                עריכה
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="py-10 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-3xl border border-zinc-800 border-dashed">
            לא נמצאו תפקידים.
          </div>
        )}
      </div>

      <div className="mt-8 border-t border-zinc-800 pt-8">
        <Pagination page={page} totalPages={totalPages} basePath="/admin/positions" searchParams={searchParams} />
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setEditingItem(null)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 p-8 shadow-2xl overflow-hidden border border-zinc-800 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-zinc-50">עריכת תפקיד: {editingItem.name}</h3>
              <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <form action={async (fd) => { await updatePositionAction(fd); setEditingItem(null); }} className="grid gap-6">
              <input type="hidden" name="id" value={editingItem.id} />
              
              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">שם התפקיד</label>
                <input name="name" defaultValue={editingItem.name} className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all" required />
              </div>

              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">מחלקה</label>
                <select name="departmentId" defaultValue={editingItem.departmentId} className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all" required>
                  {departments.map((d) => (<option key={d.id} value={d.id} className="bg-zinc-900">{d.name}</option>))}
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">סטטוס</label>
                <select name="active" defaultValue={String(editingItem.active)} className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all">
                  <option value="true" className="bg-zinc-900">פעיל</option>
                  <option value="false" className="bg-zinc-900">לא פעיל</option>
                </select>
              </div>

              <div className="flex gap-3 mt-4">
                <button type="submit" className="flex-1 h-14 inline-flex items-center justify-center rounded-2xl bg-zinc-50 text-base font-bold text-zinc-950 hover:bg-zinc-200 transition-all shadow-lg shadow-zinc-100/5 cursor-pointer">שמירה</button>
                <button type="button" onClick={() => setEditingItem(null)} className="flex-1 h-14 inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 text-base font-bold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
