# Phases

Phase-by-phase build steps for MyExpense. Read only the section for the current phase.

**Navigation:** Each phase starts with `## Phase N — Name`. Use that anchor.

---

## Phase 0 — Local Setup (~3-4 hours)

**Deliverable:** Local dev environment where every part of the stack starts cleanly.

### Steps
- [ ] Install Node 20+ via `nvm` or `fnm`
- [ ] Install PostgreSQL 16; create role `myexpense` and database `myexpense_dev`
- [ ] Install Python 3.11+
- [ ] Create GitHub repo `myexpense`, clone locally
- [ ] Add `CLAUDE.md` at repo root + docs in `docs/` (build-plan, phases, conventions, etc.)
- [ ] Init Next.js 15 with TypeScript + Tailwind: `npx create-next-app@latest .`
- [ ] Install Drizzle, Better-Auth, Zod
- [ ] Create `.nvmrc`, `.env.example`, `.env.local`, `.gitignore`
- [ ] Set up `lib/env.ts` (typed env validation with Zod at boot)
- [ ] Create `ocr-service/` directory with Python venv
- [ ] Install: `pip install paddleocr paddlepaddle fastapi uvicorn` (slow — be patient)
- [ ] Create minimal `ocr-service/main.py` with a `/health` endpoint returning "ok"
- [ ] Verify: `npm run dev` works, Python service starts, `psql` connects
- [ ] First commit: `chore: initial project scaffold`
- [ ] Tag: `git tag -a v0.0-scaffold -m "Initial scaffold"`

### Test
All three processes start without error:
- Next.js on `http://localhost:3000`
- Python on `http://localhost:8001/health` returns ok
- `psql myexpense_dev` connects

### Commit + tag
`v0.0-scaffold`

---

## Phase 1 — Auth (Days 2-3, local)

**Deliverable:** Working signup/login/logout on `localhost:3000`. Two test accounts created.

