# Handoff

**Read this at the start of every Claude Code session.** It's the single source of truth for where the project stands right now.

**Last updated:** 2026-05-22
**Last session by:** Claude
**Current phase:** Phase 5c COMPLETE. ocr_jobs table + polling worker.

---

## Current State

### What's working

- Next.js 16.2.6 (App Router, TypeScript strict, Tailwind 4) at `localhost:3000`
- PostgreSQL 17.10 via Scoop at `localhost:5432`
  - Role: `myexpense` / password: `myexpense_dev` / DB: `myexpense_dev`
- Better-Auth 1.6.11 email/password auth (verification disabled)
- Session guard: `proxy.ts` — `/dashboard` and `/expenses/:path*` without cookie redirect to `/login`
- All protected server components double-check session with `auth.api.getSession()`
- Two test accounts in DB: `user-a@test.com` / `user-b@test.com` (password: `password123`)
- `npm run typecheck` — clean
- `npm run lint` — clean (ESLint flat config, `eslint-config-next/core-web-vitals` + TypeScript rules)
- `npm run build` — passes
- **VPS deploy live at https://myexpense.srv1488589.hstgr.cloud** ✓ (Phase 4 — deployed and verified 2026-05-19)
- GitHub: `https://github.com/aidihamid-ui/MyExpense.git` — up to date

**Phase 4 — COMPLETE:**

_Schema (migration 0002):_
- `receipts` table: id, userId (→ users.id cascade delete), imagePath, originalName, mimeType, sizeBytes, status (default 'pending'), rawOcrText, extractedDataJson, error, createdAt
- `expenses.receiptId` optional FK → receipts.id (set null on delete)

_Upload action (`lib/actions/receipts.ts`):_
- `uploadReceiptAction(formData)` — validates session, presence, 5MB max, MIME whitelist (JPEG/PNG/WebP/PDF), magic bytes, EXIF strip (sharp default, ADR-024), UUID filename, mkdir -p, write, DB insert
- Returns `{ ok: true, data: { receiptId } }` or `{ ok: false, error: { code, message } }`

_Query layer (`lib/db/queries.ts`):_
- `createReceipt(userId, data)` — inserts receipts row
- `getReceiptById(userId, receiptId)` — filters by userId (multi-tenancy boundary)
- `getExpenses` — updated to include `receiptId` in select

_Receipt serving route (`app/api/receipts/[id]/route.ts`):_
- Session check → 401; ownership via `getReceiptById` → 404; path traversal guard (path.resolve + sep); stream as Blob; `Cache-Control: private, no-store`

_Env (`lib/env.ts`, Dockerfile):_
- `STORAGE_PATH: z.string().min(1)` — no default; must be set. `.env.local` and `.env.example` already had it.
- Dockerfile builder stage: `ENV STORAGE_PATH=/tmp/receipts`

_UI:_
- `/expenses/new` — optional file input; two-step submit (upload first → receiptId → create); shows uploading/done/error state (ADR-023)
- `/expenses` list — "Receipt" link (opens in new tab) when `receiptId` is set; shown in both desktop table and mobile cards

_Docs:_
- `docs/architecture.md` — ADR-023 (two-step upload pattern) and ADR-024 (sharp EXIF default) added
- `docs/integration-map.md` — sections 14 (upload action), 15 (serving route), 16 (STORAGE_PATH) added

_Dependencies added:_
- `sharp@^0.34.5`

**Phase 3 — COMPLETE:**

_Query layer (`lib/db/queries.ts`):_
- `getDashboardSummary(userId, now)` — currentMonthTotal, lastMonthTotal, last30DaysTotal; all boundaries computed in MYT (UTC+8) from `now: Date` (ADR-020)
- `getCategoryBreakdown(userId, from, to)` — array of {categoryId, categoryName, total, count} ordered by total desc; uncategorized grouped as 'uncategorized'
- `getFilteredExpenseSummary(userId, from, to, categoryId?)` — {total, count} for the active filter
- `getUserCategories` — alias for existing `getCategories`
- Imports extended: `count, gte, lt, lte, sum` from drizzle-orm

_Dashboard page (`app/dashboard/page.tsx`):_
- Server Component; reads `searchParams` (Promise in Next.js 16) for `from`, `to`, `categoryId`
- Zod `safeParse` validation — invalid params fall back to MYT current-month defaults silently (ADR-019)
- Row 1: 3 metric cards — This Month, Last 30 Days, Filtered Total (all formatted `RM X,XXX.XX`)
- Row 2: FilterBar client component
- Row 3: Category breakdown table — Category | Amount | Transactions | % of Total; empty state message
- `formatRM()` helper — `en-MY` locale, 2 decimal places

