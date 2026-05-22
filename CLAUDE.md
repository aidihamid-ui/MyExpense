@AGENTS.md

# CLAUDE.md

Loaded at the start of every Claude Code session. Keep tight; detail lives in `Docs/`.

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
8. **OCR service:** Local dev — Python FastAPI binds to `127.0.0.1:8001`. Docker — binds `0.0.0.0:8001` inside its container with no `ports:` published (internet-unreachable; only `app` can reach it via `http://ocr-service:8001`). Always validate image paths stay within `STORAGE_PATH` using `os.path.realpath`. Auth via `X-OCR-Secret` header (ADR-025).
9. **Authorization on mutations:** Verify ownership BEFORE mutating.
10. **No `dangerouslySetInnerHTML`.**

---

## Document Map

**Mandatory at session start — read before writing any code:**

| File | What's in it |
|---|---|
| `CLAUDE.md` (this) | Identity, critical rules, session protocol (auto-loaded) |
| `Docs/handoff.md` | Current project state — what's working, what's next, open blockers |
| `Docs/integration-map.md` | Integration reference card — auth, DB, actions, env, Nav, migrations, OCR |
| `Docs/architecture.md` | All ADRs — required by Session Protocol START step 2 |

**Read at the start of each phase and before declaring phase done:**

| File | What's in it |
|---|---|
| `Docs/phases.md` | Phase-by-phase steps **and per-phase Test checklists** |

**Read on demand:**

| File | What's in it | Read when... |
|---|---|---|
| `Docs/environment.md` | How to start/stop local services; terminal layout | First session of any new day; when env breaks |
| `Docs/build-plan.md` | Features, architecture, data flow, schema | Once at project start; refer back as needed |
| `Docs/conventions.md` | Coding conventions (TS, errors, naming, Drizzle, multi-tenancy pattern) | When unsure about a code style |
| `Docs/subagent-rules.md` | DeepSeek delegation rules | Before delegating anything |
| `Docs/git-workflow.md` | Branches, commits, tags, recovery, git identity setup | When working with git or recovering from a mistake |
| `Docs/master-prompts.md` | Reusable prompts (security review, deploy, etc.) | When user invokes one |
| `Docs/deployment.md` | VPS runbook (created at Phase 1.5) | Before any prod deploy |

When unsure which doc to update, ASK before writing.

---

## File Structure (high level)

```
~/code/myexpense/
├── CLAUDE.md, README.md, .nvmrc, .env.example, .gitignore
├── Docs/                  ← all reference docs above
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

Full rules: `Docs/subagent-rules.md`.

---

## Session Protocol

**START:**
1. Read this file + `Docs/handoff.md` + `Docs/integration-map.md` + `Docs/architecture.md` (all four are mandatory — see Document Map)
2. Before writing any code: scan the session prompt against the 10 critical rules in CLAUDE.md and every ADR in `Docs/architecture.md`. If the prompt conflicts with any of them, list the conflict and wait for user response. Do not proceed until cleared. Known resolved discrepancies (Next.js version, PM2 vs Docker) do not need flagging.
3. `git status` && `git log --oneline -10` — verify clean state
4. Confirm with user what we're working on before writing code

**DURING:**
- One phase at a time, no drift
- Update `Docs/architecture.md` immediately when an architectural decision is made
- Commit at each working state
- **After completing each work checkpoint** (DB schema/queries done; server actions done; UI done; tests pass; deploy done): update the relevant docs per the **Checkpoint Docs Rule** below **before writing any code for the next checkpoint**. This is a hard stop — not a suggestion.
- Stuck >15 min → STOP and discuss approach with user

**END:**
1. Run typecheck and lint
2. **Run every check in the `### Test` section of `Docs/phases.md` for the current phase.** Every item must pass before declaring the phase done. This is non-optional — see "Done" Definition below.
3. **ADR audit.** Look back at what you built this session. Were any structural or convention choices made — runtime selections, naming conventions, casing, file-layout patterns, default behaviour applied across many call sites, library configuration that locks in a code-wide pattern? If yes, draft them as ADRs in `Docs/architecture.md` **before** writing the handoff. Be honest about the reasoning you actually used at the time, including reasoning you skipped or defaulted on. The handoff should reference ADR numbers, not just describe the decisions in prose.
4. Commit or stash uncommitted work
5. Update `Docs/handoff.md` (current state, what was done, what's next, blockers, decisions)
6. If phase complete: tag (`v0.X-...`) and push
7. Push to GitHub

---

## Checkpoint Docs Rule

After every **work checkpoint** — the completion of a discrete, named layer within a session — update the relevant docs **before writing any code for the next layer**. This is not optional and not a reminder. It is a blocking step.

**What counts as a checkpoint:** Any moment where you can say "X is now working and complete." Switching concerns is the boundary — going from DB work to server actions, from actions to UI, from UI to tests, from tests to deploy. Each transition is a checkpoint.

**Do not batch all doc updates to the end of the session.** By then context is lost and updates become vague. Write while the details are fresh.

| What changed | Update |
|---|---|
| New tables, schema changes, migrations | `Docs/architecture.md` (ADR if a structural choice was made) |
| New routes, server actions, or modules | `Docs/architecture.md` + `Docs/handoff.md` |
| Structural / convention choice made | `Docs/architecture.md` (ADR) immediately — before the next line of code |
| Phase or work checkpoint complete | `Docs/handoff.md` — reflect new state, what's next, blockers |
| Setup steps, ports, env vars changed | `Docs/environment.md` |
| Deploy runbook changed | `Docs/deployment.md` |

When unsure which doc to update, ask before writing.

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
- **Making any choice that locks in a code-wide convention or pattern** — naming style, casing (camelCase vs snake_case for columns), file-layout convention, runtime choice (Node vs Edge), library config that applies across many call sites. Even if it feels minor in isolation, *width* makes it architectural. Surface it for ADR review BEFORE writing code that depends on it, not after.

Better to ask once than refactor twice.

---

## Commit Format

`[Phase N] feat|fix|chore|docs|refactor: short description`

Examples:
- `[Phase 2] feat: add expense edit form`
- `[Phase 5] fix: handle PaddleOCR timeout in worker`

Full git workflow: `Docs/git-workflow.md`.

---

## "Done" Definition (per phase)

A phase isn't done until ALL of the following are true. Tick each off explicitly before writing the handoff:

1. **Every item in the `### Test` section of `Docs/phases.md` for this phase has been executed and passes.** No phase ships with unchecked test items. This is the primary gate — items 2–11 below are general defaults that some phases relax (e.g. Phase 0 has no user-facing feature, no multi-tenancy yet) and the per-phase Test section is what reflects the actual bar.
2. Feature works end-to-end locally with two test accounts (where applicable)
3. Multi-tenancy verified — account A can't see B's data, tried via UI + direct API call + guessed IDs
4. All inputs validated server-side with Zod
5. Errors handled and surfaced to user
6. Mobile-responsive (375px width)
7. `npm run typecheck` && `npm run lint` clean
8. Committed with clear messages
9. **ADR audit done** — any structural or convention choices made this phase are captured in `Docs/architecture.md` (see Session Protocol END, step 3).
10. `Docs/handoff.md` updated
11. Phase complete → tagged in git
12. Phase 2+ → deployed to VPS, verified on live domain
