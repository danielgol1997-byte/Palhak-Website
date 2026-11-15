import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUseAgent } from "@/lib/agent/access";
import { AGENT_LIMITS, agentConfigured, agentModel } from "@/lib/agent/engine";
import { listRecentRuns, type RunView } from "@/lib/agent/runs";
import { AgentHistory } from "./AgentHistory";

export const dynamic = "force-dynamic";

/** USD per million tokens (input, output), for the monthly cost estimate. */
const PRICES: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
};

type Usage = { model: string; turns: number; input: number; output: number; cached: number };

async function loadOverview(): Promise<{ runs: RunView[]; usage: Usage[]; setupError: string | null }> {
  try {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [runs, grouped] = await Promise.all([
      listRecentRuns(60),
      prisma.agentTurn.groupBy({
        by: ["model"],
        where: { createdAt: { gt: since } },
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, cacheTokens: true },
      }),
    ]);
    const usage = grouped.map((g) => ({
      model: g.model,
      turns: g._count._all,
      input: g._sum.inputTokens ?? 0,
      output: g._sum.outputTokens ?? 0,
      cached: g._sum.cacheTokens ?? 0,
    }));
    return { runs, usage, setupError: null };
  } catch (e) {
    // Typically: migration 0006 has not been applied yet.
    return { runs: [], usage: [], setupError: e instanceof Error ? e.message : String(e) };
  }
}

export default async function AgentPage() {
  const session = await requireSession();
  if (!canUseAgent(session.user.role)) redirect("/admin");

  const { runs, usage, setupError } = await loadOverview();

  const turns = usage.reduce((s, u) => s + u.turns, 0);
  const cost = usage.reduce((s, u) => {
    const [inPrice, outPrice] = PRICES[u.model] ?? PRICES["claude-sonnet-5-5"];
    // Tokens read from the prompt cache cost a tenth of the input price.
    return s + (u.input * inPrice + u.cached * inPrice * 0.1 + u.output * outPrice) / 1_000_000;
  }, 0);
  const configured = agentConfigured();

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-zinc-50">סוכן AI</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          הסוכן נפתח מכפתור הניצוץ בסרגל העליון. הוא מחפש ועונה מיד, ומבצע שינויים רק אחרי שמנהל העל אישר את התוכנית. כאן מופיעות כל התוכניות
          שהוכנו, עם הקבלה של מה שבוצע בפועל.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <dt className="text-xs text-zinc-500">מצב</dt>
            <dd className={`mt-0.5 font-bold ${configured ? "text-emerald-500" : "text-amber-500"}`}>{configured ? "פעיל" : "חסר מפתח API"}</dd>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <dt className="text-xs text-zinc-500">מודל</dt>
            <dd className="mt-0.5 break-all font-mono text-[13px] font-bold text-zinc-100" dir="ltr">
              {agentModel()}
            </dd>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <dt className="text-xs text-zinc-500">פניות ב-30 הימים האחרונים</dt>
            <dd className="mt-0.5 font-bold text-zinc-100">{turns.toLocaleString("he-IL")}</dd>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <dt className="text-xs text-zinc-500">עלות משוערת (30 יום)</dt>
            <dd className="mt-0.5 font-bold text-zinc-100" dir="ltr">
              ${cost.toFixed(cost < 1 ? 3 : 2)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-zinc-500">
          מגבלת שימוש לכל מנהל: {AGENT_LIMITS.perMinute} פניות בדקה, {AGENT_LIMITS.perDay} ביום.
        </p>
      </section>

      {!configured && (
        <section className="rounded-2xl border border-amber-700 bg-amber-950 p-5 text-sm leading-6 text-amber-100">
          <div className="font-bold">הסוכן עדיין לא מחובר למודל.</div>
          <p className="mt-1">
            יש להוסיף את המשתנה <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono">ANTHROPIC_API_KEY</code> בהגדרות הסביבה של Vercel ולפרוס מחדש. הפרטים בקובץ AGENT.md.
          </p>
        </section>
      )}

      {setupError && (
        <section className="rounded-2xl border border-amber-700 bg-amber-950 p-5 text-sm text-amber-100">
          <div className="font-bold">טבלאות הסוכן עדיין לא קיימות במסד הנתונים.</div>
          <p className="mt-1 leading-6">
            יש להריץ פעם אחת מהמחשב: <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono">npx prisma migrate deploy</code> ואז לרענן.
          </p>
          <p className="mt-2 break-all font-mono text-[11px] text-amber-200/70">{setupError.split("\n")[0]}</p>
        </section>
      )}

      <AgentHistory runs={runs} />
    </div>
  );
}
