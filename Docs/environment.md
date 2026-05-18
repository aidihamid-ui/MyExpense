# Local Environment

How to start, stop, and verify the local dev environment. Stable runbook — does NOT get overwritten by session handoffs.

For production deploy steps, see `docs/deployment.md`.

---

## What Runs Locally

Three processes, three terminals:

| Process | Port | Purpose |
|---|---|---|
| PostgreSQL 17 | 5432 | Database |
| Python OCR sidecar (FastAPI) | 8001 | OCR via PaddleOCR |
| Next.js dev server | 3000 | The app |

The Next.js worker (Phase 5+) adds a fourth terminal. PaddleOCR install is deferred until Phase 5.

---

## PostgreSQL

Installed via Scoop. Not running as a Windows service yet — must be started each session unless registered (see below).

**Path setup (once per shell):**
```bash
export PATH="$HOME/scoop/apps/postgresql17/current/bin:$PATH"
```

**Start:**
```bash
pg_ctl -D ~/scoop/apps/postgresql17/current/data -l ~/scoop/apps/postgresql17/current/data/pg.log start
```

**Stop:**
```bash
pg_ctl -D ~/scoop/apps/postgresql17/current/data stop
```

**Verify:**
```bash
psql -U myexpense -d myexpense_dev -c "select 1;"
```

**Local credentials (dev only, never reuse in prod):**
- Role: `myexpense`
- Password: `myexpense_dev`
- DB: `myexpense_dev`
- Host: `localhost:5432`

### Optional — register as a Windows service

Run once in an elevated PowerShell so Postgres starts with Windows:

```powershell
pg_ctl register -N PostgreSQL -D C:\Users\aidih\scoop\apps\postgresql17\current\data
net start PostgreSQL
```

---

## OCR Service (Python FastAPI)

**Start:**
```bash
cd ocr-service
venv/Scripts/uvicorn main:app --host 127.0.0.1 --port 8001
```

With reload for active development:
```bash
venv/Scripts/uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

**Verify:**
```bash
curl http://127.0.0.1:8001/health
# → "ok"
```

**Binding rule:** `127.0.0.1` only, never `0.0.0.0`. Enforced as Critical Rule #8 in `CLAUDE.md`.

### Python version note

The skeleton runs on whatever Python the venv was created with (currently 3.14). **PaddleOCR installation in Phase 5 requires Python 3.11** — use `py -3.11 -m venv venv` when creating the venv at that point. Don't reuse the 3.14 venv for PaddleOCR; create a fresh one.

---

## Database Scripts (Drizzle)

The `db:generate`, `db:migrate`, `db:studio`, and `db:push` scripts in `package.json` all pass `--env-file=.env.local` to the drizzle-kit CLI:

```json
"db:generate": "drizzle-kit generate --env-file=.env.local",
"db:migrate":  "drizzle-kit migrate  --env-file=.env.local",
"db:studio":   "drizzle-kit studio   --env-file=.env.local",
"db:push":     "drizzle-kit push     --env-file=.env.local"
```

**Why this is needed:** drizzle-kit doesn't auto-load `.env.local` the way Next.js does. Without `--env-file`, the CLI can't see `DATABASE_URL` and fails with cryptic "missing connection string" errors. The flag tells drizzle-kit to read the file explicitly.

**If you ever see "missing DATABASE_URL" from a `db:*` script:** the flag was probably dropped. Re-add it.

**Why not just use `dotenv-cli`:** `--env-file` is a drizzle-kit-native flag that scopes the load to one process. Cleaner than wrapping the command.

On the VPS (Phase 1.5+), production uses `.env` (not `.env.local`), and migrations run differently. See `docs/deployment.md` once that file exists.

---

## Next.js Dev Server

```bash
npm run dev
```

**Verify:**
- Open http://localhost:3000 in a browser
- Page renders without console errors

`npm run dev` doubles as live env validation — `lib/env.ts` runs at boot and throws if any required env var is missing.

---

## Quick Session Start

A normal local session needs all three running. In order:

1. **Terminal 1 — Postgres:** `pg_ctl ... start` (skip if registered as service)
2. **Terminal 2 — OCR sidecar:** `cd ocr-service && venv/Scripts/uvicorn ...`
3. **Terminal 3 — Next.js:** `npm run dev`

Then verify all three respond:
```bash
psql -U myexpense -d myexpense_dev -c "select 1;"               # → returns row
curl http://127.0.0.1:8001/health                                # → "ok"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000   # → 200
```

If any of those three fails, fix it before writing code.

---

## Troubleshooting

**`psql: error: connection to server ... refused`**
Postgres not started. Run the `pg_ctl ... start` command. If it says "another server might be running," check `netstat -ano | findstr :5432`.

**`port 8001 already in use`**
Leftover uvicorn process. Windows: `netstat -ano | findstr :8001` → `taskkill /PID <pid> /F`.

**`npm run dev` exits immediately with env error**
`.env.local` is missing a variable. Diff against `.env.example`; the Zod schema in `lib/env.ts` is the source of truth for what's required.

**`db:generate` / `db:migrate` fails with missing DATABASE_URL**
The `--env-file=.env.local` flag was dropped from the script. See "Database Scripts" above.

**Postgres started but `psql` says role does not exist**
This is a fresh Postgres data dir. Recreate the role and DB:
```bash
psql -U postgres -c "CREATE ROLE myexpense WITH LOGIN PASSWORD 'myexpense_dev';"
psql -U postgres -c "CREATE DATABASE myexpense_dev OWNER myexpense;"
```
