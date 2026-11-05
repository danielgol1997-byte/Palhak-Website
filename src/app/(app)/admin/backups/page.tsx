import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { isPrivilegedOperator } from "@/lib/rbac";
import { blobConfigured, listBackups, RETENTION } from "@/lib/backup";
import { BackupsPanel } from "./BackupsPanel";

export const dynamic = "force-dynamic";

export default async function BackupsPage() {
  const session = await requireSession();
  if (!isPrivilegedOperator(session.user.role)) redirect("/admin");

  let backups: Awaited<ReturnType<typeof listBackups>> = [];
  let setupError: string | null = null;
  try {
    backups = await listBackups(200);
  } catch (e) {
    // Typically: the DatabaseBackup table does not exist yet (migration 0005 not applied)
    setupError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">גיבויים</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          גיבוי מלא של כל הנתונים נשמר אוטומטית כל יום. אפשר גם ליצור גיבוי ידני, לבדוק את תקינותו ולהוריד אותו למחשב.
        </p>
      </section>

      {setupError && (
        <section className="rounded-2xl border border-amber-700/50 bg-amber-950/30 p-5 text-sm text-amber-100">
          <div className="font-bold">טבלת הגיבויים עדיין לא קיימת במסד הנתונים.</div>
          <p className="mt-1 leading-6">
            יש להריץ פעם אחת מהמחשב: <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono">npx prisma migrate deploy</code> ואז לרענן. עד אז
            הגיבוי האוטומטי והידני לא יכולים לרוץ.
          </p>
          <p className="mt-2 break-all font-mono text-[11px] text-amber-200/70">{setupError.split("\n")[0]}</p>
        </section>
      )}

      <BackupsPanel
        initialBackups={backups}
        blobConfigured={blobConfigured()}
        cronSecretConfigured={Boolean(process.env.CRON_SECRET)}
        retentionDays={Object.fromEntries(Object.entries(RETENTION).map(([k, v]) => [k, v.days]))}
      />
    </div>
  );
}
