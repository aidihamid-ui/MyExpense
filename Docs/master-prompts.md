# Master Prompts

Reusable prompts for Claude Code. Paste the relevant one when needed.

---

## A. Project Context (start of every session)

This one is mostly redundant if `CLAUDE.md` is auto-loaded, but useful as a sanity reset if Claude is drifting.

```
Reset: we're working on MyExpense — a self-hosted personal expense tracker for 6 users max (me + family/friends).

Stack: Next.js 15 (App Router, Server Actions) · TypeScript strict · PostgreSQL 16 · Drizzle ORM · Better-Auth · Tailwind · PaddleOCR via FastAPI sidecar on localhost:8001 · Local filesystem for receipts · PM2 + Nginx + Let's Encrypt in prod only · Hostinger VPS (Ubuntu 22.04, 2GB RAM).

Currently developing LOCALLY. VPS deploy starts at Phase 1.5.

Read CLAUDE.md and docs/handoff.md. Then confirm what we're working on before writing code.

Reminder: 6 users max. No Redis, no microservices, no GraphQL, no event sourcing. Choose boring solutions.
```

---

## B. Phase Kickoff

```
We're starting [PHASE NAME] of MyExpense.

Read docs/phases.md section for this phase.

Before writing any code:
1. List the files you'll create or modify
2. Describe the data flow in 3-5 bullets
3. Identify the 2-3 things most likely to go wrong
4. Wait for my approval before writing code

Break the phase into 3-4 commits I can review separately.
```

---

## C. Security Review (after every phase)

```
Review all code changes since my last commit for security issues. Specifically check:

1. Multi-tenancy: Does every query returning user data filter by the authenticated userId?
2. Input validation: Are all user inputs validated server-side with Zod?
3. Secrets: Are any API keys, tokens, or credentials accidentally accessible to the client?
4. File handling: Are uploads validated for MIME + magic bytes + size? Are receipts served only via the auth-checked route?
5. Path traversal: Any filesystem reads where user input could escape the receipts directory?
6. SQL safety: Any raw SQL? Any string interpolation in queries?
7. Authorization: Do edit/delete operations verify resource ownership BEFORE mutating?
8. Rate limiting: Are expensive operations (OCR, password reset, signup) rate-limited?
9. Python OCR service: Bound to 127.0.0.1 only? Image path validated to stay inside receipts dir?

For each issue found, give:
- File and line number
- The risk (what could go wrong)
- The fix (concrete code)

Log findings to docs/security-log.md when done.
```

---

## D. Deployment (before pushing to VPS)

```
I'm about to deploy MyExpense to my Hostinger VPS. Walk me through the deployment for the changes since my last deploy:

1. List new env vars I need to add to /var/www/myexpense/.env
2. List new system packages to apt-install
3. List new Python deps for the OCR service
4. Generate the exact migration commands to run
5. Tell me which PM2 processes need restarting (app, worker, ocr-service)
6. Give me a single shell script I can copy-paste to do all of this on the VPS

If anything is destructive or risky, flag it before the step.

Update docs/deployment.md with anything new I'll need to remember next time.
```

---

## E. Debug

```
Something is broken. Here's what's happening:

[DESCRIBE — what you did, what you expected, what happened, any error message verbatim]

Before suggesting fixes:
1. Ask me for any additional info you need (logs, screenshots, exact reproduction steps)
2. State 2-3 hypotheses for the root cause, ranked by likelihood
3. Suggest the smallest possible test to confirm or rule out the top hypothesis
4. Wait for me to run that test before writing fix code

Don't pattern-match to "common issues" — debug from evidence.
```

---

## F. Don't Over-Engineer (reminder when Claude proposes too much)

```
Reminder before you write code:
- 6 users max. No scaling concerns.
- Choose boring, proven solutions.
- No premature abstractions — wait until 3 use cases before extracting.
- No Redis, microservices, GraphQL, event sourcing.
- One Postgres, one Next.js, one Python sidecar, one VPS. That's the whole architecture.
- If a solution requires more than 200 lines of new code for one feature, propose a simpler approach first.
```

---

## G. Delegating to DeepSeek (Claude uses this internally)

```
TASK: [one sentence describing the task]

CONTEXT:
[paste the interface, schema, or pattern DeepSeek must follow]

CREATE: [exact file path]

REQUIREMENTS:
- [specific bullet]
- [specific bullet]

ACCEPTANCE: [what makes this done]

DO NOT TOUCH:
- [list of files / areas off-limits]

OUTPUT: just the file contents, no commentary.
```

Full rules: `docs/subagent-rules.md`.

---

## H. End-of-Session Handoff

```
We're wrapping up this session. Do the following:

1. Run npm run typecheck and npm run lint — report results
2. Commit any uncommitted work with a clear message, or stash if mid-feature
3. Update docs/handoff.md with:
   - Current state (what works, what doesn't)
   - What was done this session
   - What's next (concrete 1-3 tasks)
   - Open questions or blockers
   - Any new decisions made (log to architecture.md too)
4. If we completed a phase: create the git tag
5. Push to GitHub including tags

Then summarize the session in 5 bullets for me.
```
