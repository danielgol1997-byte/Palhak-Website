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
The aim is that the agent can do whatever an administrator can do on the site.

| Area | Actions |
|---|---|
| Soldier equipment | sign out from ימ״ח, return to ימ״ח, transfer between soldiers, bring written-off equipment (lost, stolen, damaged, used) back into stock |
| Boxes (קרטונים) | move to box, take out of box, return from box to ימ״ח, move between boxes, add from ימ״ח, create a box, **hand a whole box over to another person** |
| Box template (תבנית קרטון) | add a row, change its quantity per box, remove it, add / remove an alternative item, rename a row |
| Storage | set the counted quantity of an item |
| Requests | approve / deny / cancel / reopen request lines, cancel a whole request, change priority, change admin notes |
| Users | create, activate / deactivate, change role, edit personal details (name, email, personal number, phone, sizes), set departments and positions |
| Organisation | add / rename / deactivate / delete / reorder departments, add / rename / move / deactivate positions |
| Catalog | add an item type, rename / re-classify / deactivate one, delete one |
| Unit templates (תבניות יחידה) | create, rename, deactivate, delete, add an item or change its quantity, remove an item |
| ציוד ת״ש | add / rename / delete an item type, add, deduct, move, write off, set a counted quantity, edit a log note, undo a log line, remove a saved location |
| Backup | take a full backup now |

**Deliberately not available:** restoring a backup and resetting the database, downloading export
files, the site's design, and the operator's own profile. Users are never deleted, on the site or
by the agent; they are deactivated. The agent says so and points to the screen.

To add an action, add one entry to `src/lib/agent/actions.ts` or `actionsAdmin.ts`; nothing else
changes.

### Handing a box over (שינוי השם על הקרטון)

When someone leaves the unit, their box can be put on another person's name. The box and everything
in it stay as they are; only the owner changes, and the previous owner is left without a box. No
equipment moves and stock does not change.

- On the site: **קרטונים → עריכה → העבר קרטון לחייל אחר**.
- Through the agent: "תחליף את השם על הקרטון של X ל-Y", for one box or for many in one plan (one
  step per box).

Rules, enforced by the server action (`reassignBoxAction`) for both paths: the new owner must be an
active user; a box that holds equipment is never overwritten; an empty box on the new owner is
replaced. The change is written to the audit trail as `REASSIGN_BOX`, marked as done through the
agent when it was.

## What the agent knows

Every message starts with a live snapshot of the system's totals, read from the database: people by
role, boxes, catalog size, units in storage / signed / in boxes, departments with member counts,
ת״ש totals, waiting requests, last backup. Questions such as "how many boxes do I have" are answered
from it directly.

For detail it has read-only lookups covering everything the screens show:

| Topic | Lookups |
|---|---|
| People | search by name, browse by role / department / box, personal details, equipment and box of a soldier |
| Equipment | search or browse the catalog with stock, signed and boxed units; who holds an item; every weapon and sight by serial number |
| Boxes | every box with its owner, whether the owner is still active, and how much is inside; the box template with how the existing boxes stand against each row; box completeness report |
| Requests | waiting requests, one request in full, counts by type |
| Organisation | departments with positions and member counts; unit templates |
| ציוד ת״ש | quantities by location; the ת״ש log |
| History | the full audit trail (who did what, when, and whether through the agent); recent admin equipment actions |
| Reports | low or zero stock; who lacks an item; incomplete boxes; soldiers without a box |

## Changes that reach beyond one record

Some requests touch far more than the record they name. For those the agent explains the
consequence with real numbers, offers the clean way of doing it, and can carry it out:

- **Box template.** Removing a row, removing an alternative or lowering a quantity strands units in
  soldiers' boxes. The agent says how many boxes are affected and offers three choices: leave them,
  return them to the ימ״ח, or sign them back onto the soldiers. With the last two the plan gets one
  clean-up step per box *before* the template change, and the template change refuses to run if any
  unit is still in a box.
- **Deactivating a user** who still holds equipment, **deactivating an item** that is in use, a
  **large drop in a storage count**, and a **promotion** all carry a warning.
- **Deletions** say exactly what disappears. Deleting an item follows the site's own stages: an
  item with history is only marked as discontinued, and a second delete erases the history too; the
  plan states which stage it is, how much stock is wiped from the count and which templates lose
  the item. Deleting a ת״ש item lists the quantities and log lines that go with it. The milder
  choice (deactivating) is offered where one exists.
- **Handing over a box** of someone who is still an active user warns that they will be left
  without one.

Warnings are written by the server from live data and shown in amber on the plan card, with the
confirm button changed to "קראתי את האזהרות, אשר ובצע". They do not depend on the model remembering
to mention them. A step also knows what earlier steps of the same plan already do, so a plan that
returns a soldier's equipment and then deactivates him shows no false warning.

Plans can be long (up to 150 steps; emptying a row from every box is one step per box). The card
folds long plans and always keeps warnings and failures visible.

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

Measured on 2026-11-15 with the live evaluation (`scripts/agent/eval-live.ts`, realistic Hebrew
requests on the test branch):

| | Result |
|---|---|
| Requests understood and planned correctly (first 23 scenarios, three runs) | 69 of 69 |
| Full set of 38 scenarios, including template changes, warnings, reports and system knowledge (two runs) | 76 of 76 |
| Current set of 50 scenarios, adding box hand-over (one box, three, a pasted list of six pairs), organisation, deletions, undoing a ת״ש entry and backup | 50 of 50 |
| Time per request | 2 to 10 seconds |
| Cost per request, cache warm | about $0.0015 |
| Cost per request, first one after a pause | about $0.004 |

The fixed part of every model call (instructions plus the tool definitions) is about 29,000
tokens and is cached for five minutes, which is why back-to-back requests are cheaper. A unit that
uses the agent 50 times a day spends roughly **$2 to $6 a month**. The real numbers appear on
`/admin/agent`.

If the cheap model ever turns out to misunderstand requests too often, set `AGENT_MODEL=claude-sonnet-5-5`
(20 times the price, so roughly $0.03 to $0.06 per request). Measure before deciding:
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

# 2. the full agent suite: 49 tests, API and real browser, desktop and phone
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
| `src/lib/agent/actions.ts` | changes to equipment, boxes, the box template, stock, requests, users, the catalog and ת״ש quantities: check, describe, execute |
| `src/lib/agent/actionsAdmin.ts` | the rest of the admin screens: organisation, personal details, unit templates, deletions, the ת״ש log, backup |
| `src/lib/agent/actionKit.ts` | shared building blocks for actions |
| `src/lib/agent/readTools.ts` | read-only lookups and reports |
| `src/lib/agent/snapshot.ts` | the live totals given to the model with every message |
| `src/lib/agent/boxTemplateData.ts` | what a template change does to existing boxes |
| `src/lib/agent/engine.ts` | one chat turn with the model; drafts, never executes |
| `src/lib/agent/runs.ts` | plan storage, confirm / cancel, execution, receipts |
| `src/lib/agent/prompt.ts` | the agent's standing instructions |
| `src/lib/agent/context.ts`, `src/lib/prisma.ts` | the "via AI" marker |
| `src/app/api/agent/**` | chat, confirm and cancel endpoints |
| `src/components/agent/**` | chat sheet, plan / receipt card, history badge |
| `src/app/(app)/admin/agent/**` | plans and receipts page |
| `tests/agent.spec.ts`, `tests/support/mockAnthropic.ts` | the test suite and the scripted model |
