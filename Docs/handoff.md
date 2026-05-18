# Handoff

**Read this at the start of every Claude Code session.** It's the single source of truth for where the project stands right now.

**Last updated:** 2026-05-18
**Last session by:** Claude
**Current phase:** Phase 2 — Manual Expense Entry

---

## Current State

### What's working

- Next.js 16.2.6 (App Router, TypeScript strict, Tailwind 4) at `localhost:3000`
- PostgreSQL 17.10 via Scoop at `localhost:5432`
  - Role: `myexpense` / password: `myexpense_dev` / DB: `myexpense_dev`
- Better-Auth 1.6.11 email/password auth (verification disabled)
- Session guard: `proxy.ts` → `/dashboard` without cookie redirects to `/login?next=/dashboard`
- Dashboard server component: double-checks session with `auth.api.getSession()`, redirects if null
- Two test accounts in DB: `user-a@test.com` / `user-b@test.com` (password: `password123`)
- `npm run typecheck` — clean
- `npm run build` — passes
- **VPS deploy live at https://myexpense.srv1488589.hstgr.cloud** ✓
- GitHub: `https://github.com/aidihamid-ui/MyExpense.git` — up to date
- Tagged `v0.1.5-first-deploy`

**For startup commands and the full local env runbook, see `Docs/environment.md`.**
**For VPS deploy and future deploys, see `Docs/deployment.md`.**

### What's broken or incomplete

- PaddleOCR not installed (deferred to Phase 5; needs Python 3.11)
- No lint config yet (ESLint not set up — non-blocking)
- Backup cron not yet set up on VPS (see `Docs/deployment.md` — Automated daily backup section)

### Last known-good git state

- Branch: master
- Last commit: `5114b7a` — `[Phase 1.5] docs: add make to VPS pre-flight steps`
- Last tag: `v0.1.5-first-deploy`

---

## What Was Done — Phase 1.5

- Added `output: "standalone"` to `next.config.ts`
- Created `Dockerfile` (multi-stage: deps → builder → runner + migrator target, non-root user)
- Created `.dockerignore`
- Created `docker-compose.yml` — app + postgres:17-alpine, Traefik labels, no shared network, no published ports
- Created `Makefile` — deploy, migrate, logs, backup, shell, ps
- Created `scripts/backup-db.sh` — pg_dump, gzip, 30-day retention
- Created `Docs/deployment.md` — pre-flight + full runbook
- **VPS deploy executed and verified live**
- **Fix applied:** Added build-time ENV placeholders to Dockerfile builder stage (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=placeholder`) — Next.js standalone build requires these at build time; overridden at runtime
- **Pre-flight updated:** added `apt-get install -y make` step to `Docs/deployment.md`
- ADRs 007–009 added to `Docs/architecture.md`
- Tagged `v0.1.5-first-deploy` and pushed

---

## Next Up — Phase 2: Manual Expense Entry

From `Docs/phases.md`:

- Schema: `categories` table + `expenses` table
- Seed default categories on signup (Food, Transport, Groceries, Utilities, Entertainment, Healthcare, Other)
- "Add expense" form with Zod validation (amount, category, date, note, payment method)
- Expenses list with sort (date desc) + pagination
- Edit / delete with confirmation modal
- All queries via `lib/db/queries.ts` with `userId` filter

**Test gate (from phases.md):**
- Create 20 expenses across two accounts
- Verify multi-tenancy: from account A's browser, try `GET /api/expenses/{B-expense-id}` — must fail
- Edit and delete work; confirmation prevents accidents

**Tag on completion:** `v0.2-expenses-done` → deploy to VPS.

---

## Open Questions / Blockers

- [ ] Set up backup cron on VPS (`Docs/deployment.md` → Automated daily backup)
- [ ] PaddleOCR on Python 3.14: unknown. Needs Python 3.11 for Phase 5 (`py -3.11`)
