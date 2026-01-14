"use client";

import { useMemo, useState } from "react";
import { createTransferAction } from "./actions";

type UserOption = { id: string; name: string };
type ItemOption = { id: string; name: string; categoryName: string };
type UnitTemplateOption = {
  id: string;
  name: string;
  items: Array<{ equipmentItemId: string; quantityRequired: number; itemName: string; categoryName: string }>;
};

type TransferItemDraft = { equipmentItemId: string; quantity: number; unitTemplateId: string | null };

export function TransferCreateForm({
  users,
  items,
  unitTemplates,
}: {
  users: UserOption[];
  items: ItemOption[];
  unitTemplates: UnitTemplateOption[];
}) {
  const [toUserId, setToUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [unitId, setUnitId] = useState("");
  const [unitCount, setUnitCount] = useState(1);
  const [draft, setDraft] = useState<TransferItemDraft[]>([]);

  const filteredUsers = useMemo(() => {
    const s = userSearch.trim();
    if (!s) return users;
    return users.filter((u) => u.name.includes(s));
  }, [users, userSearch]);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold">העברת ציוד</h2>

      <div className="mt-3 grid gap-3">
        <div>
          <label className="text-sm font-semibold">חיפוש מקבל</label>
          <input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm"
            placeholder="הקלד שם"
          />
        </div>
        <div>
          <label className="text-sm font-semibold">מקבל</label>
          <select
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
            required
          >
            <option value="">בחר מקבל</option>
            {filteredUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-200 p-4">
        <div className="text-base font-semibold">הוספה לפי יחידה</div>
        <div className="mt-3 grid gap-3">
          <div>
            <label className="text-sm font-semibold">יחידה</label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
            >
              <option value="">בחר יחידה</option>
              {unitTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold">כמות יחידות</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={unitCount}
              onChange={(e) => setUnitCount(Math.max(1, Number(e.target.value || 1)))}
              className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm"
            />
          </div>
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold"
            disabled={!unitId}
            onClick={() => {
              const tpl = unitTemplates.find((t) => t.id === unitId);
              if (!tpl) return;
              const additions = tpl.items.map((i) => ({
                equipmentItemId: i.equipmentItemId,
                quantity: i.quantityRequired * unitCount,
                unitTemplateId: tpl.id,
              }));
              setDraft((prev) => [...prev, ...additions]);
              setUnitId("");
              setUnitCount(1);
            }}
          >
            הוסף יחידה
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-200 p-4">
        <div className="text-base font-semibold">הוספה ידנית</div>
        <div className="mt-3 grid gap-3">
          <div>
            <label className="text-sm font-semibold">פריט</label>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
            >
              <option value="">בחר פריט</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.categoryName} · {it.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold">כמות</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
              className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm"
            />
          </div>
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold"
            disabled={!itemId}
            onClick={() => {
              setDraft((prev) => [
                ...prev,
                { equipmentItemId: itemId, quantity: qty, unitTemplateId: null },
              ]);
              setItemId("");
              setQty(1);
            }}
          >
            הוסף פריט
          </button>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-base font-semibold">רשימת פריטים להעברה</div>
        <div className="mt-3 flex flex-col gap-2">
          {draft.map((d, idx) => {
            const it = items.find((x) => x.id === d.equipmentItemId);
            const tpl = d.unitTemplateId
              ? unitTemplates.find((t) => t.id === d.unitTemplateId)
              : null;
            return (
              <div
                key={`${d.equipmentItemId}:${idx}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {it ? `${it.categoryName} · ${it.name}` : d.equipmentItemId}
                  </div>
                  <div className="truncate text-xs text-zinc-600">
                    {tpl ? `יחידה: ${tpl.name}` : "פריט ידני"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-semibold">× {d.quantity}</div>
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold"
                    onClick={() => setDraft((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    הסר
                  </button>
                </div>
              </div>
            );
          })}
          {draft.length === 0 ? (
            <div className="text-sm text-zinc-700">אין פריטים.</div>
          ) : null}
        </div>
      </div>

      <form action={createTransferAction} className="mt-6">
        <input type="hidden" name="toUserId" value={toUserId} />
        <input type="hidden" name="itemsJson" value={JSON.stringify(draft)} />
        <button
          type="submit"
          disabled={!toUserId || draft.length === 0}
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          שליחה לאישור
        </button>
      </form>
    </section>
  );
}


