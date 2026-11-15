# AI agent (סוכן AI)

A chat for super admins (roles `SUPER_ADMIN` and `THEME_MASTER`) that looks things up and carries out
actions in the system. It opens from the spark button in the top bar. Nobody else sees the button, and
the server refuses everyone else.

## How it works, in one picture

```
operator types a request
        │
        ▼
  the model reads data ──────────────► answers a question straight away
  (lookup tools, read-only)
        │  the request needs a change
        ▼
  the model drafts steps ─► each step is checked against the live database
  (action tools: nothing runs)        and described using real names and numbers
        │
        ▼
  PLAN CARD  ── "אשר ובצע" / "בטל" ──  nothing changes until the operator confirms
        │ confirm
        ▼
  the server runs the steps, in order, through the site's own actions
  (same validation, stock bookkeeping and permissions as the buttons in the UI)
        │
        ▼
  RECEIPT: what was done, what failed, what was skipped
  + history rows on the operator's name, marked "באמצעות סוכן AI"
```

The model never executes anything. It can only read, and propose. Execution is plain server code
that runs a stored plan after the operator pressed the button, so a model mistake can at worst
produce a wrong plan that the operator sees and cancels.

## What the agent can do

| Area | Actions |
|---|---|
| Soldier equipment | sign out from ימ״ח, return to ימ״ח, transfer between soldiers |
| Boxes (קרטונים) | move to box, take out of box, return from box to ימ״ח, move between boxes, add from ימ״ח, create a box |
| Storage | set the counted quantity of an item |
| Requests | approve / deny / cancel / reopen request lines, change priority, change admin notes |
| Users | create, activate / deactivate, change role |
| Catalog | add an item type, rename / re-classify / deactivate one |
| ציוד ת״ש | add an item type, add, deduct, move, write off (lost / stolen / damaged) |
| Lookups (no confirmation) | people, a soldier's equipment and box, item stock, who holds an item, requests, ת״ש stock, recent admin actions |

**Deliberately not available:** deleting users / items / departments / templates, editing departments,
positions and templates, database reset and restore, design changes. The agent says so and points to
the screen. To add an action, add one entry to `src/lib/agent/actions.ts`; nothing else changes.

## Safety properties (each one is covered by a test)

- **Nothing runs without confirmation.** Drafting a plan changes no business data.
- **The plan card is written by the server**, from database values, not by the model. What the
  operator approves is exactly what runs.
- **A plan runs at most once.** Double clicks and two open tabs cannot run it twice.
- **Plans expire after 15 minutes** and a newer plan withdraws the older unconfirmed one.
- **Only the operator who asked can confirm or cancel** their plan.
- **Every step is re-checked right before it runs.** If the data changed in the meantime the step
  fails with the reason instead of doing something else.
- **Steps are independent.** If step 2 of 3 fails, step 1 stays done, step 3 is skipped, and the
  receipt says exactly that ("בוצע חלקית"). A whole plan is not one database transaction.
- **Invented ids, impossible quantities and unknown actions are rejected** before they reach a plan.
- **Text written by soldiers** (request notes) is passed to the model as data. Even if the model were
  fooled by it, the result is only a plan the operator must still approve.
- **An operator cannot deactivate themself or change their own role** through the agent.
- **Rate limit:** 12 requests a minute and 300 a day per operator (`AGENT_RATE_PER_MINUTE`,
  `AGENT_RATE_PER_DAY`).

One limit worth knowing: a later step cannot rely on something an earlier, not yet executed step
creates. "Sign a vest on Dani, then move that vest to his box" is two rounds: confirm the first,
then ask for the second. The agent explains this when it happens.

## History: "done by the admin, using the AI"

