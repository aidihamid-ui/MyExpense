# Handoff

**Read this at the start of every Claude Code session.** It's the single source of truth for where the project stands right now.

**Last updated:** 2026-05-17
**Last session by:** Claude
**Current phase:** Phase 1 — Auth (COMPLETE)

---

## Current State

### What's working

- Next.js 16.2.6 (App Router, TypeScript strict, Tailwind 4) at `localhost:3000`
- PostgreSQL 17.10 via Scoop at `localhost:5432`
  - Role: `myexpense` / password: `myexpense_dev` / DB: `myexpense_dev`
- Better-Auth 1.6.11 email/password auth (verification disabled)
  - Signup: `POST /api/auth/sign-up/email`
  - Login: `POST /api/auth/sign-in/email`
  - Logout: `POST /api/auth/sign-out`
- Session guard: `proxy.ts` → `/dashboard` without cookie redirects to `/login?next=/dashboard`
- Dashboard server component: double-checks session with `auth.api.getSession()`, redirects if null
- Two test accounts in DB: `user-a@test.com` / `user-b@test.com` (password: `password123`)
- Sessions persisted in Postgres `session` table — survive server restarts
- `npm run typecheck` — clean
- `npm run build` — passes
- 8 commits, tagged `v0.1-auth-working`

**For startup commands and the full local env runbook, see `Docs/environment.md`.**

### What's broken or incomplete

- No GitHub remote — repo is local only
- PaddleOCR not installed (deferred to Phase 5; needs Python 3.11)
- No lint config yet (ESLint not set up from scaffold — non-blocking)

### Last known-good git state

- Branch: master
- Last commit: `f7e0694` — `[Phase 1] feat: proxy.ts session guard for /dashboard`
- Last tag: `v0.1-auth-working`

---

## What Was Done This Session

- Created `lib/db/schema.ts` — 4 Better-Auth tables: `user`, `session`, `account`, `verification` (camelCase columns, `camelCase: true` adapter config)
- Generated and applied Drizzle migration (`lib/db/migrations/0000_wonderful_kree.sql`)
- Created `lib/db/queries.ts` — audit boundary shell for Phase 2+
- Fixed `db:generate` / `db:migrate` scripts to use `node --env-file=.env.local` (drizzle-kit doesn't auto-load `.env.local`)
- Created `lib/auth/index.ts` — `betterAuth()` with `drizzleAdapter`, emailAndPassword enabled
- Created `lib/auth/client.ts` — `createAuthClient()` for client components
- Created `app/api/auth/[...all]/route.ts` — Better-Auth catch-all via `toNextJsHandler`
- Added `BETTER_AUTH_URL` to `lib/env.ts`, `.env.local`, `.env.example`
- Created `app/(auth)/layout.tsx`, `login/page.tsx`, `signup/page.tsx` — client forms
- Created `app/dashboard/page.tsx` (server, session-checked) + `logout-button.tsx` (client)
- Created `proxy.ts` (Next.js 16 replaces `middleware.ts`) — cookie presence guard for `/dashboard`
- Verified: two test accounts created, login/logout works, redirect on unauthenticated access confirmed
- **Key discovery:** Next.js 16 renamed `middleware.ts` → `proxy.ts`; runs Node.js runtime (not Edge)

---

## Next Up (in priority order)

1. **Phase 1.5 — First VPS Deploy.** Provision Hostinger VPS, set up Nginx + SSL, deploy.
2. **Phase 2 — Manual Expense Entry.** Schema: `categories`, `expenses`. Add/edit/delete form.

---

## Open Questions / Blockers

- [ ] GitHub repo not yet created — user needs `git remote add origin <url>` and push
- [ ] Domain registered? (needed for Phase 1.5)
- [ ] Hostinger VPS plan confirmed? (KVM 2 minimum, 2GB RAM)
- [ ] PaddleOCR on Python 3.14: unknown. Needs Python 3.11 for Phase 5 (`py -3.11`)

---

## Decisions Made This Session

- **`proxy.ts` instead of `middleware.ts`**: Next.js 16 deprecates `middleware`; `proxy.ts` is the new convention, runs in Node.js runtime (better for Better-Auth's server-side calls).
- **Cookie presence check in proxy (not DB call)**: Fast path redirect. Real DB-backed session check is inside `dashboard/page.tsx` (double-enforcement per Next.js proxy guidance).
- **`camelCase: true` in drizzle adapter**: Keeps Drizzle column names in camelCase to match Better-Auth's internal field names exactly. No snake_case mapping needed.
- **`node --env-file=.env.local` in db scripts**: drizzle-kit doesn't load `.env.local`; Node 20+ `--env-file` is the clean fix without adding a dotenv dependency.
- **No lint setup yet**: `create-next-app` scaffold didn't include ESLint config. Not blocking Phase 2.
