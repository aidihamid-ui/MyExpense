# Handoff

**Read this at the start of every Claude Code session.** It's the single source of truth for where the project stands right now.

**Last updated:** 2026-05-19
**Last session by:** Claude
**Current phase:** Phase 3 COMPLETE. Dashboard live with real data and filters.

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
- **VPS deploy live at https://myexpense.srv1488589.hstgr.cloud** ✓ (Phase 2; Phase 3 deploy pending)
- GitHub: `https://github.com/aidihamid-ui/MyExpense.git` — up to date

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
- Phase 3 **not yet deployed to VPS** — pending `make deploy` + `make migrate` (no schema changes in Phase 3, so `make migrate` is a no-op but should still be run per the runbook)
- `app/dashboard/logout-button.tsx` is now unused (Sign Out moved to Nav); can be deleted when convenient

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

Tests listed in `docs/phases.md`:
- [ ] Numbers add up exactly to expense list totals — **run manually with test accounts**
- [ ] Date filters work across a month boundary — **run manually**
- [ ] Two accounts: each sees only their own numbers — **run manually** (enforced at query layer; `getCategoryBreakdown`, `getFilteredExpenseSummary`, `getDashboardSummary` all filter strictly by userId)

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

## Next Up — Phase 4: Receipt Upload (no OCR yet)

From `Docs/phases.md`:
- File upload endpoint with MIME + magic bytes + 5MB max validation
- Save to `{STORAGE_PATH}/{userId}/{uuid}.{ext}`; strip EXIF
- `receipts` table; attach to expense form
- Auth-checked receipt serving route `/api/receipts/[id]`

**Pre-work needed before Phase 4 starts:**
1. Deploy Phase 3 to VPS: `make deploy` (no `make migrate` needed — no schema changes)
2. Verify live dashboard at https://myexpense.srv1488589.hstgr.cloud

**On completion:** tag `v0.4-uploads-done` → deploy.

---

## Open Questions / Blockers

- [ ] Deploy Phase 3 to VPS (Phase 4 pre-work)
- [ ] Run Phase 3 test checklist manually (see above)
- [ ] Set up backup cron on VPS (`Docs/deployment.md` → Automated daily backup)
- [ ] PaddleOCR on Python 3.14: unknown. Needs Python 3.11 for Phase 5 (`py -3.11`)
- [ ] ADR-013 revisit: 4 protected pages now — approaching the "5 pages" revisit trigger for route group layout
- [ ] `app/dashboard/logout-button.tsx` is now unused — can delete
