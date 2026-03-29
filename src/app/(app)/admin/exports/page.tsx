import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { EquipmentBySoldierExportCard } from "./EquipmentBySoldierExportCard";

export const dynamic = "force-dynamic";

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

function ExportCard({
  title,
  desc,
  hrefExcel,
  hrefSheets,
  hrefCsv,
}: {
  title: string;
  desc: string;
  hrefExcel: string;
  hrefSheets: string;
  hrefCsv: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-lg font-bold text-zinc-50">{title}</div>
          <div className="mt-1 text-sm text-zinc-400 leading-6">{desc}</div>
        </div>
        <div className="flex gap-2">
          <a
            href={hrefExcel}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-bold text-zinc-100 transition-all hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98]"
            title="Excel"
          >
            <IconExcel />
            Excel
          </a>
          <a
            href={hrefSheets}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-bold text-zinc-100 transition-all hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98]"
            title="Google Sheets"
          >
            <IconSheets />
            Sheets
          </a>
          <a
            href={hrefCsv}
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

export default async function AdminExportsPage() {
  await requireRole(Role.ADMIN);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-50">ייצוא נתונים</h1>
            <p className="mt-2 text-sm text-zinc-400">
              הורדה ל-Excel / Google Sheets / CSV לפי סוג הנתונים. כל הייצוא זמין למנהלים בלבד.
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 px-5 text-sm font-bold text-zinc-100 transition-all hover:bg-zinc-800"
          >
            חזרה לניהול
          </Link>
        </div>
      </section>

      <section className="grid gap-4">
        <ExportCard
          title="Guns and Sights"
          desc="קובץ אחד עם 2 גליונות: נשקים וצלמים. עמודות מסוננות לפי כותרת."
          hrefExcel="/api/export/weapons-and-sights/excel"
          hrefSheets="/api/export/weapons-and-sights/sheets"
          hrefCsv="/api/export/weapons-and-sights/csv"
        />

        <EquipmentBySoldierExportCard />

        <ExportCard
          title="מלאי"
          desc="כל נתוני המלאי מהמחסן (כולל פילוחים). עמודות מסוננות לפי כותרת."
          hrefExcel="/api/export/inventory/excel"
          hrefSheets="/api/export/inventory/sheets"
          hrefCsv="/api/export/inventory/csv"
        />

        <ExportCard
          title="קרטונים (מטריצה)"
          desc="גליון אחד: מימין עמודת סיכום (סה״כ בקרטונים וחסר לכל פריט בתבנית) + טבלה מסודרת בגриד. מוצגים רק חיילים עם רשומת קרטון (גם ריק). הערת מעבר על כותרת הסיכום מסבירה מי לא נספר. מיון וצבעי מילוי כמו במסך הקרטונים."
          hrefExcel="/api/export/boxes/excel"
          hrefSheets="/api/export/boxes/sheets"
          hrefCsv="/api/export/boxes/csv"
        />

        <ExportCard
          title="משתמשים"
          desc="רשימת כל המשתמשים הפעילים + פרטי הרשמה (שם, מייל, טלפון, מספר אישי, מחלקות/תפקידים, וכו׳)."
          hrefExcel="/api/export/users/excel"
          hrefSheets="/api/export/users/sheets"
          hrefCsv="/api/export/users/csv"
        />
      </section>
    </div>
  );
}


