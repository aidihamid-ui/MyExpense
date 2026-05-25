# MyExpense

Self-hosted expense tracker for up to 6 users. Manual entry + receipt OCR via PaddleOCR. Built for personal/family use — not a SaaS product.

**Live:** https://myexpense.srv1488589.hstgr.cloud

---

## What it does

- Track expenses by category, payment method, date, and note
- Upload receipt photos — PaddleOCR extracts the total, date, and merchant automatically
- Dashboard with monthly totals, last-30-days, and category breakdown
- Filter by date range and category; search expenses by note
- Export all expenses to CSV
- Settings: change password, delete account
- Multi-user: up to 6 accounts, full data isolation between users

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, TypeScript strict) |
| Database | PostgreSQL 17 + Drizzle ORM |
| Auth | Better-Auth (email/password) |
| OCR | PaddleOCR via Python FastAPI sidecar |
| UI | Tailwind CSS 4 + shadcn/ui |
| Error tracking | Sentry |
| Production | Docker Compose + Traefik + Let's Encrypt on Hostinger VPS |

---

## Run locally

You need: Node 24, PostgreSQL 17, Docker Desktop (for the OCR sidecar).

### 1. Clone and install

```bash
git clone https://github.com/aidihamid-ui/MyExpense.git
cd MyExpense
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local — fill in all required variables (see table below)
```

### 3. Set up the database

```bash
# Create role and DB (run in psql as postgres superuser):
CREATE ROLE myexpense WITH LOGIN PASSWORD 'yourpassword';
CREATE DATABASE myexpense_dev OWNER myexpense;

# Apply migrations:
npm run db:migrate
```

### 4. Start all four processes (separate terminals)

```bash
# Terminal 1 — PostgreSQL (skip if running as a system service)
pg_ctl -D /path/to/data -l /path/to/pg.log start

# Terminal 2 — OCR sidecar (Docker Desktop must be running)
docker compose up ocr-service -d

# Terminal 3 — Next.js dev server
npm run dev

# Terminal 4 — OCR background worker
npm run worker
```

App runs at `http://localhost:3000`.

---

## Deploy

Production runs as four Docker Compose services (`app`, `db`, `ocr-service`, `worker`). Traefik handles HTTPS and Let's Encrypt.

Full runbook: [`Docs/deployment.md`](Docs/deployment.md)

---

## Environment variables

See [`.env.example`](.env.example) for the full list. Required:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Auth signing secret (min 32 chars) |
| `BETTER_AUTH_URL` | App base URL (e.g. `https://yourdomain.com`) |
| `STORAGE_PATH` | Directory where receipt files are stored |
| `OCR_SERVICE_URL` | URL of the PaddleOCR FastAPI sidecar |
| `OCR_SECRET` | Shared secret between app and OCR service |

Optional:

| Variable | Purpose |
|---|---|
| `SENTRY_DSN` | Sentry error tracking DSN (app works without it) |

---

## Not open for contributions

This is a personal project. I'm not accepting pull requests or feature requests.
