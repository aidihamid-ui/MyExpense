# Handoff

**Read this at the start of every Claude Code session.** It's the single source of truth for where the project stands right now.

**Last updated:** 2026-05-17
**Last session by:** Claude
**Current phase:** Phase 0 — Local Setup (COMPLETE)

---

## Current State

### What's working

- Next.js 16.2.6 scaffold (App Router, TypeScript strict, Tailwind 4)
- PostgreSQL 17.10 running via Scoop at `localhost:5432`
  - Role: `myexpense` / password: `myexpense_dev`
  - DB: `myexpense_dev`
  - Start: `pg_ctl -D ~/scoop/apps/postgresql17/current/data start`
- OCR service skeleton: `http://127.0.0.1:8001/health` → `"ok"`
  - Start: `cd ocr-service && venv/Scripts/uvicorn main:app --host 127.0.0.1 --port 8001`
- `npm run typecheck` — clean (no errors)
- Git repo initialized, 4 commits, tagged `v0.0-scaffold`
- `lib/env.ts` — Zod-validated env (throws at boot if vars missing)
- `lib/db/index.ts` — Drizzle instance (no schema yet)
- `.env.local` — has correct local values (gitignored)

### What's broken or incomplete

- `npm run dev` not yet verified end-to-end in browser (typecheck passes)
- `lib/db/schema.ts` does not exist yet — needed before `npm run db:generate`
- PaddleOCR not installed (deferred to Phase 5; Python 3.14 compatibility unknown)
- No GitHub remote — repo is local only

### Last known-good git state

- Branch: master
- Last commit: `83dd199` — `[Phase 0] chore: var/ receipt storage + env example + gitignore fixes`
- Last tag: `v0.0-scaffold`

---

## What Was Done This Session

- Installed PostgreSQL 17 via Scoop (EDB CDN was 403-blocked on winget/direct download)
- Initialized git repo with local identity (`aidih@myexpense.local`)
- Scaffolded Next.js 16 via `create-next-app@latest` in temp dir (uppercase `MyExpense` dir name blocked in-place creation)
- Restored `CLAUDE.md` with project rules (create-next-app had overwritten it with `@AGENTS.md`)
- Installed: `drizzle-orm`, `drizzle-kit`, `pg`, `@types/pg`, `better-auth`, `zod`, `tsx`
- Created: `lib/env.ts`, `lib/db/index.ts`, `drizzle.config.ts`
- Created: `ocr-service/main.py`, `ocr-service/requirements.txt`, Python venv
- Created: `var/receipts/.gitkeep`, `.env.example`, `.env.local`
- Fixed `.gitignore` patterns for `var/`, `.env.example`, `.claude/`
- 4 commits + `v0.0-scaffold` tag

---

## Next Up (in priority order)

1. **Phase 1 — Auth.**
   - Drizzle schema: `users`, `sessions` tables
   - Better-Auth configured (email/password; verification disabled)
   - Signup page, login page, logout button
   - Session middleware protecting `/dashboard`
   - Two test accounts: user-a@test.com, user-b@test.com
2. **Phase 1.5 — First VPS Deploy.** After auth works locally.

---

## Open Questions / Blockers

- [ ] GitHub repo not yet created — user needs to create repo and `git remote add origin <url>` and push
- [ ] PaddleOCR on Python 3.14: unknown. Will need Python 3.11 install for Phase 5 (use `py -3.11` on Windows)
- [ ] Domain registered? Where? (needed for Phase 1.5)
- [ ] Hostinger VPS plan confirmed? (KVM 2 minimum, 2GB RAM)

---

## Decisions Made This Session

- **PostgreSQL 17 instead of 16**: winget only has 17+; Scoop has 16 but 17 chosen (trivial difference, same Drizzle support).
- **Next.js 16 instead of 15**: `create-next-app@latest` installed Next.js 16.2.6. No breaking changes for our usage. CLAUDE.md updated.
- **Git on `master` branch**: default; will not rename unless user prefers.
- **PostgreSQL installed via Scoop**: EDB CloudFront CDN returned 403 for both winget and direct download. Scoop succeeded. Data dir: `~/scoop/apps/postgresql17/current/data`.

---

## Notes for Next Session

- **PostgreSQL must be started each session** (not registered as Windows service yet):
  ```bash
  export PATH="$HOME/scoop/apps/postgresql17/current/bin:$PATH"
  pg_ctl -D ~/scoop/apps/postgresql17/current/data -l ~/scoop/apps/postgresql17/current/data/pg.log start
  ```
  Or register as a service once (elevated PowerShell):
  ```
  pg_ctl register -N PostgreSQL -D C:\Users\aidih\scoop\apps\postgresql17\current\data
  net start PostgreSQL
  ```
- **OCR service**: `cd ocr-service && venv/Scripts/uvicorn main:app --host 127.0.0.1 --port 8001`
- **Next.js**: `npm run dev` → `localhost:3000`
