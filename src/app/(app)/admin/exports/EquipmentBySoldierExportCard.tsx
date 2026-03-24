"use client";

import { useId, useState } from "react";

function IconExcel() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 2v5h5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 10l3 4-3 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M13 10l-3 4 3 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconSheets() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 2v5h5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 12h8M8 16h8M8 8h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconCsv() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 2v5h5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 11h8M8 14h8M8 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const SWITCH_TOOLTIP =
  "כבוי: ב־Excel/Sheets — גליון נפרד לכל חייל עם פירוט שורות (פריט, כמות, סטטוס…). דלוק: קובץ אחד — כל שורה חייל, עמודות רק לפריטים שמישהו באמת מחזיק; בתא מופיעה הכמות או ריק אם אין.";

export function EquipmentBySoldierExportCard() {
  const [matrix, setMatrix] = useState(false);
  const switchId = useId();
  const qs = matrix ? "?layout=matrix" : "";

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
      <div className="flex flex-col gap-5">
        <div>
          <div className="text-lg font-bold text-zinc-50">ציוד (לפי חייל)</div>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
            מייצא את כל הציוד המוקצה למשתמשים פעילים. בחרו אם הקובץ יהיה{" "}
            <span className="text-zinc-300">מפוצל לגליון לכל חייל</span> (פירוט מלא לכל פריט) או{" "}
            <span className="text-zinc-300">גליון/קובץ אחד במבנה מטריצה</span>: שורה לכל חייל, עמודה לכל
            סוג ציוד — רק פריטים שמופיעים לפחות אצל מישהו אחד. בתא: הכמות המוקצית, או ריק אם אין.
          </p>
        </div>

        <div
          className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          title={SWITCH_TOOLTIP}
        >
          <div className="flex flex-col gap-0.5">
            <span id={`${switchId}-label`} className="text-sm font-semibold text-zinc-200">
              מבנה הקובץ
            </span>
            <span className="text-xs text-zinc-500">רחפו כאן או על המתג לתיאור מלא</span>
          </div>
          <div className="flex items-center gap-3" dir="rtl">
            <span
              className={`text-sm whitespace-nowrap transition-colors ${!matrix ? "font-bold text-emerald-400" : "text-zinc-500"}`}
            >
              גליון לכל חייל
            </span>
            <button
              id={switchId}
              type="button"
              role="switch"
              aria-checked={matrix}
              aria-labelledby={`${switchId}-label`}
              title={SWITCH_TOOLTIP}
              onClick={() => setMatrix((v) => !v)}
              className={`relative h-8 w-[3.25rem] shrink-0 rounded-full border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                matrix ? "border-emerald-500/60 bg-emerald-950/50" : "border-zinc-600 bg-zinc-800"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-zinc-100 shadow transition-all duration-200 ease-out ${
                  matrix ? "left-0.5 right-auto" : "right-0.5 left-auto"
                }`}
                aria-hidden
              />
            </button>
            <span
              className={`text-sm whitespace-nowrap transition-colors ${matrix ? "font-bold text-emerald-400" : "text-zinc-500"}`}
            >
              גליון אחד (מטריצה)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/export/equipment-by-soldier/excel${qs}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-bold text-zinc-100 transition-all hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98]"
            title="Excel"
          >
            <IconExcel />
            Excel
          </a>
          <a
            href={`/api/export/equipment-by-soldier/sheets${qs}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-bold text-zinc-100 transition-all hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98]"
            title="Google Sheets"
          >
            <IconSheets />
            Sheets
          </a>
          <a
            href={`/api/export/equipment-by-soldier/csv${qs}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-bold text-zinc-100 transition-all hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98]"
            title="CSV"
          >
            <IconCsv />
            CSV
          </a>
        </div>
      </div>
    </div>
  );
}