_Filter bar (`app/dashboard/filter-bar.tsx`):_
- Client Component; controlled state (`useState`) initialized from server props (ADR-022)
- From/to date inputs, category dropdown (controlled Radix Select, no `name` prop — ADR-021)
- Apply → `router.push('/dashboard?from=...&to=...&categoryId=...')`
- Reset → `router.push('/dashboard')` + resets local state to MYT defaults

_Nav (`components/nav.tsx`):_
- Sign Out button added to right side; calls `authClient.signOut()` → `router.push('/login')`
- `logout-button.tsx` in `app/dashboard/` is now unused (kept for reference; delete later if desired)

_Docs:_
- `docs/architecture.md` — ADRs 019–022 added
- `docs/integration-map.md` — created; reference card for all integration points
- `CLAUDE.md` — integration-map.md added to Document Map

**Phase 2 — COMPLETE (all sessions):**

_DB layer:_
- `categories` + `expenses` tables in schema and DB (migration 0001 applied locally; VPS on Phase 2 schema)
- `seedDefaultCategories(userId)` — idempotent, fires via `databaseHooks.user.create.after`
- `lib/db/queries.ts` — full CRUD with userId filter on all operations
- `lib/validators/expense.ts` — `createExpenseSchema` + `updateExpenseSchema`

_UI layer:_
- `/expenses` — paginated list (20/page prev/next), desktop table + mobile cards, empty state, Edit + Delete per row
- `/expenses/new` — add form (amount, category, date, payment method, note), field-level Zod errors
- `/expenses/[id]/edit` — pre-filled edit form, same validation; wrong-owner → 404
- Delete confirmation modal (`components/delete-expense-button.tsx`) — `revalidatePath` + `router.refresh()` on success
- `lib/actions/expenses.ts` — `createExpenseAction`, `updateExpenseAction`, `deleteExpenseAction`
- Tagged `v0.2-expenses-done`

_Security (verified):_
- user-b visiting `/expenses/[user-a-id]/edit` → HTTP 404
- Query layer: `getExpenseById(user-b-id, user-a-expense-id)` → 0 rows → delete blocked → expense intact

**For startup commands and the full local env runbook, see `Docs/environment.md`.**
**For VPS deploy and future deploys, see `Docs/deployment.md`.**

### Phase 5c — COMPLETE (2026-05-22)

_Schema (`lib/db/schema.ts`):_
- `ocrJobs` table: id (uuid PK), receiptId (uuid FK→receipts cascade), status (pending|processing|done|failed), attempts (int, default 0), scheduledFor (timestamp, default now()), lastError (text nullable)

_Queries (`lib/db/queries.ts`):_
- `claimNextOcrJob()` — atomically claims one pending job (FOR UPDATE SKIP LOCKED), returns job row + imagePath or null
- `markOcrJobDone(jobId, receiptId, ocrText)` — sets job done, receipt completed + rawOcrText
- `markOcrJobFailed(jobId, receiptId, error, attempts)` — if attempts ≥ 3: permanent fail; else: reschedule +30s with attempts+1

_Worker (`lib/worker.ts`):_
- Polls every 5s via `setInterval`
- Calls `PaddleOcrProvider.extractFromImage` on claimed jobs
- Logs each event: claimed | done | failed
- Graceful shutdown on SIGTERM/SIGINT

_Migration:_
- `lib/db/migrations/0003_misty_emma_frost.sql` — generated, **NOT applied yet** (apply in Phase 5e with `make migrate`)

_Note:_ All `db:*` scripts now use `node_modules/drizzle-kit/bin.cjs` directly (fixed — see `Docs/environment.md` § Database Scripts).

---

### Phase 5b — COMPLETE (2026-05-22)

_OcrProvider interface (`lib/ocr/provider.ts`):_
- `OcrResult { text: string; lines: string[] }`
- `OcrProvider { extractFromImage(imagePath: string): Promise<OcrResult> }`

_PaddleOcrProvider (`lib/ocr/paddle.ts`):_
- Reads `env.OCR_SERVICE_URL` and `env.OCR_SECRET`
- `POST {OCR_SERVICE_URL}/ocr` with body `{ path: imagePath }` and `X-OCR-Secret` header
- Non-200 response → `Error('OCR service returned <status>')`
- Network failure → `Error('OCR service unreachable: ...')`
- No retry logic (retries go in Phase 5c worker)

_Env (`lib/env.ts`):_
- `OCR_SERVICE_URL: z.url().optional()` added

