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

**Phase 5a+: two ways to run — Docker (preferred) or bare-metal venv**

### Option A — Docker Compose (preferred, matches VPS)

The `ocr-service` is part of `docker-compose.yml`. Requires **Docker Desktop** installed (winget: `winget install Docker.DockerDesktop`).

**One-time setup: Create a `.env` file at the project root** for Docker Compose. It reads `.env` (not `.env.local`). Copy the values from `.env.local` and set `STORAGE_PATH` to an absolute path:

```env
STORAGE_PATH=C:/Users/aidih/Desktop/MyExpense/var/receipts
OCR_SECRET=local-ocr-secret
```

Docker Compose needs absolute paths on Windows for volume mounts.

**Start the OCR service:**

```bash
# From repo root
docker compose up ocr-service -d
```

Uses the `paddleocr_cache` named volume so models (~500 MB) are not re-downloaded on restart.

The Dockerfile already binds `0.0.0.0:8001` inside the container. The `docker-compose.yml` maps `ports: ["8001:8001"]` for local dev so the bare-metal worker can reach it at `http://localhost:8001`. On VPS, no ports are published — the worker runs inside Docker and reaches `http://ocr-service:8001` on the internal network (ADR-025).

**First build** takes 3–5 minutes (downloads python:3.11-slim, pip installs PaddleOCR ~170 MB wheel). Subsequent starts are instant.

**Verify:**

```bash
curl http://localhost:8001/health
# → {"status":"ok"}
```

### Option B — bare-metal venv (fallback, not recommended on Windows)

PaddleOCR requires **Python 3.11 exactly** — not 3.12, not 3.14. Most Windows machines have a newer version via winget. Use `py -0` to check available versions. If Python 3.11 is not installed, use Option A (Docker) instead.

```bash
cd ocr-service
py -3.11 -m venv venv
venv/Scripts/pip install -r requirements.txt
```

**Required env vars** (add to `.env.local` — validated at app boot by `lib/env.ts`):

```bash
OCR_SECRET=local-ocr-secret
STORAGE_PATH=./var/receipts
OCR_SERVICE_URL=http://localhost:8001
```

**Start:**

```bash
venv/Scripts/uvicorn ocr-service.main:app --host 127.0.0.1 --port 8001
```

**Binding rule:** `127.0.0.1` only, never `0.0.0.0`. Critical Rule #8 in `CLAUDE.md`.

---

## Database Scripts (Drizzle)

The `db:generate`, `db:migrate`, `db:studio`, and `db:push` scripts in `package.json` use Node's `--env-file` flag to load `.env.local`, then invoke drizzle-kit directly via its `bin.cjs` entry point:

```json
"db:generate": "node --env-file=.env.local node_modules/drizzle-kit/bin.cjs generate",
"db:migrate":  "node --env-file=.env.local node_modules/drizzle-kit/bin.cjs migrate",
"db:studio":   "node --env-file=.env.local node_modules/drizzle-kit/bin.cjs studio",
"db:push":     "node --env-file=.env.local node_modules/drizzle-kit/bin.cjs push"
```

**Why `bin.cjs` instead of the normal shim:** On this machine (Windows, Node v24), the `node_modules/.bin/drizzle-kit` file is a bash shim. When invoked as `node ... ./node_modules/.bin/drizzle-kit`, Node tries to execute the bash script as JavaScript and throws a syntax error. Using `node_modules/drizzle-kit/bin.cjs` calls the actual CJS entry point directly, bypassing the shim entirely.

**Why `--env-file=.env.local`:** drizzle-kit doesn't auto-load `.env.local` the way Next.js does. Without it, the CLI can't see `DATABASE_URL` and fails with a cryptic "missing connection string" error. This is a Node built-in flag (Node v20.6+) — no extra package needed.

On the VPS, migrations run via `make migrate` (see `docs/deployment.md`) which uses the Docker `migrate` service — these scripts are local-dev only.

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
curl http://127.0.0.1:8001/health                                # → {"status":"ok"}
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
The `--env-file=.env.local` argument was dropped from the script. See "Database Scripts" above.

**`db:generate` / `db:migrate` throws a JS SyntaxError on startup**
Node is executing the bash shim as JavaScript. The scripts must use `node_modules/drizzle-kit/bin.cjs`, not `./node_modules/.bin/drizzle-kit`. See "Database Scripts" above.

**Postgres started but `psql` says role does not exist**
This is a fresh Postgres data dir. Recreate the role and DB:
```bash
psql -U postgres -c "CREATE ROLE myexpense WITH LOGIN PASSWORD 'myexpense_dev';"
psql -U postgres -c "CREATE DATABASE myexpense_dev OWNER myexpense;"
```
