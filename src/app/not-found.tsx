export default function NotFound() {
  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-50 flex items-center justify-center p-4">
      <main className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 mb-6 border border-zinc-700">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01" /></svg>
        </div>
        <h1 className="text-3xl font-bold mb-4">הדף לא נמצא</h1>
        <p className="text-zinc-400 mb-10 leading-relaxed">
          ייתכן שהקישור שגוי או שהדף הוסר. בוא נחזיר אותך למקום מבטחים.
        </p>
        <a
          href="/"
          className="h-16 w-full inline-flex items-center justify-center rounded-2xl bg-zinc-50 px-6 text-lg font-bold text-zinc-950 shadow-xl shadow-zinc-100/5 transition-all hover:bg-zinc-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
        >
          חזרה לדף הבית
        </a>
      </main>
    </div>
  );
}
