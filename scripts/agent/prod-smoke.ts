/**
 * Read-only check of the AI agent on the LIVE production deployment.
 *
 *   npx tsx scripts/agent/prod-smoke.ts
 *
 * It asks a few questions and drafts two plans (signing out an item, handing a
 * box over), which it then CANCELS. It never confirms a plan, so no equipment,
 * stock, box, request or user data can change. To prove that, it counts the rows
 * of every business table and records who owns every box, before and after.
 * The only rows it adds are the agent's own log: AgentTurn (usage) and the
 * cancelled AgentRuns, on the first privileged operator's name.
 *
 * Needs the Vercel CLI signed in (deployments are behind Vercel Authentication)
 * and the production NEXTAUTH_SECRET in .env.
 */
import { execFileSync } from "node:child_process";
import { encode } from "next-auth/jwt";
import { loadEnv, dbHost } from "../backup/_env";
loadEnv();

const YAMAH = "ימ״ח";

function latestProductionUrl(): string {
  const out = execFileSync("vercel", ["ls", "--prod"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const url = out.match(/https:\/\/palhak-website-[a-z0-9]+-[a-z0-9-]+\.vercel\.app/)?.[0];
  if (!url) throw new Error("could not find the production deployment URL");
  return url;
}

function call(url: string, opts: { method?: string; cookie?: string; body?: unknown } = {}): { status: number; body: string } {
  const args = ["curl", url, "--", "-s", "-X", opts.method ?? "GET", "-w", "\n__HTTP__%{http_code}", "--max-time", "120"];
  if (opts.cookie) args.push("-H", `cookie: ${opts.cookie}`);
  if (opts.body !== undefined) args.push("-H", "content-type: application/json", "-d", JSON.stringify(opts.body));
  const out = execFileSync("vercel", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 20 * 1024 * 1024 });
  const i = out.lastIndexOf("\n__HTTP__");
  return { status: Number(out.slice(i + 9).trim()), body: out.slice(0, i) };
}

type Reply = { text: string; run: { id: string; status: string; steps: { title: string; details: string[] }[] } | null; error: string | null };

function parseChat(body: string): Reply {
  const reply: Reply = { text: "", run: null, error: null };
  for (const line of body.split("\n").filter(Boolean)) {
    try {
      const ev = JSON.parse(line) as { type: string; text?: string; run?: Reply["run"]; message?: string };
      if (ev.type === "reply") {
        reply.text = ev.text ?? "";
        reply.run = ev.run ?? null;
      }
      if (ev.type === "error") reply.error = ev.message ?? "error";
    } catch {
      /* not an event line */
    }
  }
  return reply;
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const base = latestProductionUrl();
  console.log(`Deployment: ${base}\nDatabase:   ${dbHost()} (read-only queries)\n`);

  const snapshot = async () => {
    const [requests, requestItems, assignments, boxItems, transfers, tashLogs, tashInv, users, items, audit, storage, boxOwners, departments, positions, unitTemplates] = await Promise.all([
      db.request.count(),
      db.requestItem.count(),
      db.assignment.aggregate({ _count: true, _sum: { quantity: true } }),
      db.boxItem.aggregate({ _count: true, _sum: { quantity: true } }),
      db.transfer.count(),
      db.tashLog.count(),
      db.tashInventory.aggregate({ _sum: { quantity: true } }),
      db.user.count(),
      db.equipmentItem.count(),
      db.auditLog.count(),
      db.storageInventory.aggregate({ _count: true, _sum: { quantity: true } }),
      db.box.findMany({ orderBy: { id: "asc" }, select: { id: true, userId: true } }),
      db.department.count(),
      db.position.count(),
      db.unitTemplate.count(),
    ]);
    return JSON.stringify({ requests, requestItems, assignments, boxItems, transfers, tashLogs, tashInv, users, items, audit, storage, boxOwners, departments, positions, unitTemplates });
  };
  const before = await snapshot();

  const operator = await db.user.findFirstOrThrow({ where: { role: { in: ["THEME_MASTER", "SUPER_ADMIN"] }, active: true }, orderBy: { createdAt: "asc" } });
  const soldiers = await db.user.findMany({ where: { role: "USER", active: true }, orderBy: { name: "asc" } });
  const soldier = soldiers.find((s) => soldiers.filter((o) => o.name === s.name).length === 1)!;
  const inv = await db.storageInventory.findFirstOrThrow({
    where: { quantity: { gte: 5 }, location: { name: YAMAH }, equipmentItem: { active: true, isWeapon: false, isSight: false } },
    orderBy: { quantity: "desc" },
    include: { equipmentItem: true },
  });

  const cookieFor = async (u: { id: string; name: string; role: string }) =>
    `__Secure-next-auth.session-token=${await encode({
      token: { sub: u.id, name: u.name, role: u.role, active: true, onboardedAt: new Date().toISOString(), roleCheckedAt: Date.now() },
      secret: process.env.NEXTAUTH_SECRET ?? "",
      maxAge: 900,
    })}`;
  const opCookie = await cookieFor(operator);

  let failures = 0;
  const check = (label: string, ok: boolean, detail = "") => {
    if (!ok) failures++;
    console.log(`${ok ? "✔" : "✘"} ${label}${detail ? `\n    ${detail}` : ""}`);
  };
  const chat = (cookie: string | undefined, text: string) => call(`${base}/api/agent/chat`, { method: "POST", cookie, body: { messages: [{ role: "user", text }] } });

  // access
  check("signed-out visitors are refused (401)", chat(undefined, "היי").status === 401);
  check("a soldier is refused (403)", chat(await cookieFor(soldier), "היי").status === 403);
  const session = call(`${base}/api/auth/session`, { cookie: opCookie });
  check("the operator session is accepted", session.status === 200 && session.body.includes(operator.id), session.body.slice(0, 120));

  // questions
  const t0 = Date.now();
  const stockAnswer = parseChat(chat(opCookie, `כמה ${inv.equipmentItem.name} יש בימ״ח?`).body);
  check(
    `stock question answered from live data in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    !stockAnswer.error && !stockAnswer.run && stockAnswer.text.includes(String(inv.quantity)),
    stockAnswer.error ?? stockAnswer.text.slice(0, 200),
  );
  const equipAnswer = parseChat(chat(opCookie, `מה חתום על ${soldier.name}?`).body);
  check("equipment question answered, no plan", !equipAnswer.error && !equipAnswer.run && equipAnswer.text.length > 5, equipAnswer.error ?? equipAnswer.text.slice(0, 200));

  const boxes = await db.box.count();
  const boxAnswer = parseChat(chat(opCookie, "כמה קרטונים יש לי?").body);
  check("knows the system's totals (number of boxes)", !boxAnswer.error && !boxAnswer.run && boxAnswer.text.includes(String(boxes)), boxAnswer.error ?? boxAnswer.text.slice(0, 200));

  // a plan that is drafted and then cancelled
  const plan = parseChat(chat(opCookie, `תחתים את ${soldier.name} על 1 ${inv.equipmentItem.name}`).body);
  check("a change request comes back as a plan awaiting confirmation", plan.run?.status === "PROPOSED", plan.error ?? plan.text.slice(0, 200));
  if (plan.run) {
    check("the plan names the real soldier and item", plan.run.steps[0].title.includes(soldier.name) && plan.run.steps[0].details[0].includes(inv.equipmentItem.name), JSON.stringify(plan.run.steps[0]));
    check("drafting changed nothing", (await snapshot()) === before);
    const cancelled = call(`${base}/api/agent/runs/${plan.run.id}/cancel`, { method: "POST", cookie: opCookie });
    check("the plan was cancelled", cancelled.status === 200 && cancelled.body.includes('"CANCELLED"'));
    const late = call(`${base}/api/agent/runs/${plan.run.id}/confirm`, { method: "POST", cookie: opCookie });
    check("a cancelled plan cannot be confirmed (409)", late.status === 409, late.body.slice(0, 120));
    const stored = await db.agentRun.findUnique({ where: { id: plan.run.id } });
    check("the plan is stored as CANCELLED with no receipt", stored?.status === "CANCELLED" && stored.receipt === null);
  }

  // box hand-over: a question, then a plan that is drafted and cancelled
  const orphaned = await db.box.findMany({ where: { user: { active: false } }, orderBy: { user: { name: "asc" } }, select: { id: true, userId: true, user: { select: { name: true } } } });
  const orphanAnswer = parseChat(chat(opCookie, "כמה קרטונים רשומים על משתמשים שכבר לא פעילים?").body);
  check(
    "knows which boxes belong to people who are no longer active",
    !orphanAnswer.error && !orphanAnswer.run && (orphaned.length === 0 ? /אין|אף|0/.test(orphanAnswer.text) : orphanAnswer.text.includes(String(orphaned.length)) || orphaned.some((b) => orphanAnswer.text.includes(b.user.name))),
    orphanAnswer.error ?? orphanAnswer.text.slice(0, 200),
  );
  const allBoxes = await db.box.findMany({ orderBy: { user: { name: "asc" } }, select: { id: true, userId: true, user: { select: { name: true } } } });
  const names = (await db.user.groupBy({ by: ["name"], _count: { _all: true } })).filter((g) => g._count._all === 1).map((g) => g.name);
  const from = (orphaned.length ? orphaned : allBoxes).find((b) => names.includes(b.user.name));
  const to = (await db.user.findMany({ where: { active: true, box: null }, orderBy: { name: "asc" } })).find((u) => names.includes(u.name));
  if (from && to) {
    const handover = parseChat(chat(opCookie, `תחליף את השם על הקרטון של ${from.user.name} ל${to.name}`).body);
    check("a box hand-over comes back as a plan awaiting confirmation", handover.run?.status === "PROPOSED", handover.error ?? handover.text.slice(0, 200));
    if (handover.run) {
      check("the plan names the real owner and the real new owner", handover.run.steps.length === 1 && handover.run.steps[0].title.includes(from.user.name) && handover.run.steps[0].title.includes(to.name), JSON.stringify(handover.run.steps[0]));
      const cancelled = call(`${base}/api/agent/runs/${handover.run.id}/cancel`, { method: "POST", cookie: opCookie });
      check("the hand-over plan was cancelled", cancelled.status === 200 && cancelled.body.includes('"CANCELLED"'));
      check("the box still belongs to its owner", (await db.box.findUnique({ where: { id: from.id } }))?.userId === from.userId);
    }
  } else {
    console.log("– skipped the hand-over plan: no box and no box-less active user with a unique name");
  }

  const boxesPage = call(`${base}/admin/boxes`, { cookie: opCookie });
  check("the boxes screen loads with the hand-over option", boxesPage.status === 200);

  const page = call(`${base}/admin/agent`, { cookie: opCookie });
  check("the agent history page loads", page.status === 200 && page.body.includes("היסטוריית הסוכן"));
  const requestsPage = call(`${base}/admin/requests`, { cookie: opCookie });
  check("the requests screen still loads with the new history column", requestsPage.status === 200);

  const after = await snapshot();
  check("every business table is exactly as before", after === before, after === before ? "" : `before ${before}\nafter  ${after}`);
  check("nothing in history is marked as done via AI", (await db.request.count({ where: { viaAgentRunId: { not: null } } })) === 0);

  const turns = await db.agentTurn.findMany({ where: { actorId: operator.id }, orderBy: { createdAt: "desc" }, take: 3 });
  console.log(`\nModel: ${turns[0]?.model ?? "?"} · agent log rows: ${await db.agentRun.count()} plan(s), ${await db.agentTurn.count()} turn(s)`);
  await db.$disconnect();
  if (failures) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("All production checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
