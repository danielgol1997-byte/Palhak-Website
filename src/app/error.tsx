"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-50 flex items-center justify-center p-4">
      <main className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-950/30 text-red-500 mb-6 border border-red-900/50">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" /></svg>
        </div>
        <h1 className="text-3xl font-bold mb-4">משהו השתבש</h1>
        <p className="text-zinc-400 mb-10 leading-relaxed">
          אירעה שגיאה לא צפויה במערכת. אל דאגה, ניתן לנסות שוב או לחזור לדף הבית.
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={reset}
            className="h-16 w-full inline-flex items-center justify-center rounded-2xl bg-zinc-50 px-6 text-lg font-bold text-zinc-950 shadow-xl shadow-zinc-100/5 transition-all hover:bg-zinc-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            נסה שוב
          </button>
          <a
            href="/"
            className="h-14 w-full inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 px-6 text-base font-bold text-zinc-100 transition-all hover:bg-zinc-700 cursor-pointer"
          >
            חזרה לדף הבית
          </a>
        </div>
      </main>
    </div>
  );
}
