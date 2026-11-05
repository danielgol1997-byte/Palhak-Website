"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { reorderDepartmentsAction, updateDepartmentAction, deleteDepartmentAction } from "./actions";
import { Division } from "@prisma/client";
import { Sheet, SheetActions } from "@/components/ui/Sheet";

interface Department {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  divisions: { division: Division }[];
}

function divisionLabel(d: Division): string {
  switch (d) {
    case Division.COMBAT:
      return "ציוד קרבי";
    case Division.LOGISTICS:
      return "ציוד משקי";
    case Division.MEDICAL:
      return "ציוד רפואי";
  }
}

interface SortableItemProps {
  d: Department;
  onEdit: (d: Department) => void;
}

function SortableItem({ d, onEdit }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: d.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm transition-all hover:border-zinc-700 hover:shadow-md"
    >
      <div className="flex items-center gap-4">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex h-10 w-10 cursor-grab items-center justify-center rounded-xl bg-zinc-800 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300 active:cursor-grabbing"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
            <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-zinc-50">{d.name}</div>
          <div className="mt-1 text-sm text-zinc-400">
            סטטוס: {d.active ? "פעיל" : "לא פעיל"}
          </div>
          {d.divisions.length > 0 ? (
            <div className="mt-1 text-xs text-zinc-500">
              חלוקות: {d.divisions.map((x) => divisionLabel(x.division)).join(", ")}
            </div>
          ) : null}
        </div>

        <button
          onClick={() => onEdit(d)}
          className="rounded-xl px-4 py-2 text-sm font-bold bg-zinc-800 text-zinc-300 transition-all hover:bg-zinc-700 hover:text-zinc-50 hover:scale-105 active:scale-95 cursor-pointer"
        >
          עריכה
        </button>
      </div>
    </div>
  );
}

export default function DepartmentList({ initialRows }: { initialRows: Department[] }) {
  const [items, setItems] = useState(initialRows);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setItems(initialRows);
  }, [initialRows]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        reorderDepartmentsAction(newItems.map(i => i.id)).catch(console.error);
        return newItems;
      });
    }
  }

  if (!mounted) {
    return (
      <div className="mt-4 flex flex-col gap-3">
        {items.map((d) => (
          <div
            key={d.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800" />
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-zinc-50">{d.name}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="mt-4 flex flex-col gap-4">
            {items.map((d) => (
              <SortableItem key={d.id} d={d} onEdit={setEditingDept} />
            ))}
            {items.length === 0 ? (
              <div className="text-sm text-zinc-500 py-10 text-center bg-zinc-950/50 rounded-3xl border border-zinc-800 border-dashed">אין מחלקות.</div>
            ) : null}
          </div>
        </SortableContext>
      </DndContext>

      {editingDept && (
        <Sheet
          open
          onClose={() => !isDeleting && setEditingDept(null)}
          dismissible={!isDeleting}
          title={`עריכת מחלקה: ${editingDept.name}`}
          size="md"
          footer={
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                form="department-edit-form"
                className="h-12 w-full inline-flex items-center justify-center rounded-2xl bg-zinc-50 text-base font-bold text-zinc-950 hover:bg-zinc-200 transition-all shadow-lg shadow-zinc-100/5 cursor-pointer"
              >
                שמירת שינויים
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleting(true)}
                  className="flex-1 h-12 inline-flex items-center justify-center rounded-2xl border border-red-900/50 bg-red-950/20 text-sm font-bold text-red-500 hover:bg-red-950/40 transition-all cursor-pointer"
                >
                  מחיקה
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDept(null)}
                  className="flex-1 h-12 inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 text-sm font-bold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer"
                >
                  ביטול
                </button>
              </div>
            </div>
          }
        >
            <form id="department-edit-form" action={async (fd) => { await updateDepartmentAction(fd); setEditingDept(null); }} className="grid gap-6">
              <input type="hidden" name="id" value={editingDept.id} />
              
              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">שם המחלקה</label>
                <input
                  name="name"
                  defaultValue={editingDept.name}
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-bold text-zinc-400 mb-2 block">סטטוס</label>
                <select
                  name="active"
                  defaultValue={String(editingDept.active)}
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
                >
                  <option value="true">פעיל</option>
                  <option value="false">לא פעיל</option>
                </select>
              </div>

              <div>
                <div className="text-sm font-bold text-zinc-400 mb-4">חלוקות רלוונטיות</div>
                <div className="grid gap-3">
                  {Object.values(Division).map((div) => (
                    <label
                      key={div}
                      className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 cursor-pointer hover:bg-zinc-800 transition-colors"
                    >
                      <input
                        type="checkbox"
                        name="divisions"
                        value={div}
                        defaultChecked={editingDept.divisions.some((x) => x.division === div)}
                        className="h-5 w-5 rounded border-zinc-700 bg-zinc-800 text-zinc-50"
                      />
                      <span className="text-sm font-medium text-zinc-100">{divisionLabel(div)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </form>
        </Sheet>
      )}

      {editingDept && isDeleting && (
        <Sheet
          open
          onClose={() => setIsDeleting(false)}
          size="sm"
          zIndex={210}
          footer={
            <SheetActions>
              <form
                className="w-full sm:w-auto"
                action={async (fd) => {
                  try {
                    await deleteDepartmentAction(fd);
                    setIsDeleting(false);
                    setEditingDept(null);
                  } catch (e: any) {
                    alert(e.message);
                    setIsDeleting(false);
                  }
                }}
              >
                <input type="hidden" name="id" value={editingDept.id} />
                <button
                  type="submit"
                  className="h-12 w-full sm:w-auto sm:px-6 inline-flex items-center justify-center rounded-2xl bg-red-600 text-base font-bold text-white hover:bg-red-700 transition-all shadow-lg shadow-red-950/20 cursor-pointer"
                >
                  כן, מחק מחלקה
                </button>
              </form>
              <button
                type="button"
                onClick={() => setIsDeleting(false)}
                className="h-12 w-full sm:w-auto sm:px-6 inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 text-sm font-bold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer"
              >
                ביטול
              </button>
            </SheetActions>
          }
        >
          <div className="text-center w-full max-w-sm mx-auto py-2">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-950/50 text-red-500 mb-6 border border-red-900/50">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
            </div>
            <h4 className="text-2xl font-bold text-zinc-50 mb-3">האם אתה בטוח?</h4>
            <p className="text-zinc-400 leading-relaxed px-4">
              מחיקת מחלקה תסיר אותה מהמערכת לצמיתות. לא ניתן למחוק מחלקות עם חיילים או תפקידים פעילים.
            </p>
          </div>
        </Sheet>
      )}
    </>
  );
}