Actions run by the agent are recorded exactly like manual ones, on the operator's name. In
addition every history row gets `viaAgentRunId` (the plan's id), and the screens show a
**באמצעות סוכן AI** badge next to the name: the requests history (ניהול שרירותי and closed
requests), the request detail window, the soldier's own request history, the ת״ש log, the
weapons and sights tables, and an "אופן ביצוע" column in the audit export.

The marker is set in one place (`src/lib/prisma.ts`): while a confirmed plan is executing, every
history row written is stamped. When a person later acts on the same row by hand, the marker is
cleared, so the badge always describes the latest action.

`/admin/agent` (ניהול → סוכן AI) lists every plan with its receipt, who asked and what they typed,
plus the request count and estimated cost of the last 30 days.

## Model and cost

Default model: **Claude Haiku 5.5** (`claude-haiku-5-5`), $0.10 per million input tokens and $0.50
per million output tokens. It is the cheapest current Claude model, and the design above is what
makes that safe: correctness of *execution* never depends on the model.

Measured on 2026-11-15 with the live evaluation (`scripts/agent/eval-live.ts`, 23 realistic Hebrew
requests, run three times on the test branch):

| | Result |
|---|---|
| Requests understood and planned correctly | 69 of 69 |
| Time per request | 2 to 10 seconds |
| Cost per request, cache warm | about $0.0009 |
| Cost per request, first one after a pause | about $0.002 |

The fixed part of every model call (instructions plus the 32 tool definitions) is about 11,000
tokens and is cached for five minutes, which is why back-to-back requests are cheaper. A unit that
uses the agent 50 times a day spends roughly **$1.50 to $3 a month**. The real numbers appear on
`/admin/agent`.

If the cheap model ever turns out to misunderstand requests too often, set `AGENT_MODEL=claude-sonnet-5-5`
(20 times the price, so roughly $0.02 to $0.04 per request). Measure before deciding:
`scripts/agent/eval-live.ts` runs the same Hebrew requests against either model and prints the pass
rate and cost.

## Setup

1. **API key.** Create one at <https://console.anthropic.com> (Settings → API keys), add a few dollars
   of credit, and set a monthly spend limit there as a hard cap.
2. **Database migration, before deploying the code.** Migration `0006_add_ai_agent` only adds
   things: two tables and one nullable column on seven history tables. The old code keeps working
   after it, but the new code needs it, so run it first:
   ```bash
   npx prisma migrate deploy
   ```
3. **Environment variable in Vercel:**
   ```bash
   vercel env add ANTHROPIC_API_KEY production
   ```
4. **Deploy** (push the `production` branch).

Until step 3 is done the agent button answers "הסוכן עדיין לא הוגדר" and `/admin/agent` shows the
same notice. Nothing else in the site depends on the key.

Optional variables: `AGENT_MODEL`, `AGENT_RATE_PER_MINUTE`, `AGENT_RATE_PER_DAY`, and
`AGENT_API_BASE_URL` (only for routing through a gateway).

## Testing without touching production

All agent tests run against a throwaway **Neon branch** (a copy of the database), never production.
`scripts/agent/with-test-branch.sh` builds the branch connection, and refuses to run if the result
still names the production endpoint. The branch endpoint id lives in the git-ignored file
`.agent-test-branch`.

```bash
# 1. a dev server on the test branch, http://localhost:3002 (the "model" is a scripted mock)
npm run dev:agent-test

# 2. the full agent suite: 30 tests, API and real browser, desktop and phone
PW_ALLOW_DATA_MUTATION=1 PW_BASE_URL=http://localhost:3002 \
  scripts/agent/with-test-branch.sh npx playwright test tests/agent.spec.ts --project=chromium

# 3. the "done via AI" marker on its own
scripts/agent/with-test-branch.sh npx tsx scripts/agent/selftest-marker.ts
```

The suite's first test writes a marker row to the branch and proves the server under test can see
it, so the suite cannot run against a server that is pointed somewhere else. Its last test proves
that every unit it signed out is back in storage.

With `ANTHROPIC_API_KEY` in `.env`, the live evaluation (about 2 cents a run):

```bash
AGENT_REAL_MODEL=1 npm run dev:agent-test                                 # terminal A
scripts/agent/with-test-branch.sh npx tsx scripts/agent/eval-live.ts      # terminal B
```

### Checking live production safely

```bash
npx tsx scripts/agent/prod-smoke.ts
```

This asks the live site two questions and drafts one plan, which it cancels. It never confirms a
plan, and it counts the rows of every business table before and after to prove nothing changed. The
only rows it adds are the agent's own log (usage, and one cancelled plan).

To create a fresh test branch: Neon console → Branches → Create branch from `main`, copy its
endpoint id (`ep-…`) into `.agent-test-branch`, then
`scripts/agent/with-test-branch.sh npx prisma migrate deploy`.

## Files

| Path | What |
|---|---|
| `src/lib/agent/actions.ts` | every change the agent can make: check, describe, execute |
| `src/lib/agent/readTools.ts` | read-only lookups |
| `src/lib/agent/engine.ts` | one chat turn with the model; drafts, never executes |
| `src/lib/agent/runs.ts` | plan storage, confirm / cancel, execution, receipts |
| `src/lib/agent/prompt.ts` | the agent's standing instructions |
| `src/lib/agent/context.ts`, `src/lib/prisma.ts` | the "via AI" marker |
| `src/app/api/agent/**` | chat, confirm and cancel endpoints |
| `src/components/agent/**` | chat sheet, plan / receipt card, history badge |
| `src/app/(app)/admin/agent/**` | plans and receipts page |
| `tests/agent.spec.ts`, `tests/support/mockAnthropic.ts` | the test suite and the scripted model |