_Docs:_
- `Docs/integration-map.md` — section 18 added (OcrProvider usage pattern)

---

### Phase 5a — COMPLETE on VPS (2026-05-20)

_OCR sidecar (`ocr-service/`):_
- `Dockerfile` — python:3.11-slim, apt deps for OpenCV/libGL, pip install, uvicorn CMD bound to `0.0.0.0:8001`
- `requirements.txt` — fastapi, uvicorn, paddlepaddle==2.6.2 (CPU), paddleocr==2.9.1, Pillow
- `main.py` — env validation at startup (STORAGE_PATH + OCR_SECRET required, exit 1 if missing); PaddleOCR singleton loaded once in FastAPI lifespan; `/health` (no auth); `/ocr` POST (X-OCR-Secret header auth + `os.path.realpath` path traversal guard)

_docker-compose.yml changes:_
- `ocr-service` service added: no `ports:`, STORAGE_PATH mounted `:ro`, `paddleocr_cache` named volume at `/root/.paddleocr`
- `app.depends_on` extended to include `ocr-service: condition: service_started`
- `app` env: `OCR_SECRET`, `OCR_PROVIDER` (default: `paddle`) added
- `paddleocr_cache` named volume added

_Docs:_
- `Docs/architecture.md` — ADR-025 appended (OCR binds 0.0.0.0 inside container, no ports published)

### What's broken or incomplete

- Backup cron not yet set up on VPS (see `Docs/deployment.md` — Automated daily backup section)
- `app/dashboard/logout-button.tsx` is now unused (Sign Out moved to Nav); can be deleted when convenient

### Phase 5a VPS verification — COMPLETE (2026-05-20)

All 5 tests passed via `docker compose exec app sh`:

| Test | Expected | Result |
|---|---|---|
| `GET /health` | `{"status":"ok"}` | ✓ |
| `POST /ocr` no secret | 401 | ✓ |
| `POST /ocr` wrong secret | 401 | ✓ |
| `POST /ocr` path="/etc/passwd" | 400 | ✓ |
| `POST /ocr` path outside STORAGE_PATH | 400 | ✓ |

**Field name correction for Phase 5b:** POST /ocr request body field is `"path"`, not `"image_path"`. `phases.md` spec had a typo. See integration-map §17.

**Phase 5b critical flag:** `OCR_SERVICE_URL` must be `http://ocr-service:8001` — NOT `http://localhost:8001` (ADR-025).

### Phase 4 Test Checklist Status

- [x] `npm run typecheck` clean
- [x] `npm run lint` clean
- [x] `npm run build` passes (2 Turbopack warnings about dynamic path.join — expected, not errors)
- [x] No session → 401 on `/api/receipts/[id]` (verified via curl)
- [x] Authenticated + guessed receipt ID → 404 (verified via curl)
- [ ] Upload 5 receipts of different sizes/formats — **needs manual browser test**
- [ ] Try uploading `.exe` (must reject) — **needs manual browser test**
- [ ] Try uploading 10 MB file (must reject) — **needs manual browser test**
- [ ] Direct filesystem path access without session → 401 — verified above
- [ ] User A can't access User B's receipt by guessing ID → 404 — verified above (no-match query)

### Last known-good git state

- Branch: master
- Last tag: `v0.4-uploads-done`
- Last commit: `819c5c9` — [Phase 5c] docs: update environment.md database scripts section

---

## What Was Done — Phase 5a (2026-05-20)

- `ocr-service/Dockerfile` — python:3.11-slim, apt OpenCV deps, pip install, uvicorn CMD on `0.0.0.0:8001`
- `ocr-service/requirements.txt` — updated with paddlepaddle==2.6.2 (CPU), paddleocr==2.9.1, Pillow
- `ocr-service/main.py` — env validation at startup (STORAGE_PATH + OCR_SECRET), PaddleOCR singleton in FastAPI lifespan, `/health`, `/ocr` with secret auth + path traversal guard
- `docker-compose.yml` — ocr-service added (no ports, STORAGE_PATH :ro, paddleocr_cache volume); app.depends_on extended; OCR_SECRET + OCR_PROVIDER added to app env
- `Docs/architecture.md` — ADR-025 appended
- `Docs/handoff.md` — Phase 5a state, VPS verification steps, test checklist
- `CLAUDE.md` — Rule 8 updated for Docker context (ADR-025)

---

## What Was Done — Phase 4 (this session)

