export default function VerifyRequestPage() {
  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950">
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-10">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h1 className="text-2xl font-semibold">התחברות</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            שיטת ההתחברות באמצעות קישור למייל אינה בשימוש. עבור לעמוד ההתחברות והשתמש ב־Google.
          </p>
          <a
            href="/auth"
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white"
          >
            חזרה להתחברות
          </a>
        </section>
      </main>
    </div>
  );
}


