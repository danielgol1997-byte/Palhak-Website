# Backups & data safety

This document explains how the data is protected, how to check it, and how to restore.

## Layers of protection

| Layer | What it protects against | Where | Retention |
|---|---|---|---|
| **Daily application backup** (full JSON dump of every table, gzipped) | Accidental deletes/edits, bad migrations, bugs | `DatabaseBackup` table in the same Neon database | daily 14 d · weekly 70 d · monthly 400 d · manual 365 d · pre-reset/pre-restore forever |
| **Off-site mirror** of each backup (optional) | Loss of the Neon project itself | Private Vercel Blob store | same as above |
| **Neon instant restore** (point-in-time) | Anything in the last window | Neon console → Branches → Restore | 6 h on the Free plan (the maximum; paid plans allow up to 30 d) |
| **Neon manual snapshot** | Baseline before big changes | Neon console → Backup & restore | until deleted (Free plan: 1 snapshot) |
| **Local copies** you download | Everything above disappearing | Your Mac / Drive (`backups/` folder, git-ignored) | up to you |

The daily backup runs via a Vercel Cron job defined in `vercel.json` (`/api/cron/backup`, 02:30 UTC every day).
On the 1st of the month it is tagged MONTHLY, on Sundays WEEKLY, otherwise DAILY. Pruning happens after each run.

Backups are also taken automatically **before** any destructive reset endpoint runs (`PRE_RESET`) and before a CLI restore (`PRE_RESTORE`).

## Admin UI

Super admins see **ניהול → גיבויים** (`/admin/backups`):
- create a manual backup with a label
- verify a backup (checksum + parse + row-count check)
- download any backup as `palhak-backup-<kind>-<date>.json.gz`
- see whether the off-site mirror and the cron secret are configured

## One-time setup (recommended, 2 minutes)

These need your Vercel login and were not done automatically.
**Status (2026-11-05): all three steps below are done** – the table migration is applied, the private Blob store
`palhak-backups` is connected, `CRON_SECRET` exists in Production, and the first manual backup
(`first-backup-after-migration`, 8,515 rows) was created, verified and mirrored to Blob.

1. **Off-site mirror** – create a *private* Blob store and connect it to the project (adds `BLOB_READ_WRITE_TOKEN`):
   ```bash
   vercel blob create-store palhak-backups --access private --region fra1 --yes
   ```
2. **Cron secret** – so only Vercel can trigger the backup endpoint:
   ```bash
   openssl rand -base64 32 | vercel env add CRON_SECRET production
   ```
   (Without it the endpoint still works, but only accepts Vercel's cron user-agent and at most once per 20 h.)
3. Redeploy so the new env vars are picked up.
4. For local scripts, add the same `BLOB_READ_WRITE_TOKEN` to `.env` (optional; only needed to pull mirrored copies).

> **Heads-up about `vercel env pull`:** it writes `.env.local`, which overrides `.env` for the local dev server.
> If that file contains the production `NEXTAUTH_URL` (https://…vercel.app) and `NODE_ENV=production`, local
> Google sign-in will redirect to production and NextAuth will expect `__Secure-` cookies. Delete those two lines
> from `.env.local` (keep `BLOB_READ_WRITE_TOKEN`) to get normal local development back. The Playwright tests
> detect either setup automatically.

## Database migration for the backup table

Apply once against production (additive, creates one table and one enum):
```bash
npx prisma migrate deploy
```

## Scripts (run on your Mac, from the project folder)

```bash
npm run backup:export        # dump the live DB to backups/<timestamp>.json.gz
npm run backup:download      # copy every stored backup (DB/Blob) to backups/
npm run backup:verify -- backups/<file>.json.gz
npm run backup:restore -- --file backups/<file>.json.gz            # dry run: prints the plan
npm run backup:restore -- --id <backupId>                          # dry run from a stored backup
npm run backup:restore -- --file backups/<file>.json.gz --yes-replace-all-data
```

### Restore procedure (safe path)

1. In the Neon console create a **branch** from `main` (or use an existing one).
2. Point `DATABASE_URL` and `DIRECT_URL` in `.env` at that branch.
3. Run the restore (dry run first, then with `--yes-replace-all-data`).
4. Check the result (run the app locally against the branch, or query it).
5. Repeat against `main`, or promote the branch in Neon.

The restore runs in a single transaction: either every table is replaced or nothing changes. It first writes a `PRE_RESTORE` backup of the current data (DB row + `backups/palhak-pre-restore-*.json.gz`) so a restore can itself be undone.

### Point-in-time restore (last 6 hours)

Neon console → project **Palhak Website** → Branches → `main` → **Restore** → pick a timestamp. Neon keeps the previous state as a new branch, so this is reversible too.

## Destructive endpoints

`POST /api/admin/reset-database` and `POST /api/admin/fresh-reset` now require **all** of:
- a SUPER_ADMIN / THEME_MASTER session (plain admins are refused),
- `ALLOW_DB_RESET=true` in the environment (not set in production → endpoints are inert),
- a JSON body `{"confirm":"RESET"}`,
- and they take a `PRE_RESET` backup before deleting anything.

The CLI scripts in `scripts/` (`reset-*.ts`, `fresh-reset.ts`, `set-inventory.ts`) are development tools; take a backup (`npm run backup:export`) before running any of them.

## Tests and real data

The local dev server uses the **production** database. `tests/desktop.spec.ts`, `tests/mobile.spec.ts` and
`tests/notifications.spec.ts` only read. `tests/boxes.spec.ts` and `tests/tash.spec.ts` create, move and delete
real rows (box template, box items, ת״ש items), so they are skipped unless you set `PW_ALLOW_DATA_MUTATION=1`,
and should only run with `DATABASE_URL`/`DIRECT_URL` pointed at a Neon branch.

If they ever run against production by mistake, creating a backup is not enough – compare with the last backup and
revert. `scripts/backup/revert-test-run-2026-11-05.ts` is a worked example of such a targeted, self-checking revert.

## Checking that backups are healthy

- `/admin/backups` shows the newest backup and its age; amber means it is older than 30 h.
- Each run of the cron returns JSON with `backupId`, `sizeBytes`, `mirrored`, `pruned` – visible in Vercel → Project → Cron Jobs / Logs.
- Once a month: `npm run backup:download` and keep the folder somewhere outside this machine.
