# Handoff

**Read this at the start of every Claude Code session.** It's the single source of truth for where the project stands right now.

**Last updated:** 2026-05-18
**Last session by:** Claude
**Current phase:** Between Phase 2 and Phase 3. shadcn/ui install in progress; Phase 3 Dashboard next.

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
- **VPS deploy live at https://myexpense.srv1488589.hstgr.cloud** ✓
- GitHub: `https://github.com/aidihamid-ui/MyExpense.git` — up to date

**Phase 2 — COMPLETE (all sessions):**

_DB layer:_
- `categories` + `expenses` tables in schema and DB (migration 0001 applied locally; VPS still on Phase 1 schema — deploy + `make migrate` pending)
- `seedDefaultCategories(userId)` — idempotent, fires via `databaseHooks.user.create.after`
- `lib/db/queries.ts` — full CRUD with userId filter on all operations
- `lib/validators/expense.ts` — `createExpenseSchema` + `updateExpenseSchema`

_UI layer:_
- `/expenses` — paginated list (20/page prev/next), desktop table + mobile cards, empty state, Edit + Delete per row
- `/expenses/new` — add form (amount, category, date, payment method, note), field-level Zod errors
- `/expenses/[id]/edit` — pre-filled edit form, same validation; wrong-owner → 404
- Delete confirmation modal (`components/delete-expense-button.tsx`) — `revalidatePath` + `router.refresh()` on success
- `lib/actions/expenses.ts` — `createExpenseAction`, `updateExpenseAction`, `deleteExpenseAction`
- `components/nav.tsx` — shared nav bar (Dashboard + Expenses)
- ESLint configured: `eslint.config.mjs`, `npm run lint` script
- Tagged `v0.2-expenses-done`

_Security (verified):_
- user-b visiting `/expenses/[user-a-id]/edit` → HTTP 404
- Query layer: `getExpenseById(user-b-id, user-a-expense-id)` → 0 rows → delete blocked → expense intact

**For startup commands and the full local env runbook, see `Docs/environment.md`.**
**For VPS deploy and future deploys, see `Docs/deployment.md`.**

### What's broken or incomplete

- PaddleOCR not installed (deferred to Phase 5; needs Python 3.11)
- Backup cron not yet set up on VPS (see `Docs/deployment.md` — Automated daily backup section)
- shadcn/ui install in progress (pre-Phase 3 UI setup)

### Last known-good git state

- Branch: master
- Last commit: see `git log --oneline -3`
- Last tag: `v0.2-expenses-done`

---

## What Was Done — UI pre-work (between Phase 2 and Phase 3)

- Phase 2 deployed to VPS (commit 99e63b9): Dockerfile build-time ENV placeholders updated to pass Zod validation; `make deploy` + `make migrate` run on VPS — Phase 2 now live at https://myexpense.srv1488589.hstgr.cloud ✓
- ADR-017 recorded: shadcn/ui chosen as UI component library (see `Docs/architecture.md`)
- `Docs/deployment.md` Troubleshooting: added warning about Dockerfile ENV placeholder shape requirements
- shadcn/ui install in progress (Phase 3 pre-work)

---

## What Was Done — Phase 2 Session 3 (final)

- `app/expenses/[id]/edit/page.tsx` — edit page: fetches expense by `(userId, id)`, `notFound()` if missing/wrong-owner, renders pre-filled form
- `app/expenses/[id]/edit/edit-expense-form.tsx` — pre-filled client form, `updateExpenseAction`, hidden `expenseId` field, full Zod validation
- `lib/actions/expenses.ts` — added `updateExpenseAction` (validates, updates, notFound if wrong owner, redirect on success) and `deleteExpenseAction` (notFound if wrong owner, `revalidatePath` on success)
- `components/delete-expense-button.tsx` — Delete button + confirmation modal, `startTransition` + `router.refresh()` post-delete
- `app/expenses/page.tsx` — added Edit link + DeleteExpenseButton to both desktop table and mobile cards
- ESLint setup: installed `eslint` + `eslint-config-next`, created `eslint.config.mjs` (flat config, core-web-vitals + TypeScript), added `lint` script to `package.json`
- ADRs 014–016 recorded
- `npm run typecheck` clean, `npm run lint` clean, `npm run build` passes
- Phase 2 test checklist: all items pass (see security test results above)
- Tagged `v0.2-expenses-done`, pushed

## What Was Done — Phase 2 DB layer (previous session)

- Added `categories` and `expenses` tables to `lib/db/schema.ts` (camelCase columns, ADR-005)
- Generated and applied migration `0001_neat_silver_surfer.sql` locally
- Bug fixed: drizzle-kit 0.31.x emits `ON DELETE setNull` (invalid SQL) for `{ onDelete: 'setNull' }` — fixed schema to use `'set null'` and patched the generated SQL
- Created `lib/db/seed-categories.ts` — `seedDefaultCategories(userId)`, safe to call multiple times
- Hooked seed into signup via `databaseHooks.user.create.after` in `lib/auth/index.ts` (ADR-011); wrapped in try/catch so seed failure never blocks signup
- Added 6 query functions to `lib/db/queries.ts` — all require `userId` as first param, ownership verified before mutations (ADR-010)
- Created `lib/validators/expense.ts` — `createExpenseSchema` + `updateExpenseSchema` with Zod 4
- Updated `CLAUDE.md` Session Protocol START: added ADR/rule conflict-scan step
- ADRs 010 (per-user categories) and 011 (signup hooks via databaseHooks) recorded

---

## Next Up — Phase 3: Dashboard

From `Docs/phases.md`:
- Current month total + last month for comparison
- Category breakdown (table — chart in V2)
- Last 30 days running total
- Filter expenses by date range and category

**Pre-work:** Complete shadcn/ui install (in progress). VPS already on Phase 2 ✓.

**On completion:** tag `v0.3-dashboard-done` → deploy.

---

## Open Questions / Blockers

- [ ] Complete shadcn/ui install (pre-Phase 3)
- [ ] Set up backup cron on VPS (`Docs/deployment.md` → Automated daily backup)
- [ ] PaddleOCR on Python 3.14: unknown. Needs Python 3.11 for Phase 5 (`py -3.11`)
- [ ] ADR-013 revisit: 4 protected pages now (dashboard, expenses, expenses/new, expenses/[id]/edit) — approaching the "5 pages" revisit trigger for route group layout
