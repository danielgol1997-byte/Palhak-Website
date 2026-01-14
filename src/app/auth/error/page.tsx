function errorToHebrew(code: string | null): string {
  switch (code) {
    case "EmailSignin":
      return "לא ניתן לשלוח קישור התחברות. נסה שוב מאוחר יותר.";
    case "AccessDenied":
      return "אין הרשאה להתחבר.";
    case "Verification":
      return "הקישור לא תקין או שפג תוקפו. נסה לשלוח קישור חדש.";
    default:
      return "אירעה שגיאה. נסה שוב.";
  }
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const message = errorToHebrew(params.error ?? null);

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950">
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-10">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h1 className="text-2xl font-semibold">שגיאה בהתחברות</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-700">{message}</p>
          <a
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white"
            href="/auth"
          >
            חזרה להתחברות
          </a>
        </section>
      </main>
    </div>
  );
}


