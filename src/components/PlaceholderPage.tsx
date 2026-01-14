// Temporarily disable complex table pages to make the app work
// These will be converted to simpler card layouts

export default function PlaceholderPage() {
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">בקרוב</h1>
        <p className="mt-2 text-sm text-zinc-700">
          עמוד זה בהכנה. נא להשתמש ב-Prisma Studio לניהול נתונים כרגע.
        </p>
        <a
          href="/"
          className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white"
        >
          חזרה לדף הבית
        </a>
      </section>
    </div>
  );
}





