import { BackButton } from "@/components/BackButton";

export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-sm">
        <h1 className="text-3xl font-black text-zinc-50 tracking-tight">החזרת ציוד</h1>
        <p className="mt-2 text-zinc-400">
          כאן תוכל להחזיר ציוד לימ״ח. עמוד זה נמצא כרגע בהקמה.
        </p>
      </section>

      <div className="grid gap-6">
        <div className="py-20 text-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/50">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-2xl bg-zinc-900 flex items-center justify-center text-zinc-700 border border-zinc-800">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
              </svg>
            </div>
          </div>
          <h2 className="text-xl font-bold text-zinc-50 mb-2">בקרוב מאוד</h2>
          <p className="text-zinc-500 max-w-sm mx-auto">מערכת החזרת הציוד עוברת שדרוג ותהיה זמינה בקרוב לכלל המשתמשים.</p>
        </div>
      </div>
    </div>
  );
}

