# Handoff

**Read this at the start of every Claude Code session.** It's the single source of truth for where the project stands right now.

**Last updated:** 2026-05-19
**Last session by:** Claude
**Current phase:** Phase 4 COMPLETE. Receipt upload + serving live locally.

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

### What's broken or incomplete

- PaddleOCR not installed (deferred to Phase 5; needs Python 3.11)
- Backup cron not yet set up on VPS (see `Docs/deployment.md` — Automated daily backup section)
- Phase 4 **deployed and verified on VPS** ✓ (2026-05-19)
- `app/dashboard/logout-button.tsx` is now unused (Sign Out moved to Nav); can be deleted when convenient

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
- Last tag: `v0.3-dashboard-done`
- Last commit: see `git log --oneline -3`

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

## Next Up — Phase 5: OCR Pipeline

Phase 4 is complete locally. Before starting Phase 5:
1. Deploy Phase 4 to VPS: `make deploy` + `make migrate` (migration 0002 adds receipts table + expenses.receiptId)
2. Verify live receipt upload at https://myexpense.srv1488589.hstgr.cloud
3. Complete the manual browser test checklist (see Phase 4 Test Checklist Status above)

Phase 5 sub-steps: Python FastAPI OCR service → OcrProvider interface → Postgres job queue + worker → receipt parser → review UI.

---

## Open Questions / Blockers

- [x] Deploy Phase 3 to VPS — done 2026-05-19 ✓
- [x] Run Phase 3 test checklist — all passed ✓
- [x] Phase 4 complete locally ✓
- [x] Deploy Phase 4 to VPS — done 2026-05-19 ✓
- [ ] Manual browser test checklist for Phase 4 (5 formats, .exe rejection, 10MB rejection)
- [ ] Set up backup cron on VPS (`Docs/deployment.md` → Automated daily backup)
- [ ] PaddleOCR on Python 3.14: unknown. Needs Python 3.11 for Phase 5 (`py -3.11`)
- [ ] ADR-013 revisit: 4 protected pages now — approaching the "5 pages" revisit trigger for route group layout
- [ ] `app/dashboard/logout-button.tsx` is now unused — can delete