- `receipts` table + `expenses.receiptId` schema; migration 0002 generated and applied locally + on VPS
- `uploadReceiptAction` in `lib/actions/receipts.ts` — full validation pipeline (session, size, MIME, magic bytes, EXIF strip via sharp, UUID filename, DB insert)
- `getReceiptById` + `createReceipt` added to `lib/db/queries.ts`; `getExpenses` updated to include `receiptId`
- `GET /api/receipts/[id]` route — auth, ownership (404), path traversal guard, Blob stream, `Cache-Control: private, no-store`
- `STORAGE_PATH: z.string().min(1)` in `lib/env.ts`; `ENV STORAGE_PATH=/tmp/receipts` in Dockerfile builder
- Expense form updated: optional file input, two-step submit, upload state UI
- Expenses list: Receipt link on desktop table and mobile cards
- `sharp@^0.34.5` added
- ADR-023 (two-step upload), ADR-024 (sharp EXIF default); integration-map §14–16
- Tagged `v0.4-uploads-done`, pushed to GitHub
- Deployed to VPS — `STORAGE_PATH` added to `.env`, `/var/lib/myexpense/receipts` created, `make deploy` + `make migrate` run, HTTP/2 200 verified

### VPS deploy note
`make migrate` exits silently when nothing to apply — this is normal, not an error. Migration 0002 was confirmed applied via `drizzle.__drizzle_migrations` (3 rows) and `\dt` (receipts table present).

---

## What Was Done — Phase 3 (this session)

- **Query layer** — 4 new functions in `lib/db/queries.ts`; MYT timezone math in `getDashboardSummary`
- **Dashboard page** — full rewrite: real data, Zod URL param validation, 3 metric cards, filter bar, category breakdown table
- **Filter bar** — new `app/dashboard/filter-bar.tsx`; Client Component, controlled state, router.push navigation
- **Nav** — Sign Out button added to right side; `authClient.signOut()` → redirect
- **ADRs 019–022** written in `docs/architecture.md`
- **`docs/integration-map.md`** created — integration point reference card for future phases
- **CLAUDE.md** — integration-map.md added to Document Map
- `npm run typecheck` clean, `npm run lint` clean, `npm run build` passes
- Tagged `v0.3-dashboard-done`, pushed

### Phase 3 Test Checklist Status

Tests listed in `docs/phases.md` — **ALL PASSED** (verified 2026-05-19):
- [x] Numbers add up exactly to expense list totals
- [x] Date filters work across a month boundary
- [x] Two accounts: each sees only their own numbers

**Post-commit bug fixed:** Newer Radix Select forbids `value=""` on `<SelectItem>` — crashed the page on load. Fixed across all 3 affected forms (filter-bar, expense-form, edit-expense-form) and server action. Sentinels: `"all"` (category filter) and `"none"` (category on expense forms). This was a pre-existing regression from the shadcn/ui restyle, also hit by the new filter-bar.

---

## What Was Done — Phase 2 Session 3 (final)

- `app/expenses/[id]/edit/page.tsx` — edit page
- `app/expenses/[id]/edit/edit-expense-form.tsx` — pre-filled client form
- `lib/actions/expenses.ts` — `updateExpenseAction` + `deleteExpenseAction`
- `components/delete-expense-button.tsx` — Delete button + confirmation modal
- ESLint setup: `eslint.config.mjs`, `npm run lint` script
- ADRs 014–016 recorded
- Tagged `v0.2-expenses-done`, pushed

## What Was Done — UI pre-work (between Phase 2 and Phase 3)

- shadcn/ui installed and all pages restyled (commit 378f80e)
- ADR-017 and ADR-018 recorded

---

## Next Up — Phase 5d: Receipt Parser

Phase 5c is complete. `ocr_jobs` table + worker are ready.

Phase 5d: receipt parser — regex extraction (RM/Total/Jumlah amounts) from `rawOcrText`, populate `receipts.extractedDataJson`.
Phase 5e: review UI with polling status + wire worker into docker-compose, apply migration 0003 on VPS.

---

## Open Questions / Blockers

- [x] Deploy Phase 3 to VPS — done 2026-05-19 ✓
- [x] Phase 4 complete locally and on VPS ✓ (2026-05-19)
- [x] Phase 5a complete locally ✓ (2026-05-20)
- [x] Phase 5a verified on VPS ✓ (2026-05-20) — all 5 tests passed
- [ ] Manual browser test checklist for Phase 4 (5 formats, .exe rejection, 10MB rejection)
- [ ] Set up backup cron on VPS (`Docs/deployment.md` → Automated daily backup)
- [ ] ADR-013 revisit: 4 protected pages now — approaching the "5 pages" revisit trigger for route group layout
- [ ] `app/dashboard/logout-button.tsx` is now unused — can delete
