@AGENTS.md

# CLAUDE.md

Loaded at the start of every Claude Code session. Keep tight; detail lives in `docs/`.

---

## Project: MyExpense

Self-hosted multi-user expense tracker for **6 users max** (me + family/friends). Manual entry + receipt OCR (PaddleOCR). Built locally first, deployed to Hostinger VPS at Phase 1.5.

**Scale boundary: 6 users.** Anything that only makes sense at 1000+ users (Redis, microservices, Kubernetes, GraphQL, event sourcing) is out of scope. Choose boring solutions.

**Stack:** Next.js 15 (App Router, Server Actions) · TypeScript strict · PostgreSQL 17 · Drizzle · Better-Auth · Tailwind · PaddleOCR via FastAPI sidecar on `localhost:8001` · Local filesystem for receipts · PM2 + Nginx + Let's Encrypt in prod only.

Pluggable `OcrProvider` interface (env var `OCR_PROVIDER=paddle|claude|openai`).

---

## CRITICAL RULES — never violate

1. **Multi-tenancy:** Every query returning user data MUST filter by `userId` from session. Use helpers in `lib/db/queries.ts`.
2. **Receipt serving:** Files at `{STORAGE_PATH}` (`./var/receipts/` local, `/var/lib/myexpense/receipts/` prod) NEVER served by Nginx directly. Only via auth-checked Next.js route that verifies `receipt.userId === session.userId`.
3. **Input validation:** Every server action and route handler validates with Zod before touching the DB.
4. **No raw SQL string interpolation.** Drizzle parameterized only.
5. **No secrets in client code.** Server-side only.
6. **No `.env` files committed.** `.gitignore` blocks them.
7. **File uploads:** Validate MIME + magic bytes + 5MB max. UUID filenames.
8. **OCR service:** Python FastAPI binds to `127.0.0.1` only. Validate image paths stay within `STORAGE_PATH`.
9. **Authorization on mutations:** Verify ownership BEFORE mutating.
10. **No `dangerouslySetInnerHTML`.**

---

## Document Map

Read these as needed for the current task:

| File | What's in it | Read when... |
|---|---|---|
| `CLAUDE.md` (this) | Identity, critical rules, session protocol | Every session (auto-loaded) |
| `docs/handoff.md` | Where the project is right now | Start of every session |
| `docs/build-plan.md` | Features, architecture, data flow, schema | Once at project start; refer back as needed |
| `docs/phases.md` | Phase-by-phase build steps | Start of each phase |
| `docs/conventions.md` | Coding conventions (TS, errors, naming) | When unsure about a code style |
| `docs/subagent-rules.md` | DeepSeek delegation rules | Before delegating anything |
| `docs/git-workflow.md` | Branches, commits, tags, recovery | When working with git or recovering from a mistake |
| `docs/master-prompts.md` | Reusable prompts (security review, deploy, etc.) | When user invokes one |
| `docs/architecture.md` | Architectural decision records (ADRs) | When making/reviewing a structural choice |
| `docs/security-log.md` | Security findings and fixes | After security reviews |
| `docs/deployment.md` | VPS runbook (created at Phase 1.5) | Before any prod deploy |

When unsure which doc to update, ASK before writing.

---

## File Structure (high level)

```
~/code/myexpense/
├── CLAUDE.md, README.md, .nvmrc, .env.example, .gitignore
├── docs/                  ← all reference docs above
├── app/                   ← Next.js App Router
├── lib/
│   ├── env.ts             ← typed env validation (Zod)
│   ├── db/queries.ts      ← ALL user-data queries (the audit boundary)
│   ├── validators/        ← Zod schemas
│   ├── auth/, ocr/
├── ocr-service/           ← Python FastAPI sidecar
├── components/, public/
└── var/                   ← gitignored; mimics /var/lib/myexpense in prod
```

---

## Subagent (DeepSeek) — summary

DeepSeek is cheaper/faster but makes NO decisions. Claude orchestrates and reviews every line before commit.

**Delegate:** boilerplate, tests for existing functions, mechanical refactors, migration files from a schema Claude designed, mock data.

**NEVER delegate:** auth, `lib/db/queries.ts`, `lib/env.ts`, multi-tenancy logic, file upload handling, receipt serving, OCR orchestration, schema design, security reviews, non-obvious debugging.

Full rules: `docs/subagent-rules.md`.

---

## Session Protocol

**START:**
1. Read this file + `docs/handoff.md`
2. `git status` && `git log --oneline -10` — verify clean state
3. Confirm with user what we're working on before writing code

**DURING:**
- One phase at a time, no drift
- Update `docs/architecture.md` immediately when an architectural decision is made
- Commit at each working state
- Stuck >15 min → STOP and discuss approach with user

**END:**
1. Run typecheck and lint
2. Commit or stash uncommitted work
3. Update `docs/handoff.md` (current state, what was done, what's next, blockers, decisions)
4. If phase complete: tag (`v0.X-...`) and push
5. Push to GitHub

---

## When to STOP and Ask

Before doing any of:
- Install new dependency (especially native bindings)
- Schema change requiring data migration
- Touching `lib/auth/`, `lib/db/queries.ts`, `lib/env.ts`, or receipt route
- Changing OCR parsing/storage or `OcrProvider` interface
- Adding a new env var
- Changing build/deploy/PM2 config
- Adding a new top-level folder

Better to ask once than refactor twice.

---

## Commit Format

`[Phase N] feat|fix|chore|docs|refactor: short description`

Examples:
- `[Phase 2] feat: add expense edit form`
- `[Phase 5] fix: handle PaddleOCR timeout in worker`

Full git workflow: `docs/git-workflow.md`.

---

## "Done" Definition (per phase)

A phase isn't done until:
1. Feature works end-to-end locally with two test accounts
2. Multi-tenancy verified (account A can't see B's data — tried via UI + direct API + guessed IDs)
3. All inputs validated server-side with Zod
4. Errors handled and surfaced to user
5. Mobile-responsive (375px width)
6. `npm run typecheck` && `npm run lint` clean
7. Committed with clear messages
8. `docs/handoff.md` updated
9. Phase milestone → tagged in git
10. Phase 2+ → deployed to VPS, verified on live domain
