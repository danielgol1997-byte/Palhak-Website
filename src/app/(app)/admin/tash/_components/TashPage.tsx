"use client";

import { useMemo, useState, useTransition } from "react";
import type { TashLogAction } from "@prisma/client";
import {
  createTashItemAction,
  updateTashItemAction,
  deleteTashItemAction,
  addTashQuantityAction,
  deductTashQuantityAction,
  moveTashQuantityAction,
  markTashLossAction,
  updateTashLogNotesAction,
  deleteTashLogAction,
} from "../actions";
import { LocationCombobox } from "./LocationCombobox";
import type { SavedLocation } from "./LocationCombobox";

// ─── Types ────────────────────────────────────────────────────────────────────

type TashInventoryData = {
  id: string;
  location: string;
  quantity: number;
};

type TashLogData = {
  id: string;
  action: TashLogAction;
  quantity: number;
  fromLocation: string | null;
  toLocation: string | null;
  notes: string | null;
  createdAt: Date | string;
  performedBy: { id: string; name: string };
};

type TashItemData = {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  inventory: TashInventoryData[];
  logs: TashLogData[];
};

type ModalState =
  | { type: "add-item" }
  | { type: "edit-item"; item: TashItemData }
  | { type: "delete-item"; item: TashItemData }
  | { type: "add-qty"; item: TashItemData }
  | { type: "deduct-qty"; item: TashItemData; location: string; currentQty: number }
  | { type: "move"; item: TashItemData; fromLocation: string; currentQty: number }
  | { type: "mark-loss"; item: TashItemData; location: string; currentQty: number }
  | { type: "history"; item: TashItemData; locationFilter?: string | null }
  | null;

// ─── Constants ────────────────────────────────────────────────────────────────

const YAMAH = "ימ״ח";

const ACTION_LABEL: Record<TashLogAction, string> = {
  ADDED: "נוסף",
  DEDUCTED: "הורד",
  MOVED: "הועבר",
  RETURNED: "הוחזר לימ״ח",
  LOST: "אבד",
  STOLEN: "נגנב",
  DAMAGED: "ניזוק / שומש",
};

