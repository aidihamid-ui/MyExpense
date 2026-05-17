# Handoff

**Read this at the start of every Claude Code session.** It's the single source of truth for where the project stands right now.

**Last updated:** _[date — YYYY-MM-DD]_
**Last session by:** _[Claude / DeepSeek subagent]_
**Current phase:** _Phase 0 — Local Setup (not started)_

---

## Current State

### What's working

_Nothing yet — fresh project._

### What's broken or incomplete

_N/A_

### Last known-good git state

_No commits yet._

---

## What Was Done This Session

_No sessions yet. First session: provision local dev environment._

---

## Next Up (in priority order)

1. **Phase 0 — Local Setup.** Install Node 20, PostgreSQL 16, Python 3.11, PaddleOCR locally. Init Next.js project with TypeScript + Tailwind + Drizzle. Verify all tooling runs.
2. **Phase 1 — Auth.** Wire up Better-Auth. Register/login/logout works on `localhost:3000`. Two test accounts.
3. **Phase 1.5 — First Deploy.** Provision Hostinger VPS. Deploy the auth-only app. Make the pipeline work while the app is still small.

See `docs/build-plan.md` for full phase list.

---

## Open Questions / Blockers

- [ ] MyExpense: App name
- [ ] Confirm Hostinger VPS plan (KVM 2 minimum for 2GB RAM)
- [ ] Domain registered? Where?
- [ ] Local OS being used for development (Mac / Linux / Windows)?

---

## Decisions Made This Session

_None yet. Decisions get logged in `docs/architecture.md` as they're made._

---

## Notes for Next Session

_Anything the next session should know that doesn't fit above. E.g., "PaddleOCR install was slow — be patient", "Had to bump Node to 20.11 for compatibility with X"._

---

## Handoff Template (copy this each session)

When closing out a session, replace the sections above using this template:

```
**Last updated:** YYYY-MM-DD
**Last session by:** Claude
**Current phase:** Phase X — [name]

## Current State

### What's working
- [bullet list of features that work end-to-end]

### What's broken or incomplete
- [bullet list, or "nothing known broken"]

### Last known-good git state
- Branch: main
- Last commit: abc1234 — "[Phase N] feat: ..."
- Last tag: v0.X-...

## What Was Done This Session
- [bullets]

## Next Up
1. [next concrete task]
2. ...

## Open Questions / Blockers
- [ ] ...

## Decisions Made This Session
- [decision]: logged in architecture.md as ADR-XXX

## Notes for Next Session
- ...
```