### Steps
- Drizzle schema for `users` and `sessions`
- Better-Auth configured (email/password; verification disabled for now)
- Signup page, login page, logout button
- Session guard via `proxy.ts` (Next.js 16's replacement for `middleware.ts`; runs on Node.js runtime) protecting `/dashboard`. Treat the proxy as a UX redirect, not a security boundary — the real auth check is in the protected server component (see ADR-006).
- Local password reset flow (token-based)

### Test
- Register two accounts (user-a@test.com, user-b@test.com)
- Log in/out for each
- Sessions persist across server restart
- Trying to access `/dashboard` while logged out → redirect to login

### Commit + tag
`v0.1-auth-working`

---

## Phase 1.5 — First VPS Deploy (COMPLETE)

**Stack used:** Docker Compose + Traefik (not PM2 + Nginx as originally planned — VPS already had Traefik running for other apps).

**Live URL:** https://myexpense.srv1488589.hstgr.cloud
**VPS:** Ubuntu 24.04, 187.77.155.88

### What was built
- `Dockerfile` — multi-stage: deps → builder (with build-time ENV placeholders) → runner (standalone, non-root) + migrator target
- `docker-compose.yml` — app + postgres:17-alpine, Traefik labels, no shared network, no published ports
- `.dockerignore`
- `Makefile` — deploy, migrate, logs, backup, shell, ps
- `scripts/backup-db.sh` — daily pg_dump, gzip, 30-day retention
- `Docs/deployment.md` — pre-flight checklist + full runbook

### Future deploys
```bash
ssh root@187.77.155.88
cd /docker/myexpense/repo
make deploy      # git pull + rebuild + restart
make migrate     # only if schema changed
```

Full runbook: `Docs/deployment.md`.

### Test
- [x] Visit https://myexpense.srv1488589.hstgr.cloud — login page loads over HTTPS
- [x] Log in / log out with test accounts

### Commit + tag
`v0.1.5-first-deploy`

---

## Phase 2 — Manual Expense Entry (COMPLETE)

**Deliverable:** Add, edit, delete expenses; see them listed.

**Live locally. VPS deploy pending (`make deploy` + `make migrate`).**

### What was built
- `categories` + `expenses` schema; migration 0001; default categories seeded at signup
- `/expenses` list — date-desc, 20/page pagination, desktop table + mobile cards
- `/expenses/new` — add form with Zod validation, inline field errors
- `/expenses/[id]/edit` — pre-filled edit form; wrong-owner → 404
- Delete confirmation modal; `revalidatePath` + `router.refresh()` post-delete
- ESLint configured (`eslint.config.mjs`, `npm run lint`)

### Test
- [x] Create 20 expenses across two accounts (21 total)
- [x] Multi-tenancy: user-b visits user-a's edit URL → HTTP 404; delete blocked at query layer
- [x] Edit and delete work; confirmation prevents accidents
- [x] `npm run typecheck` clean, `npm run lint` clean, `npm run build` passes

### Commit + tag
`v0.2-expenses-done` — **deployed to VPS ✓** (commit 99e63b9).

---

## Phase 3 — Dashboard (Day 7, local)

**Deliverable:** Useful overview on the homepage.

### Steps
- Current month total + last month for comparison
- Category breakdown (table — chart in V2)
- Last 30 days running total
- Filter expenses by date range and category
- Test edge cases: first/last day of month, timezone boundary

### Test
- Numbers add up exactly to the expense list totals
- Date filters work across month boundary
- Two accounts: each sees only their own numbers

### Commit + tag
`v0.3-dashboard-done` — **deploy**.

---

## Phase 4 — Receipt Upload, no OCR yet (Days 8-9, local)

**Deliverable:** Upload receipt photo, see it attached to an expense.

### Steps
- File upload endpoint (Server Action) with validation:
  - MIME type whitelist: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
  - Magic bytes check (don't trust MIME header alone)
  - Max 5MB
- Save to `{STORAGE_PATH}/{userId}/{uuid}.{ext}`
- Strip EXIF metadata (location leak risk)
- Schema: `receipts` table
- Form supports attaching photo to a new expense
- View receipt via auth-checked route `/api/receipts/[id]`
- The route: check session → fetch receipt row → verify `receipt.userId === session.userId` → stream file

### Test
- Upload 5 receipts of different sizes/formats
- Try uploading `.exe` (must reject)
- Try uploading 10MB file (must reject)
- Direct file system path access without session → fails
- User A can't access user B's receipt by guessing the ID

### Commit + tag
`v0.4-uploads-done` — **deploy**.

---

## Phase 5 — OCR Pipeline (Days 10-14, local)

The meaty phase. Build in 5 sub-steps.

### 5a. Python OCR service
- FastAPI on `127.0.0.1:8001`
- PaddleOCR loaded once at startup (~500MB, takes ~5s)
- `POST /ocr` endpoint: accepts `{ "path": "..." }`, returns text + lines
  _(Note: spec originally said `image_path` — actual implementation uses `path`. See integration-map §17.)_
- Validate path is inside the receipts dir (prevent traversal)
- Accept shared secret header `X-OCR-Secret` for defense-in-depth

### 5b. `OcrProvider` interface
- `lib/ocr/provider.ts` — interface with `extractFromImage(path: string): Promise<OcrResult>`
- `lib/ocr/paddle.ts` — `PaddleOcrProvider` calls Python service
- Selected at boot via `process.env.OCR_PROVIDER`

### 5c. Job queue + worker
- `ocr_jobs` table
- `worker.ts` script polls every 5s for pending jobs
- Handles retries (max 3) and permanent failures
- PM2 runs as separate process in prod; locally `npm run worker` in separate terminal

### 5d. Receipt parser
- `lib/ocr/parser.ts` — turns raw OCR text into `{ total, date, merchant, items }`
- Regex for `RM`/`Total`/`Jumlah` patterns
- Conservative: leave fields empty rather than guess wrong
- Return both structured data AND raw text (UI shows raw as fallback)

### 5e. Review UI + final wiring (COMPLETE)

_Implemented 2026-05-23. Tag: `v0.5-ocr-working`._

**Upload flow (`app/expenses/new/expense-form.tsx`):**
- After `uploadReceiptAction` succeeds, calls `createOcrJobAction(receiptId)`
- On success: redirects to `/receipts/[id]/review`
- On failure: redirects to `/receipts/[id]/review?warning=ocr_failed`
- No-file path unchanged (direct `createExpenseAction`)

**Review page (`app/receipts/[id]/review/`):**
- Server Component: session check, receipt ownership via `getReceiptById` (notFound on miss), reads `?warning=ocr_failed`
- Client Component: polls `checkReceiptStatusAction` every 3s, stops on completed/failed
- Four sub-views: Loading, Pending (spinner + elapsed), Completed (green banner + prefilled form + collapsible raw OCR), Failed (amber warning + blank form)
- Shared `ExpenseForm` with `useActionState` → `createExpenseAction` + hidden `receiptId`

**Security fix (`lib/actions/expenses.ts`):**
- `createExpenseAction` now verifies receipt ownership via `getReceiptById` before creating expense (ADR-031)

**Proxy (`proxy.ts`):**
- Matcher extended to `/receipts/:path*` for UX redirect (ADR-006)

**Env:**
- `OCR_SERVICE_URL` now required in `.env.local` (validated at boot by `lib/env.ts`)

### Test
- Upload receipt → verify redirect to /receipts/[id]/review
- Verify spinner shows during OCR processing
- Start worker in separate terminal: `npm run worker`
- Verify worker picks up job and logs it
- Verify page transitions from spinner to prefilled form
- Confirm expense creates correctly with receiptId linked
- Test ?warning=ocr_failed path: upload receipt, kill OCR service, verify FailedView shows
- Upload 10 different receipts: clean, crumpled, faded thermal paper, Malay-only, English-only, mixed
- Document accuracy per category
- Worker survives Python service restart (job retries)
- Two users uploading simultaneously: jobs don't get crossed
- Cross-user isolation: user A cannot see user B's receipt review page

### Commit + tag
`v0.5-ocr-working` — **deploy**. This deploy will reveal Python differences on Ubuntu — fix and document in `deployment.md`.

---

## Phase 6 — Polish & Production (Days 15-17)

**Deliverable:** V1 worth inviting your 5 family/friends to.

### Steps
- CSV export
- Search by note/merchant
- Mobile responsive (test at 375px wide)
- Settings page (change password, delete account)
- Sentry for error tracking (free tier)
- Backup cron jobs:
  - Daily `pg_dump` to `/var/backups/myexpense/db-YYYY-MM-DD.sql.gz`, retain 30 days
  - Daily rsync of receipts to second location
- Uptime monitoring (Uptime Kuma free tier, or BetterStack)
- Update `docs/deployment.md` with everything learned this build
- README.md for public-facing intro

### Test
- Test backup restore on a fresh VM
- Pull mobile UI test on actual phone over LAN
- All security review prompts run one final time

### Commit + tag
`v1.0-production` — **invite your 5 users.**