const ACTION_COLOR: Record<TashLogAction, string> = {
  ADDED: "bg-emerald-900/40 text-emerald-300 border-emerald-700",
  DEDUCTED: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
  MOVED: "bg-blue-900/40 text-blue-300 border-blue-700",
  RETURNED: "bg-teal-900/40 text-teal-300 border-teal-700",
  LOST: "bg-red-900/40 text-red-300 border-red-700",
  STOLEN: "bg-red-900/40 text-red-300 border-red-700",
  DAMAGED: "bg-orange-900/40 text-orange-300 border-orange-700",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function totalQty(item: TashItemData) {
  return item.inventory.reduce((s, i) => s + i.quantity, 0);
}

function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Shared modal wrapper ─────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-50">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-xl leading-none">✕</button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ─── Form field helpers ───────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-300">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500";

// ─── Item form modal (add / edit) ─────────────────────────────────────────────

function ItemFormModal({
  mode,
  item,
  onClose,
  onSuccess,
}: {
  mode: "add" | "edit";
  item?: TashItemData;
  onClose: () => void;
  onSuccess: (updated: TashItemData) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        if (mode === "add") {
          await createTashItemAction(fd);
          onSuccess({
            id: "__new__",
            name: fd.get("name") as string,
            description: (fd.get("description") as string) || null,
            unit: (fd.get("unit") as string) || "יחידה",
            inventory: [],
            logs: [],
          });
        } else {
          await updateTashItemAction(fd);
          onSuccess({
            ...item!,
            name: fd.get("name") as string,
            description: (fd.get("description") as string) || null,
            unit: (fd.get("unit") as string) || "יחידה",
          });
        }
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "שגיאה לא ידועה");
      }
    });
  }

  return (
    <Modal title={mode === "add" ? "הוספת פריט חדש" : "עריכת פריט"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
        {item && <input type="hidden" name="id" value={item.id} />}
        <Field label="שם הפריט *">
          <input className={inputCls} name="name" defaultValue={item?.name} placeholder="לדוג׳: שולחן, גיטרה, מיכל גז..." required />
        </Field>
        <Field label="תיאור (אופציונלי)">
          <input className={inputCls} name="description" defaultValue={item?.description ?? ""} placeholder="תיאור קצר..." />
        </Field>
        <Field label="יחידת מידה">
          <input className={inputCls} name="unit" defaultValue={item?.unit ?? "יחידה"} placeholder="יחידה, זוג, ערכה..." />
        </Field>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-lg bg-zinc-100 py-2 text-sm font-bold text-zinc-900 hover:bg-white disabled:opacity-50 transition-colors"
          >
            {pending ? "שומר..." : mode === "add" ? "הוסף פריט" : "שמור שינויים"}
          </button>
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
            ביטול
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteModal({ item, onClose, onSuccess }: { item: TashItemData; onClose: () => void; onSuccess: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const total = totalQty(item);

  function handleDelete() {
    setError("");
    const fd = new FormData();
    fd.set("id", item.id);
    startTransition(async () => {
      try {
        await deleteTashItemAction(fd);
        onSuccess();
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  return (
    <Modal title="מחיקת פריט" onClose={onClose}>
      <div className="p-6 flex flex-col gap-4">
        <p className="text-sm text-zinc-300">
          האם למחוק את הפריט <span className="font-bold text-zinc-50">{item.name}</span>?
        </p>
        {total > 0 && (
          <div className="rounded-lg border border-red-800 bg-red-900/20 p-3">
            <p className="text-sm text-red-300">
              לא ניתן למחוק — קיים מלאי של {total} {item.unit} בסך הכל.
              יש לאפס את המלאי לפני המחיקה.
            </p>
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleDelete}
            disabled={pending || total > 0}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-40 transition-colors"
          >
            {pending ? "מוחק..." : "מחק"}
          </button>
          <button onClick={onClose} className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
            ביטול
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add quantity modal ───────────────────────────────────────────────────────

function AddQtyModal({
  item,
  locations,
  onLocationsChange,
  onClose,
  onSuccess,
}: {
  item: TashItemData;
  locations: SavedLocation[];
  onLocationsChange: (l: SavedLocation[]) => void;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [location, setLocation] = useState(YAMAH);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("itemId", item.id);
    fd.set("location", location.trim());
    startTransition(async () => {
      try {
        await addTashQuantityAction(fd);
        onSuccess();
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  return (
    <Modal title={`הוספת כמות — ${item.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
        <Field label="מיקום">
          <LocationCombobox
            name="location"
            value={location}
            onChange={setLocation}
            locations={locations}
            onLocationsChange={onLocationsChange}
            placeholder="בחר או הקלד מיקום..."
            required
          />
        </Field>
        <Field label={`כמות (${item.unit})`}>
          <input className={inputCls} name="quantity" type="number" min="1" placeholder="1" required />
        </Field>
        <Field label="הערות (אופציונלי)">
          <input className={inputCls} name="notes" placeholder="הערה..." />
        </Field>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={pending} className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors">
            {pending ? "שומר..." : "הוסף"}
          </button>
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
            ביטול
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Deduct quantity modal ────────────────────────────────────────────────────

function DeductQtyModal({
  item,
  location,
  currentQty,
  onClose,
  onSuccess,
}: {
  item: TashItemData;
  location: string;
  currentQty: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("itemId", item.id);
    fd.set("location", location);
    startTransition(async () => {
      try {
        await deductTashQuantityAction(fd);
        onSuccess();
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  return (
    <Modal title={`הורדת כמות — ${item.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm">
          <span className="text-zinc-400">מיקום: </span>
          <span className="font-medium text-zinc-100">{location}</span>
          <span className="text-zinc-400 mr-4">כמות קיימת: </span>
          <span className="font-medium text-zinc-100">{currentQty} {item.unit}</span>
        </div>
        <Field label={`כמות להורדה (${item.unit})`}>
          <input className={inputCls} name="quantity" type="number" min="1" max={currentQty} placeholder="1" required />
        </Field>
        <Field label="הערות (אופציונלי)">
          <input className={inputCls} name="notes" placeholder="סיבה / הערה..." />
        </Field>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={pending} className="flex-1 rounded-lg bg-yellow-600 py-2 text-sm font-bold text-white hover:bg-yellow-500 disabled:opacity-50 transition-colors">
            {pending ? "שומר..." : "הורד"}
          </button>
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
            ביטול
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Move / Return modal ──────────────────────────────────────────────────────

function MoveModal({
  item,
  fromLocation,
  currentQty,
  locations,
  onLocationsChange,
  onClose,
  onSuccess,
}: {
  item: TashItemData;
  fromLocation: string;
  currentQty: number;
  locations: SavedLocation[];
  onLocationsChange: (l: SavedLocation[]) => void;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [toLocation, setToLocation] = useState("");
  const isReturn = toLocation.trim() === YAMAH;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("itemId", item.id);
    fd.set("fromLocation", fromLocation);
    fd.set("toLocation", toLocation.trim());
    startTransition(async () => {
      try {
        await moveTashQuantityAction(fd);
        onSuccess();
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  return (
    <Modal title={`העברה / החזרה — ${item.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm">
          <span className="text-zinc-400">ממיקום: </span>
          <span className="font-medium text-zinc-100">{fromLocation}</span>
          <span className="text-zinc-400 mr-4">כמות: </span>
          <span className="font-medium text-zinc-100">{currentQty} {item.unit}</span>
        </div>

        <Field label="למיקום *">
          <div className="flex flex-col gap-2">
            <LocationCombobox
              name="toLocation"
              value={toLocation}
              onChange={setToLocation}
              locations={locations}
              onLocationsChange={onLocationsChange}
              placeholder="בחר או הקלד מיקום יעד..."
              excludeLocation={fromLocation}
              required
            />
            {fromLocation !== YAMAH && (
              <button
                type="button"
                onClick={() => setToLocation(YAMAH)}
                className="self-start rounded-lg border border-teal-700 bg-teal-900/30 px-3 py-1.5 text-xs font-bold text-teal-300 hover:bg-teal-900/50 transition-colors"
              >
                ⮐ החזר לימ״ח
              </button>
            )}
          </div>
        </Field>

        {isReturn && (
          <div className="rounded-lg border border-teal-800 bg-teal-900/20 px-3 py-2 text-xs text-teal-300">
            ✓ פריט יוחזר ל{YAMAH}
          </div>
        )}

        <Field label={`כמות להעברה (${item.unit})`}>
          <input className={inputCls} name="quantity" type="number" min="1" max={currentQty} placeholder="1" required />
        </Field>
        <Field label="הערות (אופציונלי)">
          <input className={inputCls} name="notes" placeholder="הערה..." />
        </Field>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={pending || !toLocation.trim()}
            className={`flex-1 rounded-lg py-2 text-sm font-bold text-white disabled:opacity-50 transition-colors ${
              isReturn ? "bg-teal-600 hover:bg-teal-500" : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {pending ? "מעביר..." : isReturn ? "החזר לימ״ח" : "העבר"}
          </button>
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
            ביטול
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Mark loss modal ──────────────────────────────────────────────────────────

function MarkLossModal({
  item,
  location,
  currentQty,
  onClose,
  onSuccess,
}: {
  item: TashItemData;
  location: string;
  currentQty: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("itemId", item.id);
    fd.set("location", location);
    startTransition(async () => {
      try {
        await markTashLossAction(fd);
        onSuccess();
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  return (
    <Modal title={`סימון סטטוס — ${item.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm">
          <span className="text-zinc-400">מיקום: </span>
          <span className="font-medium text-zinc-100">{location}</span>
          <span className="text-zinc-400 mr-4">כמות: </span>
          <span className="font-medium text-zinc-100">{currentQty} {item.unit}</span>
        </div>

        <Field label="סטטוס">
          <select className={inputCls} name="action" required>
            <option value="LOST">אבד</option>
            <option value="STOLEN">נגנב</option>
            <option value="DAMAGED">ניזוק / שומש</option>
          </select>
        </Field>

        <Field label={`כמות (${item.unit})`}>
          <input className={inputCls} name="quantity" type="number" min="1" max={currentQty} placeholder="1" required />
        </Field>

        <Field label="הערות (אופציונלי)">
          <input className={inputCls} name="notes" placeholder="פרטים נוספים..." />
        </Field>

        <div className="rounded-lg border border-orange-800 bg-orange-900/20 px-3 py-2 text-xs text-orange-300">
          ⚠️ הכמות תירשם כאבודה / גנובה / ניזוקה ותוסר מהמלאי.
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={pending} className="flex-1 rounded-lg bg-orange-600 py-2 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-50 transition-colors">
            {pending ? "שומר..." : "אשר"}
          </button>
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
            ביטול
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── History modal ────────────────────────────────────────────────────────────

function logTouchesLocation(log: TashLogData, loc: string | null | undefined): boolean {
  if (!loc) return true;
  return log.fromLocation === loc || log.toLocation === loc;
}

function HistoryModal({
  item,
  locationFilter,
  onClose,
  onSuccess,
}: {
  item: TashItemData;
  locationFilter?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const logs = useMemo(
    () =>
      locationFilter
        ? item.logs.filter((l) => logTouchesLocation(l, locationFilter))
        : item.logs,
    [item.logs, locationFilter]
  );

  function startEdit(log: TashLogData) {
    setEditingId(log.id);
    setEditNotes(log.notes ?? "");
    setError("");
  }

  function saveNotes(logId: string) {
    setError("");
    const fd = new FormData();
    fd.set("id", logId);
    fd.set("notes", editNotes);
    startTransition(async () => {
      try {
        await updateTashLogNotesAction(fd);
        setEditingId(null);
        onSuccess();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "שגיאה");
      }
    });
  }

  function confirmDelete(logId: string) {
    setError("");
    const fd = new FormData();
    fd.set("id", logId);
    startTransition(async () => {
      try {
        await deleteTashLogAction(fd);
        setDeleteId(null);
        onSuccess();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "שגיאה");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-zinc-50">היסטוריה — {item.name}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {logs.length} רשומות
              {locationFilter ? ` · מסונן: ${locationFilter}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-xl leading-none">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
          {logs.length === 0 ? (
            <p className="text-center text-sm text-zinc-500 py-8">אין רשומות (בסינון הנוכחי)</p>
          ) : (
            <div className="flex flex-col gap-2">
              {logs.map((log) => (
                <div key={log.id} className="rounded-xl border border-zinc-800 bg-zinc-800/40 p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ACTION_COLOR[log.action]}`}>
                      {ACTION_LABEL[log.action]}
                    </span>
                    <span className="text-xs text-zinc-500 shrink-0">{formatDate(log.createdAt)}</span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span className="text-zinc-300">
                      <span className="text-zinc-500">כמות: </span>
                      {log.quantity} {item.unit}
                    </span>
                    {log.fromLocation && (
                      <span className="text-zinc-300">
                        <span className="text-zinc-500">מ: </span>
                        {log.fromLocation}
                      </span>
                    )}
                    {log.toLocation && (
                      <span className="text-zinc-300">
                        <span className="text-zinc-500">אל: </span>
                        {log.toLocation}
                      </span>
                    )}
                  </div>

                  {editingId === log.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        className={`${inputCls} min-h-[72px] resize-y`}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="הערות..."
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => saveNotes(log.id)}
                          className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-900 hover:bg-white disabled:opacity-50"
                        >
                          שמור הערה
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-400"
                        >
                          ביטול
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {log.notes ? (
                        <p className="text-xs text-zinc-400 italic">{log.notes}</p>
                      ) : (
                        <p className="text-xs text-zinc-600">ללא הערה</p>
                      )}
                    </>
                  )}

                  <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-zinc-800/80">
                    <p className="text-xs text-zinc-600">{log.performedBy.name}</p>
                    {editingId !== log.id && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(log)}
                          className="rounded-md border border-zinc-600 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-800"
                        >
                          ערוך הערה
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(log.id)}
                          className="rounded-md border border-red-900/60 px-2 py-0.5 text-xs text-red-400 hover:bg-red-950/40"
                        >
                          מחק שורה
                        </button>
                      </div>
                    )}
                  </div>

                  {deleteId === log.id && (
                    <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-2 space-y-2">
                      <p className="text-xs text-red-200">
                        מחיקה תבטל את השפעת הרשומה על המלאי (הפוך לפעולה). להמשיך?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => confirmDelete(log.id)}
                          className="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
                        >
                          {pending ? "מבצע..." : "כן, מחק ובטל במלאי"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(null)}
                          className="rounded-lg border border-zinc-600 px-3 py-1 text-xs text-zinc-400"
                        >
                          ביטול
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Location row ─────────────────────────────────────────────────────────────

function LocationRow({
  inv,
  item,
  onMove,
  onDeduct,
  onMarkLoss,
}: {
  inv: TashInventoryData;
  item: TashItemData;
  onMove: () => void;
  onDeduct: () => void;
  onMarkLoss: () => void;
}) {
  const isYamah = inv.location === YAMAH;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/60 last:border-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isYamah ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-teal-900/30 border border-teal-800 px-2 py-0.5 text-xs font-semibold text-teal-300 shrink-0">
            🏭 {YAMAH}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-300 shrink-0 truncate max-w-[160px]">
            📍 {inv.location}
          </span>
        )}
      </div>

      <span className="text-sm font-semibold text-zinc-100 shrink-0 tabular-nums">
        {inv.quantity} <span className="text-xs text-zinc-500 font-normal">{item.unit}</span>
      </span>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onDeduct}
          title="הורד כמות"
          className="rounded-md px-2 py-1 text-xs text-yellow-400 hover:bg-yellow-900/30 transition-colors"
        >
          −
        </button>
        <button
          onClick={onMove}
          title={isYamah ? "הוצא ממחסן" : "העבר / החזר"}
          className="rounded-md px-2 py-1 text-xs text-blue-400 hover:bg-blue-900/30 transition-colors"
        >
          {isYamah ? "הוצא" : "הזז"}
        </button>
        {!isYamah && (
          <button
            onClick={onMove}
            title="החזר לימ״ח"
            className="rounded-md px-2 py-1 text-xs text-teal-400 hover:bg-teal-900/30 transition-colors font-semibold"
          >
            ⮐ ימ״ח
          </button>
        )}
        <button
          onClick={onMarkLoss}
          title="סמן כאבד/נגנב/ניזוק"
          className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-900/30 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Item card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  locationTab,
  onOpenModal,
}: {
  item: TashItemData;
  locationTab: string | null;
  onOpenModal: (modal: ModalState) => void;
}) {
  /** false = show per-location actions (default); true = fold detail rows */
  const [locationsCollapsed, setLocationsCollapsed] = useState(false);
  const total = totalQty(item);

  const invRows = useMemo(() => {
    if (!locationTab) return item.inventory;
    return item.inventory.filter((inv) => inv.location === locationTab);
  }, [item.inventory, locationTab]);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="flex items-start gap-2 px-4 py-3 sm:px-5 sm:py-4">
        <button
          type="button"
          aria-expanded={!locationsCollapsed}
          aria-label={locationsCollapsed ? "הצג מיקומים ופעולות" : "הסתר מיקומים"}
          onClick={() => setLocationsCollapsed((v) => !v)}
          className="mt-0.5 shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
        >
          <span className="text-sm tabular-nums">{locationsCollapsed ? "▼" : "▲"}</span>
        </button>

        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-bold text-zinc-50 text-base leading-tight">{item.name}</span>
                {item.description && (
                  <span className="text-xs text-zinc-500 truncate max-w-[280px]">{item.description}</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-zinc-500">{item.unit}</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    total > 0
                      ? "bg-zinc-800 text-zinc-200 border-zinc-700"
                      : "bg-zinc-900 text-zinc-600 border-zinc-800"
                  }`}
                >
                  סה״כ: {total}
                </span>
                {locationTab && (
                  <span className="text-xs text-teal-400 font-medium">
                    במיקום &quot;{locationTab}&quot;:{" "}
                    {item.inventory.find((i) => i.location === locationTab)?.quantity ?? 0}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onOpenModal({ type: "add-qty", item })}
                className="rounded-lg bg-emerald-900/30 border border-emerald-800 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-900/50 transition-colors"
                title="הוסף כמות"
              >
                + הוסף
              </button>
              <button
                type="button"
                onClick={() =>
                  onOpenModal({ type: "history", item, locationFilter: locationTab || undefined })
                }
                className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="היסטוריה"
              >
                📋 היסטוריה
              </button>
              <button
                type="button"
                onClick={() => onOpenModal({ type: "edit-item", item })}
                className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="ערוך פריט"
              >
                ✎ עריכה
              </button>
              <button
                type="button"
                onClick={() => onOpenModal({ type: "delete-item", item })}
                className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-red-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                title="מחק פריט"
              >
                🗑 מחיקה
              </button>
            </div>
          </div>

          {!locationsCollapsed && (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 overflow-hidden">
              {invRows.length === 0 ? (
                <div className="px-4 py-4 text-sm text-zinc-500 text-center">
                  {locationTab
                    ? `אין מלאי במיקום „${locationTab}”.`
                    : "אין מלאי — לחץ „+ הוסף”."}
                </div>
              ) : (
                invRows.map((inv) => (
                  <LocationRow
                    key={inv.id}
                    inv={inv}
                    item={item}
                    onMove={() =>
                      onOpenModal({
                        type: "move",
                        item,
                        fromLocation: inv.location,
                        currentQty: inv.quantity,
                      })
                    }
                    onDeduct={() =>
                      onOpenModal({
                        type: "deduct-qty",
                        item,
                        location: inv.location,
                        currentQty: inv.quantity,
                      })
                    }
                    onMarkLoss={() =>
                      onOpenModal({
                        type: "mark-loss",
                        item,
                        location: inv.location,
                        currentQty: inv.quantity,
                      })
                    }
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main TashPage component ──────────────────────────────────────────────────

export function TashPage({
  initialItems,
  initialLocations,
}: {
  initialItems: TashItemData[];
  initialLocations: SavedLocation[];
}) {
  const [items] = useState<TashItemData[]>(initialItems);
  const [locations, setLocations] = useState<SavedLocation[]>(initialLocations);
  const [modal, setModal] = useState<ModalState>(null);
  const [search, setSearch] = useState("");
  /** null = כל הפריטים; otherwise filter by inventory location */
  const [locationTab, setLocationTab] = useState<string | null>(null);

  const locationTabNames = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.inventory.forEach((inv) => set.add(inv.location)));
    locations.forEach((l) => set.add(l.name));
    const arr = Array.from(set);
    arr.sort((a, b) => {
      if (a === YAMAH) return -1;
      if (b === YAMAH) return 1;
      return a.localeCompare(b, "he");
    });
    return arr;
  }, [items, locations]);

  const filtered = search.trim()
    ? items.filter((i) => i.name.includes(search) || (i.description ?? "").includes(search))
    : items;

  const list = useMemo(() => {
    if (!locationTab) return filtered;
    return filtered.filter((i) =>
      i.inventory.some((inv) => inv.location === locationTab && inv.quantity > 0)
    );
  }, [filtered, locationTab]);

  function closeModal() {
    setModal(null);
  }

  // Use full page reload so the server component re-fetches fresh data (useState needs remount)
  function handleSuccess() {
    window.location.reload();
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Location tabs — see everything at a place */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-zinc-500">מיקום</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" dir="rtl">
            <button
              type="button"
              onClick={() => setLocationTab(null)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold border transition-colors ${
                locationTab === null
                  ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                  : "bg-zinc-900/80 text-zinc-300 border-zinc-700 hover:border-zinc-500"
              }`}
            >
              כל הפריטים
            </button>
            {locationTabNames.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setLocationTab(loc)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold border transition-colors max-w-[220px] truncate ${
                  locationTab === loc
                    ? "bg-teal-900/50 text-teal-100 border-teal-600"
                    : "bg-zinc-900/80 text-zinc-300 border-zinc-700 hover:border-zinc-500"
                }`}
                title={loc}
              >
                {loc === YAMAH ? `🏭 ${loc}` : `📍 ${loc}`}
              </button>
            ))}
          </div>
          {locationTab && (
            <p className="text-xs text-zinc-400">
              מציגים פריטים עם מלאי ב־„{locationTab}”. פתחו היסטוריה לפריט כדי לראות פעולות הקשורות למיקום (מסונן).
            </p>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <input
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="חפש פריט..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setModal({ type: "add-item" })}
            className="shrink-0 rounded-xl bg-zinc-100 px-5 py-2.5 text-sm font-bold text-zinc-900 hover:bg-white transition-colors"
          >
            + הוסף פריט
          </button>
        </div>

        {/* Stats bar */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-3 flex flex-wrap gap-4 text-sm">
          <span className="text-zinc-400">
            <span className="font-semibold text-zinc-100">{items.length}</span> סוגי פריטים
          </span>
          <span className="text-zinc-400">
            <span className="font-semibold text-zinc-100">
              {items.reduce((s, i) => s + totalQty(i), 0)}
            </span>{" "}
            יחידות בסה״כ
          </span>
          <span className="text-zinc-400">
            <span className="font-semibold text-zinc-100">
              {new Set(items.flatMap((i) => i.inventory.map((inv) => inv.location))).size}
            </span>{" "}
            מיקומים פעילים
          </span>
        </div>

        {/* Items list */}
        {list.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center">
            <p className="text-zinc-400 text-sm">
              {locationTab
                ? "אין פריטים עם מלאי במיקום שנבחר."
                : search
                  ? "לא נמצאו פריטים התואמים את החיפוש."
                  : "אין פריטים עדיין. לחץ על ״+ הוסף פריט״ להתחיל."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {list.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                locationTab={locationTab}
                onOpenModal={setModal}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal?.type === "add-item" && (
        <ItemFormModal mode="add" onClose={closeModal} onSuccess={handleSuccess} />
      )}
      {modal?.type === "edit-item" && (
        <ItemFormModal mode="edit" item={modal.item} onClose={closeModal} onSuccess={handleSuccess} />
      )}
      {modal?.type === "delete-item" && (
        <DeleteModal item={modal.item} onClose={closeModal} onSuccess={handleSuccess} />
      )}
      {modal?.type === "add-qty" && (
        <AddQtyModal
          item={modal.item}
          locations={locations}
          onLocationsChange={setLocations}
          onClose={closeModal}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.type === "deduct-qty" && (
        <DeductQtyModal
          item={modal.item}
          location={modal.location}
          currentQty={modal.currentQty}
          onClose={closeModal}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.type === "move" && (
        <MoveModal
          item={modal.item}
          fromLocation={modal.fromLocation}
          currentQty={modal.currentQty}
          locations={locations}
          onLocationsChange={setLocations}
          onClose={closeModal}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.type === "mark-loss" && (
        <MarkLossModal
          item={modal.item}
          location={modal.location}
          currentQty={modal.currentQty}
          onClose={closeModal}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.type === "history" && (
        <HistoryModal
          item={modal.item}
          locationFilter={modal.locationFilter}
          onClose={closeModal}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
