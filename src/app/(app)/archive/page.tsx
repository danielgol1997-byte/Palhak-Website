export const dynamic = "force-dynamic";

export default async function PlaceholderPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">בקרוב</h1>
        <p className="mt-2 text-sm text-zinc-400">
          עמוד זה בהכנה. כרגע פועלים רק העמודים הבאים:
        </p>
        <ul className="mt-4 list-disc list-inside text-sm text-zinc-400 space-y-1">
          <li>מחלקות</li>
          <li>פריטים</li>
        </ul>
        <a
          href="/"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-zinc-50 px-6 text-sm font-bold text-zinc-950 shadow-lg shadow-zinc-100/5 transition-all hover:bg-zinc-200 cursor-pointer"
        >
          חזרה לדף הבית
        </a>
      </section>
    </div>
  );
}
