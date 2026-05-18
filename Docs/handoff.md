# Handoff

**Read this at the start of every Claude Code session.** It's the single source of truth for where the project stands right now.

**Last updated:** 2026-05-18
**Last session by:** Claude
**Current phase:** Phase 2 — Manual Expense Entry (list + add form done; edit/delete pending)

---

## Current State

### What's working

- Next.js 16.2.6 (App Router, TypeScript strict, Tailwind 4) at `localhost:3000`
- PostgreSQL 17.10 via Scoop at `localhost:5432`
  - Role: `myexpense` / password: `myexpense_dev` / DB: `myexpense_dev`
- Better-Auth 1.6.11 email/password auth (verification disabled)
- Session guard: `proxy.ts` → `/dashboard` and `/expenses` without cookie redirect to `/login`
- Dashboard + Expenses server components: double-check session, redirect if null
- Two test accounts in DB: `user-a@test.com` / `user-b@test.com` (password: `password123`)
- `npm run typecheck` — clean
- `npm run build` — passes (last verified Phase 1.5; not re-run this session)
- **VPS deploy live at https://myexpense.srv1488589.hstgr.cloud** ✓
- GitHub: `https://github.com/aidihamid-ui/MyExpense.git` — up to date
- Tagged `v0.1.5-first-deploy`

**Phase 2 DB layer complete (not yet deployed):**
- `categories` + `expenses` tables in schema and DB (migration 0001 applied locally)
- `seedDefaultCategories(userId)` — idempotent, fires via `databaseHooks.user.create.after`
- `lib/db/queries.ts` — `getCategories`, `getExpenses`, `getExpenseById`, `createExpense`, `updateExpense`, `deleteExpense`
- `lib/validators/expense.ts` — `createExpenseSchema` + `updateExpenseSchema` (Zod 4)

**Phase 2 UI (Session 2) — complete:**
- `/expenses` — paginated list (20/page, prev/next), desktop table + mobile cards, empty state
- `/expenses/new` — add expense form: amount, category dropdown, date (default today), payment method, note
- `lib/actions/expenses.ts` — `createExpenseAction` server action: validates with Zod, creates expense, redirects to `/expenses`
- `components/nav.tsx` — shared nav bar (Dashboard + Expenses links) on all authenticated pages
- ADRs 012 (server actions in `lib/actions/`) and 013 (nav component vs route group) recorded

**For startup commands and the full local env runbook, see `Docs/environment.md`.**
**For VPS deploy and future deploys, see `Docs/deployment.md`.**

### What's broken or incomplete

- Phase 2 UI partially done: edit expense and delete with confirmation not yet built
- Migration 0001 applied locally only — VPS still on Phase 1 schema (`make migrate` needed after next deploy)
- PaddleOCR not installed (deferred to Phase 5; needs Python 3.11)
- No lint config yet (ESLint not set up — non-blocking)
- Backup cron not yet set up on VPS (see `Docs/deployment.md` — Automated daily backup section)

### Last known-good git state

- Branch: master
- Last commit: `d5697fc` — `[Phase 2] feat: expense list and add expense form`
- Last tag: `v0.1.5-first-deploy`

---

## What Was Done — Phase 2 UI: list + add form (this session)

- `components/nav.tsx` — shared nav bar client component (Dashboard + Expenses links)
- `app/dashboard/page.tsx` — integrated Nav, removed "Phase 2 pending" placeholder text
- `proxy.ts` — extended matcher to `/expenses/:path*`
- `lib/actions/expenses.ts` — `createExpenseAction` server action: parses FormData, validates with `createExpenseSchema`, calls `createExpense(userId, ...)`, redirects on success, returns field-level errors on failure
- `app/expenses/page.tsx` — paginated expense list (20/page, limit+1 trick for next-page detection), desktop table + mobile card layout, empty state, prev/next pagination
- `app/expenses/new/page.tsx` — server component: auth guard, fetches categories, renders client form
- `app/expenses/new/expense-form.tsx` — client component: `useActionState` with `createExpenseAction`, inline field-level Zod errors, pending state disables submit
- ADRs 012–013 recorded
- `npm run typecheck` — clean

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

## Next Up — Phase 2 UI (remaining)

- Edit expense modal — pre-filled form, validated with `updateExpenseSchema`, calls `updateExpense`
- Delete with confirmation — modal or inline confirm, calls `deleteExpense`

**Test gate (from phases.md):**
- Create 20 expenses across two accounts
- Verify multi-tenancy: from account A's browser, try `GET /api/expenses/{B-expense-id}` — must fail
- Edit and delete work; confirmation prevents accidents

**On completion:** `npm run typecheck` + `npm run build` clean → tag `v0.2-expenses-done` → deploy to VPS → `make migrate` on VPS.

---

## Open Questions / Blockers

- [ ] VPS migration pending: run `make migrate` after deploying Phase 2
- [ ] Set up backup cron on VPS (`Docs/deployment.md` → Automated daily backup)
- [ ] PaddleOCR on Python 3.14: unknown. Needs Python 3.11 for Phase 5 (`py -3.11`)
