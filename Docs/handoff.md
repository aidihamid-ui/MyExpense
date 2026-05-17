# Handoff

**Read this at the start of every Claude Code session.** It's the single source of truth for where the project stands right now.

**Last updated:** 2026-05-18
**Last session by:** Claude
**Current phase:** Phase 1.5 — VPS Deploy (files done, VPS deploy PENDING)

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
- `npm run build` — passes (confirm locally after `output: standalone` was added)
- GitHub remote: `https://github.com/aidihamid-ui/MyExpense.git` — pushed ✓
- All Phase 1.5 Docker files committed and pushed (`b414f4c`)

**For startup commands and the full local env runbook, see `Docs/environment.md`.**
**For VPS deploy steps, see `Docs/deployment.md`.**

### What's broken or incomplete

- **VPS deploy not yet executed** — all files are ready, nothing has been run on the server yet
- PaddleOCR not installed (deferred to Phase 5; needs Python 3.11)
- No lint config yet (ESLint not set up — non-blocking)

### Last known-good git state

- Branch: master
- Last commit: `b414f4c` — `[Phase 1.5] feat: Docker + Traefik deploy setup`
- Last tag: `v0.1-auth-working` (Phase 1.5 tag `v0.1.5-first-deploy` pending VPS verification)

---

## What Was Done This Session

- Added `output: "standalone"` to `next.config.ts` (required for Docker)
- Created `Dockerfile` — multi-stage: deps → builder → runner (standalone, non-root) + migrator target
- Created `.dockerignore`
- Created `docker-compose.yml` — app + postgres:17-alpine, Traefik labels, no shared network, no published ports
- Created `Makefile` — deploy, migrate, logs, backup, shell, ps targets
- Created `scripts/backup-db.sh` — pg_dump via compose exec, gzip, 30-day retention
- Created `Docs/deployment.md` — full pre-flight + deploy runbook
- Created `scripts/ds-watch.js` — DeepSeek SSE watcher for live task visibility
- Committed and pushed all Phase 1.5 files to GitHub
- Added ADRs 007–009 to `Docs/architecture.md`

---

## Next Up (in priority order)

1. **Execute Phase 1.5 VPS deploy** — follow `Docs/deployment.md`:
   - Pre-flight: add swap, verify DNS, generate `BETTER_AUTH_SECRET` locally
   - SSH to VPS, clone repo, create `.env`, `docker compose up --build -d`
   - `make migrate`
   - Verify https://myexpense.srv1488589.hstgr.cloud
   - Tag `v0.1.5-first-deploy` and push
2. **Phase 2 — Manual Expense Entry.** Schema: `categories`, `expenses`. Add/edit/delete form.

---

## Open Questions / Blockers

- [ ] VPS deploy not started — user needs to SSH in and follow `Docs/deployment.md`
- [ ] After deploy: set up cron for `scripts/backup-db.sh` (line in deployment.md)
- [ ] PaddleOCR on Python 3.14: unknown. Needs Python 3.11 for Phase 5 (`py -3.11`)

---

## Decisions Made This Session

See ADRs 007–009 in `Docs/architecture.md`:
- **ADR-007:** Docker + Traefik instead of PM2 + Nginx (matches existing VPS convention)
- **ADR-008:** No shared Traefik network — host-mode Traefik routes to bridge IP directly (same as n8n on this VPS)
- **ADR-009:** Manual-only migrations — `make migrate` is an explicit step, never auto on startup
