# Architecture Decisions

This file records significant architectural choices made during the build. Format follows lightweight ADR (Architecture Decision Record) style.

**Why this file exists:** Future-you (or next session's Claude) needs to know WHY the codebase is the way it is, not just WHAT it is. Code shows what; this file shows why.

**When to add an entry:** Whenever you choose between two or more reasonable options and pick one. Even small choices that someone later might second-guess.

---

## ADR Template

Copy this block for each new decision.

```
### ADR-XXX: [Short title]
**Date:** YYYY-MM-DD
**Status:** Accepted | Superseded by ADR-YYY | Deprecated
**Phase:** Phase N

**Context:**
What forced this decision? What problem are we solving?

**Options considered:**
1. Option A — pros, cons
2. Option B — pros, cons
3. Option C — pros, cons

**Decision:**
We chose [Option X].

**Reasoning:**
Why this option won. What we're optimizing for.

**Trade-offs we accept:**
- We give up X
- We accept Y risk
- We'll revisit if Z happens

**Revisit trigger:**
The conditions under which this decision should be reconsidered (e.g., "if we exceed 50 users", "if OCR accuracy drops below 50%").
```

---

## Decisions

### ADR-001: Self-hosted on Hostinger VPS instead of Vercel

**Date:** _[5/16]_
**Status:** Accepted
**Phase:** Phase 0

**Context:**
Need to host a multi-user finance app for 6 users with a Python OCR sidecar. Choosing between managed (Vercel + managed services) vs self-hosted VPS.

**Options considered:**

1. **Vercel + Neon + R2 + paid OCR API** — easy deploy, managed everything, ~RM40/month, vendor lock-in
2. **Hostinger VPS, self-hosted everything** — more setup work, more learning, ~RM30/month, full control
3. **Hybrid: VPS for app, managed for DB** — middle ground

**Decision:**
Option 2: Hostinger VPS self-hosted.

**Reasoning:**

- This is a learning project; the operational work is part of the value
- Need to run PaddleOCR (Python sidecar) which is awkward on Vercel
- 6-user scale means a single VPS is plenty
- Cost is comparable; no vendor lock-in

**Trade-offs we accept:**

- Manual server hardening, updates, monitoring
- We are the SRE; if it goes down at 2am, we get paged
- Backups are our responsibility

**Revisit trigger:**
If we exceed 50 users, or if we want to make this a paid product, reconsider managed services.

---

### ADR-002: PaddleOCR for OCR (vs Tesseract / EasyOCR / cloud APIs)

**Date:** _[5/16]_
**Status:** Accepted
**Phase:** Phase 0

**Context:**
Need OCR for Malaysian receipts (mix of English + Malay, thermal printer paper). Want free/open source for v1, with upgrade path to paid for higher accuracy later.

**Options considered:**

1. **Tesseract** — most portable, lightest, but weakest on receipts
2. **EasyOCR** — easier setup, supports BM, lower accuracy than Paddle
3. **PaddleOCR (PP-OCRv4)** — best free accuracy on receipts, heavier (~1.5GB RAM)
4. **GPT-4o / Claude vision** — best accuracy overall, costs ~RM0.05–0.15 per receipt

**Decision:**
PaddleOCR for v1, with a pluggable `OcrProvider` interface so swapping to cloud OCR is an env var change.

**Reasoning:**

- Best accuracy among free options
- Resource use fits a 2GB VPS for our scale
- Pluggable interface means we never lock in

**Trade-offs we accept:**

- ~60-70% accuracy on totals — users must review every extracted receipt
- ~500MB model footprint in memory
- First inference is slow (~3-5s)
- Heavier Python install on the VPS

**Revisit trigger:**
If accuracy frustrates users beyond willingness to correct, switch `OCR_PROVIDER=claude` and pay per receipt.

---

### ADR-003: Local filesystem for receipts (vs S3-compatible storage)

**Date:** _[5/16]_
**Status:** Accepted
**Phase:** Phase 0

**Context:**
Need to store uploaded receipt images. Two options: object storage (R2/S3) vs local filesystem on the VPS.

**Options considered:**

1. **Cloudflare R2** — S3-compatible, free egress, costs scale with size, more setup
2. **Local filesystem at `/var/lib/finance-app/receipts/`** — free, simple, our responsibility to back up

**Decision:**
Local filesystem.

**Reasoning:**

- 6 users × 50 receipts/month × 500KB ≈ 150MB/year. Trivially small.
- One less external service to learn and maintain
- Backed up nightly via rsync

**Trade-offs we accept:**

- We're responsible for backups
- No CDN — receipts load from our VPS
- Migrating to object storage later is a small refactor

**Revisit trigger:**
If >10GB receipts, or if we need multi-region access, or if a single VPS isn't enough.

---

### ADR-004: Postgres-backed job queue (vs Redis / Inngest / RabbitMQ)

**Date:** _[5/16]_
**Status:** Accepted
**Phase:** Phase 5 (OCR pipeline)

**Context:**
OCR is async. Need a queue between "user uploads receipt" and "worker processes it."

**Options considered:**

1. **Postgres-backed queue** (`ocr_jobs` table polled every 5s) — simplest, no extra service
2. **Redis + BullMQ** — fast, more features, extra service to run
3. **Inngest / Trigger.dev** — managed, lots of features, extra cost

**Decision:**
Postgres-backed queue.

**Reasoning:**

- At 6 users, queue load is minimal (maybe 5-20 jobs/day total)
- Reuses existing Postgres infrastructure
- 5-second polling is more than fine for receipt OCR latency expectations

**Trade-offs we accept:**

- Slightly higher DB load (one query every 5s)
- No fancy queue features (priorities, scheduled jobs at scale)

**Revisit trigger:**
If we have >100 jobs/minute, or if multiple workers cause lock contention.

---

### ADR-005: `camelCase: true` on the Drizzle adapter

**Date:** 2026-05-17
**Status:** Accepted (backfilled — decision made during Phase 1 implementation without prior ADR review)
**Phase:** Phase 1

**Context:**
The `@better-auth/drizzle-adapter` has two modes for mapping between Better-Auth's internal camelCase field names (`emailVerified`, `createdAt`, `userId`) and the actual database columns. With `camelCase: false` (the default), it expects snake_case columns (`email_verified`, `created_at`). With `camelCase: true`, it maps camelCase → camelCase. We needed to pick one before writing the schema.

**Options considered:**

1. **`camelCase: false` (default) + snake_case schema** — Conventional for PostgreSQL. Column names like `email_verified`, `user_id`. The adapter auto-maps Better-Auth's internal names to them. More standard SQL.
2. **`camelCase: true` + camelCase schema** — Column names stay `emailVerified`, `userId`. No translation layer. Less idiomatic in Postgres but consistent with TypeScript field names.

**Decision:**
`camelCase: true`.

**Reasoning:**

**Honest version:** The Drizzle schema was written first with camelCase column names (`boolean('emailVerified')`, `timestamp('createdAt')`) before the adapter mode was thought through. The adapter config was then set to match what was already written, not the other way around. It wasn't a principled upfront choice — it was a consequence of writing schema code before locking the convention.

**Post-hoc justification that holds up:** Avoids a translation layer that could silently break if Better-Auth adds a new field and the snake_case mapping doesn't trigger correctly. What you write in the Drizzle schema is what you see in `psql`.

**Trade-offs we accept:**

- Every future table (`categories`, `expenses`, `receipts`, `ocr_jobs`) must also use camelCase column names — this is now a project-wide convention
- Column names in `psql` look like `emailVerified` rather than `email_verified` — unusual for Postgres, can surprise anyone querying the DB directly
- If we swap away from the Drizzle adapter, the new adapter needs to know columns are camelCase

**Revisit trigger:**
If a future Better-Auth or Drizzle adapter update assumes snake_case columns by default and breaks the mapping. Or if we add a second ORM/query tool that doesn't know the camelCase convention.

---

### ADR-006: `proxy.ts` with cookie-presence check for the session guard

**Date:** 2026-05-17
**Status:** Accepted (backfilled — decision made during Phase 1 implementation without prior ADR review)
**Phase:** Phase 1

**Context:**
Need to protect `/dashboard` from unauthenticated access. Next.js provides a pre-render intercept layer (historically `middleware.ts`, renamed `proxy.ts` in v16). Two sub-decisions here: (1) which file to use, and (2) what the check inside it should do.

**Options considered:**

**For the file:**

1. **`proxy.ts` (Next.js 16 convention)** — Node.js runtime, not configurable. The recommended path going forward.
2. **`middleware.ts` (deprecated)** — Still works in Next.js 16, runs on Edge runtime. Would generate deprecation warnings.

**For the check inside the proxy:**

1. **Cookie presence only** — Check if `better-auth.session_token` cookie exists. Fast, no DB hit. Does not verify session is still valid in DB.
2. **Full `auth.api.getSession()` call** — Hits the DB on every request to `/dashboard`. Catches revoked sessions at the proxy layer.

**Decision:**
`proxy.ts` with cookie-presence check, plus a real `auth.api.getSession()` check inside `dashboard/page.tsx`.

**Reasoning:**

**On `proxy.ts` vs `middleware.ts`:** The v16 docs state *"The edge runtime is NOT supported in proxy. The proxy runtime is nodejs, and it cannot be configured."* The choice of file was effectively made by reading the Next.js 16 upgrade guide — `proxy.ts` is the forward path. `middleware.ts` would have worked but generated deprecation noise and would need migration later anyway.

**On cookie-presence vs DB check:** The proxy docs warn to *"not attempt relying on shared modules or globals"* and to *"always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."* The trade-off was not explicitly reasoned about at the time — cookie-only was chosen as the simpler option, relying on the server component as the real gate. The Node.js runtime in `proxy.ts` would allow a DB call — that option was available but not evaluated.

**What the cookie-only check actually does:**
Prevents the most common case (no cookie at all → immediate redirect). Does NOT protect against a revoked/expired session that still has a cookie. That case is caught by the server component's `auth.api.getSession()` call, which hits the DB and redirects if the session is invalid. So there is a two-layer check, but the proxy layer is **not authoritative** — it's a fast redirect, not a security boundary.

**Trade-offs we accept:**

- A user with a revoked session (e.g., logged out on another device) passes through the proxy and is only stopped by the server component — one extra DB hit happens before the redirect
- The proxy is not a security boundary, just a UX shortcut; the real auth is in the server component
- Session cookie name (`better-auth.session_token`) is a Better-Auth internal detail; if they rename it, the proxy silently stops working while the server component still protects correctly

**Revisit trigger:**
If Better-Auth changes its cookie name. If we add routes that must be protected but do not have a server component to fall back on (e.g., a pure API route). If we need to block revoked sessions at the proxy layer for compliance reasons.

---

### ADR-007: Docker + Traefik instead of PM2 + Nginx + Certbot

**Date:** 2026-05-18
**Status:** Accepted
**Phase:** Phase 1.5

**Context:**
Phases.md originally specified PM2 + Nginx + Certbot as the VPS stack. The user's VPS already has Traefik running as the reverse proxy (shared with n8n, Chatwoot, and other apps). Needed to decide whether to follow the original plan or match the existing VPS convention.

**Options considered:**

1. **PM2 + Nginx + Certbot** — what phases.md described. More moving parts per app. Each app manages its own Nginx config and cert renewal.
2. **Docker Compose + Traefik** — user's existing convention. All apps containerised; Traefik (host mode) handles SSL centrally via Let's Encrypt. New app = one compose file + Traefik labels.

**Decision:**
Docker Compose + Traefik.

**Reasoning:**
The VPS already uses this pattern for other apps. Adding a second paradigm (PM2 + Nginx) would create inconsistency and maintenance overhead. The Traefik pattern is simpler to add to an existing setup (one compose file, no Nginx config files to manage).

**Trade-offs we accept:**
- Learning Docker if unfamiliar (mitigated by documentation)
- Docker build RAM usage during deploy (~1.5 GB — requires swap on a 2 GB VPS)
- If the Traefik container is misconfigured, all apps on the VPS lose HTTPS

**Revisit trigger:**
If we move off this VPS to a fresh host where Traefik is not already running.

---

### ADR-008: No shared Traefik Docker network

**Date:** 2026-05-18
**Status:** Accepted
**Phase:** Phase 1.5

**Context:**
Traefik runs with `network_mode: host`, binding directly to the VPS network interfaces for ports 80/443. We needed to decide how our app container would be reachable by Traefik. Common patterns include a shared named Docker network (e.g. `traefik`) that Traefik also joins, or relying on Traefik's Docker provider to discover containers and route to their bridge IPs.

**Options considered:**

1. **Shared external network (e.g. `traefik`)** — Traefik joins the network and routes to the container's network-local IP. Common pattern when Traefik is NOT in host mode.
2. **No shared network; host-mode Traefik routes to bridge IP** — Traefik in host mode can reach any container's bridge IP on the host directly. No `networks:` section needed in our compose file. Same pattern as n8n on this VPS.
3. **Published port to host (`ports: ["3000:3000"]`) + Traefik routes to `localhost:3000`** — Works but exposes port 3000 on the host, bypassing Traefik.

**Decision:**
Option 2: no shared network, no published ports. Traefik (host mode) discovers our container via Docker socket labels and routes to bridge IP:3000.

**Reasoning:**
Confirmed to match the n8n pattern already in use on this VPS. Avoids exposing ports to the host. No external network declaration needed, keeping the compose file minimal.

**Trade-offs we accept:**
- Relies on Traefik's Docker provider being configured to watch all containers (not just those on a specific network) — confirmed working for n8n
- If Traefik is ever moved off host mode, this setup needs a shared network added

**Revisit trigger:**
If Traefik is reconfigured to use a named network instead of host mode.

---

### ADR-009: Manual-only migrations (no auto-migrate on startup)

**Date:** 2026-05-18
**Status:** Accepted
**Phase:** Phase 1.5

**Context:**
Needed to decide whether database migrations run automatically when the app container starts, or are run manually as a separate step.

**Options considered:**

1. **Auto-migrate on startup** — App runs `drizzle-kit migrate` before starting. Simple for developers; always consistent.
2. **Manual migrate via separate Docker target** — `docker compose run --rm migrate` (or `make migrate`). Explicit, visible, safe.

**Decision:**
Manual only, via the `migrate` service in docker-compose (profile: tools) and `make migrate`.

**Reasoning:**
Auto-migration on startup creates risk: if a migration fails mid-deploy, the app may be in a broken state with no clear recovery path. It also makes rollback harder. For a small team making deliberate deploys, the explicit `make migrate` step costs almost nothing and makes the migration a conscious, logged action. The deployment runbook prominently documents when to run it.

**Trade-offs we accept:**
- Human must remember to run `make migrate` when schema changes. Mitigated by deployment.md instructions.
- First-time setup requires an extra command after `docker compose up`

**Revisit trigger:**
Never reconsidering this. Manual migrations are the correct choice at any scale.

---

### ADR-010: Per-user categories (no shared global table)

**Date:** 2026-05-18
**Status:** Accepted
**Phase:** Phase 2

**Context:**
Need a `categories` table to tag expenses. Two structural options: shared global categories visible to all users, or per-user categories owned exclusively by each user.

**Options considered:**

1. **Global categories table** — no `userId` column; all users see the same list. Simpler to seed (once), easier to add admin-managed categories later.
2. **Per-user categories** — `userId` FK on every row; each user owns their own set, seeded at signup. Fully isolated, consistent with the multi-tenancy model already applied to expenses.
3. **Hybrid** — global defaults plus a per-user override table. More complex, no clear benefit at 6-user scale.

**Decision:**
Option 2: per-user categories with `userId` on every row.

**Reasoning:**
Consistent with the project's multi-tenancy rule — every user-data table filters by `userId`. Avoids any future ambiguity about whether a category is shared or owned. Simple seed helper covers the "default set" requirement without needing a global table. User confirmed this design during the Phase 2 session conflict scan.

**Trade-offs we accept:**
- 7 category rows created per user at signup (trivial at 6-user scale)
- No category sharing between users — each user manages their own list
- If we ever want admin-managed shared categories, we'd need a migration to add a nullable `userId` or a separate global table

**Revisit trigger:**
If users request sharing categories across accounts, or if we add a multi-household feature.

---

### ADR-011: Signup side effects via Better-Auth `databaseHooks`

**Date:** 2026-05-18
**Status:** Accepted
**Phase:** Phase 2

**Context:**
Need to seed default categories when a new user signs up. Needed a hook point that fires reliably after the user row is committed, without patching the signup route.

**Options considered:**

1. **`databaseHooks.user.create.after` in `lib/auth/index.ts`** — Better-Auth's built-in mechanism. Fires after the user row is written. Config-level, no route changes needed.
2. **Custom signup server action** — wrap Better-Auth's `signUp.email()` in our own server action, call `seedDefaultCategories` after. Requires replacing the client-side auth call with our own action everywhere.
3. **Post-login check** — seed on first login if categories are empty. Lazy, harder to reason about, creates a race condition window.

**Decision:**
Option 1: `databaseHooks.user.create.after` in `lib/auth/index.ts`.

**Reasoning:**
Least invasive. Better-Auth owns the signup flow; hooking at the DB layer means we don't need to intercept the HTTP route or change client-side code. The hook fires after the user row is committed, so `user.id` is stable. Wrapped in `try/catch` so a seed failure never blocks account creation.

**Trade-offs we accept:**
- All future signup side effects must also go in `lib/auth/index.ts` — it becomes the canonical place for post-signup logic
- If Better-Auth changes the `databaseHooks` API, this breaks silently at runtime (not caught by typecheck)
- A seed failure is swallowed (logged only) — there is currently no retry or alerting mechanism

**Revisit trigger:**
If we add signup side effects that must not fail silently (e.g., sending a welcome email), we should add proper error handling or move to Option 2.

---

### ADR-012: Server actions in `lib/actions/` (not inline in pages)

**Date:** 2026-05-18
**Status:** Accepted
**Phase:** Phase 2

**Context:**
Need a convention for where server actions live. Next.js allows them inline in server components (via `'use server'` inside the function body) or in separate files. Choosing inline vs. extracted now sets the pattern for all future features.

**Options considered:**

1. **Inline in page/component** — server action defined directly inside the server component that uses it. No extra file. Works for simple cases.
2. **`lib/actions/<feature>.ts`** — server actions in a separate file with `'use server'` at the top. Importable by client components via `useActionState`. Testable in isolation.

**Decision:**
Option 2: `lib/actions/<feature>.ts`.

**Reasoning:**
Client form components (`expense-form.tsx`) must import the action directly since they use `useActionState`. An inline server action is only callable from the same file; it cannot be imported by a client component. Since the form is a separate client component (required for `useActionState`), the action must live in an importable module. `lib/actions/` is consistent with the `lib/` convention already used for `lib/db/`, `lib/validators/`, etc.

**Trade-offs we accept:**
- One extra file per feature area (small cost)
- All future server actions must follow this convention — they go in `lib/actions/`, not inline

**Revisit trigger:**
If a server action is trivially simple and only called from a single server component (no client usage needed), inline is acceptable as a one-off exception.

---

### ADR-013: Nav as a standalone client component (no route-group layout)

**Date:** 2026-05-18
**Status:** Accepted
**Phase:** Phase 2

**Context:**
Need a shared navigation bar across all authenticated pages (`/dashboard`, `/expenses`, future pages). Two structural options: a shared layout file via a route group, or a standalone component imported per page.

**Options considered:**

1. **Route group `app/(app)/layout.tsx`** — move all authenticated pages under `app/(app)/`. The layout renders Nav once for all child routes. Clean, DRY. Requires moving `app/dashboard/` to `app/(app)/dashboard/` (file rename/move).
2. **`components/nav.tsx` imported per page** — Nav is a client component imported directly into each page. No file moves needed. Small duplication (one import per page).

**Decision:**
Option 2: standalone `components/nav.tsx` imported per page.

**Reasoning:**
The route group approach requires moving `app/dashboard/` to `app/(app)/dashboard/`, which is a rename/move with no functional benefit at this stage. The per-page import is two lines per page (import + `<Nav />`). At 2–4 protected pages, this is not meaningful duplication. The route group is the right long-term solution if we add 8+ protected pages.

**Trade-offs we accept:**
- Must remember to add `<Nav />` to every new protected page
- If Nav ever holds server-fetched data (e.g., unread notification count), per-page import forces each page to fetch it separately — a route group layout would fetch it once

**Revisit trigger:**
If we add more than 5 protected pages, or if Nav needs server-fetched state, migrate to the route group layout.

---

### ADR-014: `notFound()` for wrong-owner mutations (not redirect or error state)

**Date:** 2026-05-18
**Status:** Accepted
**Phase:** Phase 2

**Context:**
When a user attempts to access or mutate an expense that belongs to a different user, the server needs to respond. Three options: redirect to `/expenses`, return an error state to the client, or render 404. The choice sets the security UX pattern for all protected routes.

**Options considered:**

1. **`redirect('/expenses')`** — Sends the user back to the list. Reveals that the resource exists (they are being redirected away, implying something is there). Leaks information.
2. **Return error state** — Return `{ message: 'Not found.' }` from the server action. Correct for form state feedback but inconsistent with the page-level check.
3. **`notFound()`** — Renders the 404 page. Does not reveal whether the resource exists or belongs to another user. Consistent behaviour from both page render (server component) and mutation (server action).

**Decision:**
`notFound()` in both the page server component (before rendering) and the server action (if ownership check fails after form submission).

**Reasoning:**
Principle of minimum information disclosure: if a user guesses another user's expense ID, they should see exactly the same response whether the ID doesn't exist or belongs to someone else. This makes enumeration attacks harder. It's also the idiomatic Next.js pattern for "this resource does not exist in your context."

**Trade-offs we accept:**
- `notFound()` inside a server action (invoked via `useActionState`) causes Next.js to navigate to the 404 page rather than returning an error state to the form. This is appropriate — a wrong-owner mutation is not a form validation error.
- If `notFound()` is called inside a `catch` block, it rethrows `NEXT_NOT_FOUND` past the catch, which works correctly (JavaScript catch blocks do not catch throws from within themselves).

**Revisit trigger:**
If a future route requires a more nuanced response for wrong-owner access (e.g., a redirect to a specific "permission denied" page), override per-route rather than changing this default.

---

### ADR-015: Post-mutation cache invalidation: `revalidatePath` in action + `router.refresh()` in client

**Date:** 2026-05-18
**Status:** Accepted
**Phase:** Phase 2

**Context:**
After a successful delete, the expenses list needs to reflect the change. Next.js App Router caches server component data. Two mechanisms are available: `revalidatePath` (server-side, marks the path stale) and `router.refresh()` (client-side, triggers a soft re-fetch of the current route).

**Options considered:**

1. **`revalidatePath` in server action only** — Marks `/expenses` as stale on the server. Next.js will re-render on next visit. But the client needs a signal to trigger that re-render without a full navigation.
2. **`router.refresh()` in client component only** — Re-fetches the current route from the server. Without `revalidatePath`, cached server data might be served.
3. **Both** — `revalidatePath('/expenses')` in the action marks the cache as stale. `router.refresh()` in the client immediately triggers a re-fetch against the now-stale cache.

**Decision:**
Both: `revalidatePath('/expenses')` in `deleteExpenseAction`, followed by `router.refresh()` in the `DeleteExpenseButton` client component.

**Reasoning:**
Belt-and-suspenders. `revalidatePath` is needed for server-side freshness guarantees; `router.refresh()` is needed to immediately update the client view without a full page navigation. Together they are explicit and reliable. The small overhead is acceptable.

**Trade-offs we accept:**
- Slight redundancy (one of the two might be sufficient in practice — Next.js docs suggest `revalidatePath` in a server action automatically invalidates in-flight renders)
- Both calls are cheap and won't cause double-fetching in practice

**Revisit trigger:**
If Next.js behavior changes such that `revalidatePath` in a server action already triggers client re-render automatically, remove `router.refresh()`.

---

### ADR-016: ESLint with flat config (`eslint.config.mjs`) and `eslint-config-next`

**Date:** 2026-05-18
**Status:** Accepted
**Phase:** Phase 2

**Context:**
Next.js 16 removed `next lint` entirely (previously available in v13–v15). Linting is now via the standard ESLint CLI. Need to decide the ESLint config format (flat vs legacy `.eslintrc`) and rule set.

**Options considered:**

1. **Legacy `.eslintrc.json` + `eslint-config-next`** — Still supported by ESLint 9, but deprecated. `next lint` removal makes this a dead end.
2. **Flat config `eslint.config.mjs` + `eslint-config-next` + TypeScript rules** — The documented path for Next.js 16. Uses `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`.

**Decision:**
Flat config with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.

**Reasoning:**
Next.js 16 docs explicitly prescribe this. No legacy format justification. TypeScript rules catch real bugs (unused vars, `any` abuse). Rule override added for `@typescript-eslint/no-unused-vars` to respect the `_`-prefix convention used in `queries.ts` (`_sortBy`).

**Trade-offs we accept:**
- Must maintain `eslint.config.mjs` as the canonical lint config
- Any future rule overrides go in `eslint.config.mjs` rather than inline `// eslint-disable` comments (prefer config-level suppressions)

**Revisit trigger:**
If `eslint-config-next` version diverges from the installed Next.js version and causes false positives.

---

### ADR-017: shadcn/ui as the UI component library

**Date:** 2026-05-18
**Status:** Accepted
**Phase:** Between Phase 2 and Phase 3 (approved before Phase 3 work begins)

**Context:**
Phase 3 (Dashboard) requires richer UI components — cards, data tables, select menus, date pickers. The current setup (Tailwind 4 only, hand-rolled components) works for simple forms but will become tedious for a full dashboard. Need to pick a component library before Phase 3 starts so the convention is locked in from the start.

**Options considered:**

1. **DaisyUI** — Tailwind plugin, zero JS, very fast to set up, good for simple pages. Weaker long-term: less accessible, less composable, harder to customise deeply. Theme system fights Tailwind 4's new CSS variable approach.
2. **Tremor** — Purpose-built for dashboards and charts. Strong data viz. But a charts/stats library, not a full general-purpose component library — would still need another library for forms, modals, comboboxes, etc.
3. **shadcn/ui** — Not a library; copies component source into the repo. Built on Radix UI primitives (WAI-ARIA accessible) and Tailwind 4. Code ownership: components live in `components/ui/`, fully editable. Claude Code has strong familiarity with shadcn/ui patterns.

**Decision:**
shadcn/ui.

**Reasoning:**
- Code ownership: components are copied into `components/ui/` — no version conflicts, no black-box behaviour
- Radix UI primitives handle accessibility (focus traps, keyboard nav, ARIA) correctly without extra work
- Full general-purpose library: buttons, dialogs, selects, date pickers, tables, toasts — covers everything from Phase 3 onward
- Tailwind 4 compatible
- Claude Code familiarity reduces implementation friction

**Trade-offs we accept:**
- Slightly more setup than DaisyUI (run `npx shadcn@latest add <component>` per component needed)
- Components live in `components/ui/` — that directory is shadcn-managed; do not put custom components there
- Upgrading individual components means re-running the add command and reviewing the diff

**Revisit trigger:**
Never for the core decision. If a specific component is missing from shadcn/ui, add it one-off without changing the overall library choice.

---

### ADR-018: Radix Select (shadcn) with `name` prop for FormData-based server actions

**Date:** 2026-05-18
**Status:** Accepted
**Phase:** Between Phase 2 and Phase 3 (established during shadcn/ui restyle)

**Context:**
The expense forms use `useActionState` with Next.js server actions. Server actions receive a native `FormData` object. Migrating `<select>` elements to shadcn's `Select` component (which uses Radix UI's `SelectPrimitive.Root`) raises the question of whether the component will correctly submit a value via `FormData`.

**Options considered:**

1. **Keep native `<select>` elements, styled with Tailwind** — native selects work with FormData natively, no surprises. Downside: inconsistent with the rest of the shadcn component set; harder to style accessibly.
2. **Radix `Select` with `name` prop** — Radix `SelectPrimitive.Root` accepts a `name` prop and renders a hidden `<input type="hidden" name="..." value="...">` behind the scenes. This hidden input participates in native form submission and thus in `FormData`. Consistent with other shadcn components; accessible (keyboard nav, ARIA).
3. **Controlled Select + hidden input manually** — Wire up `useState` + `onValueChange` and render our own hidden input. Needlessly complex; duplicates what Radix already does.

**Decision:**
Option 2: Use Radix `Select` with `name` prop in all forms that use server actions.

**Reasoning:**
Radix UI explicitly documents that when `name` is provided, a hidden native input is rendered for form submission. This means `FormData.get('fieldName')` returns the selected value identically to a native `<select>`. The approach requires no changes to server actions or validators. Consistency with the full shadcn component set is more important than avoiding the Radix abstraction.

**How it works in practice:**
```tsx
<Select name="paymentMethod" defaultValue="cash">
  <SelectTrigger className="h-11 w-full">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="cash">Cash</SelectItem>
    ...
  </SelectContent>
</Select>
```
The hidden `<input name="paymentMethod" value="cash">` is rendered automatically. `FormData.get('paymentMethod')` returns `"cash"`.

**Empty-string value for optional selects:**
For optional category selects, `<SelectItem value="">— None —</SelectItem>` with `defaultValue=""` is used. Radix treats empty string as a valid value and submits it correctly. The server action receives `categoryId: ""` which the validator accepts as "no category".

**Trade-offs we accept:**
- All future form selects must use Radix `Select` with `name` prop — native `<select>` is no longer the convention
- `SelectTrigger` defaults to `w-fit`; must always add `className="h-11 w-full"` to make it full-width with correct tap target height
- If Radix changes its hidden-input behaviour in a future version, all selects break simultaneously — mitigated by pinning package versions

**Revisit trigger:**
If Radix changes the hidden-input mechanism, or if a future form requires a multi-select (Radix Select is single-value only — would need a different component).

---

### ADR-019: URL search param validation — Zod `safeParse` with silent fallback

**Date:** 2026-05-19
**Status:** Accepted
**Phase:** Phase 3

**Context:**
The dashboard page accepts `?from=`, `?to=`, `?categoryId=` URL search params. Invalid or missing params must not throw — the page must always render using safe defaults. Need a consistent validation pattern for all future filterable pages.

**Options considered:**

1. **Manual null/type checks** — `typeof rawParams.from === 'string' && /^\d{4}.../.test(rawParams.from)`. Works but verbose, no schema documentation.
2. **Zod `parse()` and catch** — Throws on invalid input; requires try/catch and duplicates the fallback logic.
3. **Zod `safeParse()` with explicit fallback** — `parsed.success ? parsed.data : {}`. Never throws. Schema documents expected shape. Unknown/invalid params are silently ignored and replaced with defaults.

**Decision:**
Option 3: `z.object({...}).safeParse(rawParams)` in the Server Component; fall back to computed defaults when `!parsed.success`.

**Reasoning:**
- Server Components must never throw on bad URL input — that would be a 500 on a user-controlled input
- `safeParse` makes the "invalid = use defaults" contract explicit
- The Zod schema documents the accepted shape for future maintainers
- Consistent with project-wide Zod-first validation (Rule 3 in CLAUDE.md)

**Canonical pattern:**
```ts
const paramSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  categoryId: z.string().uuid().optional(),
});
const parsed = paramSchema.safeParse(rawParams);
const validParams = parsed.success ? parsed.data : {};
const fromStr = validParams.from ?? defaultFrom;
```

**Trade-offs we accept:**
- Invalid params produce no error message to the user (intentional — URL tampering should be silent)
- The schema must be kept in sync with the filter bar's actual output params

**Revisit trigger:**
If a future page needs to surface an error for invalid params (e.g., a date that is logically impossible), switch to `parse()` + caught error → rendered error state.

---

### ADR-020: Malaysia UTC+8 timezone handling for calendar queries

**Date:** 2026-05-19
**Status:** Accepted
**Phase:** Phase 3

**Context:**
Postgres stores timestamps in UTC. The `date` column is a Postgres `DATE` type (no time zone). Users are in Malaysia (UTC+8). "Current month" must mean the Malaysia-local calendar month, not the UTC calendar month. The month boundary can differ by up to 8 hours.

**Options considered:**

1. **Derive current date inside the SQL query** (`CURRENT_DATE AT TIME ZONE 'Asia/Kuala_Lumpur'`) — No `now` param needed. But hardcodes timezone in SQL, harder to test, and CLAUDE.md prompt explicitly says "Do not derive the current date inside the query."
2. **Pass `now: Date` (UTC) to the query function; compute MYT boundaries in TypeScript** — Caller controls time (testable), TypeScript math is straightforward: `new Date(now.getTime() + 8 * 60 * 60 * 1000)` to get MYT, then extract year/month/day via `getUTCFullYear/Month/Date` on the shifted value.
3. **Store the MYT date string at write time** — Add an `dateMYT` column computed at insert. Avoids runtime math but requires schema change and migration.

**Decision:**
Option 2: caller passes `now: Date`; query function computes MYT-adjusted boundaries in TypeScript.

**Reasoning:**
- Explicitly instructed by the session prompt ("Do not derive the current date inside the query; the server must compute date boundaries")
- Testable: tests can inject any `now` value to simulate different MYT dates
- No schema change required (the `date` column already stores YYYY-MM-DD entered by the user, which is already MYT-local)
- Math is deterministic and auditable

**Canonical pattern (from `getDashboardSummary`):**
```ts
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const nowMYT = new Date(now.getTime() + MYT_OFFSET_MS);
const year = nowMYT.getUTCFullYear();
const month = nowMYT.getUTCMonth(); // 0-indexed
// Month start: "2026-05-01"
// Month end (exclusive): "2026-06-01" — use lt(), not lte()
```

**Trade-offs we accept:**
- Every time-sensitive query function must accept `now: Date` as a parameter — callers must not call `new Date()` inside the query function
- The 8-hour offset is hardcoded. If the app ever supports users outside Malaysia, the offset must become a per-user setting
- Rolling "last 30 days" is computed as `now - 30 * 24 * 60 * 60 * 1000` in MYT — does not adjust for DST (Malaysia has no DST, so this is correct)

**Revisit trigger:**
If the app supports users in multiple timezones, or if Malaysia ever changes its UTC offset.

---

### ADR-021: Controlled Radix Select (no `name` prop) for URL-param navigation

**Date:** 2026-05-19
**Status:** Accepted
**Phase:** Phase 3

**Context:**
ADR-018 established the pattern for Radix Select in forms that submit via `FormData` (server actions): use the `name` prop so Radix renders a hidden input. The dashboard filter bar is a different case: it uses `router.push()` to update URL params, not a form submission. No `FormData` is involved.

**Decision:**
Use controlled Radix Select (`value` + `onValueChange`, no `name` prop`) for any dropdown whose value is applied via `router.push()` rather than form submission.

**How it differs from ADR-018:**

| Context | Pattern |
|---|---|
| Server action form (FormData) | `<Select name="field">` — hidden input for FormData |
| URL-param navigation | `<Select value={state} onValueChange={setState}>` — controlled, no `name` |

**Trade-offs we accept:**
- Two valid Select patterns now exist in the codebase. The distinction (form vs navigation) must be remembered when adding future selects.

**Revisit trigger:**
If a filter bar ever needs to submit via a form action instead of router.push, switch to the ADR-018 pattern.

---

### ADR-022: Dashboard filter as Client Component with server-prop initialization

**Date:** 2026-05-19
**Status:** Accepted
**Phase:** Phase 3

**Context:**
The dashboard filter bar needs interactive date/category inputs that update URL params and trigger a server re-fetch. Two architectural options for connecting the server state (current URL params) to the client inputs.

**Options considered:**

1. **Pure URL-driven inputs (no local state)** — Inputs read value from URL params only, have no local state. Each keystroke triggers a `router.push()`. Causes excessive navigations while typing.
2. **Client Component with `useState` initialized from server props** — Server Component reads URL params, validates them, and passes them as props to a `'use client'` child. Client holds local `useState` for the in-progress form values. Only triggers `router.push()` on explicit Apply/Reset click.
3. **Dedicated search params hook (`useSearchParams`)** — Client reads URL params directly. Loses server-side Zod validation and makes the component harder to test in isolation.

**Decision:**
Option 2: Server Component validates URL params and passes `initialFrom`, `initialTo`, `initialCategoryId`, `defaultFrom`, `defaultTo` as props to `<FilterBar>`. FilterBar holds local controlled state, applies on button click.

**Reasoning:**
- All validation lives in the Server Component (consistent with ADR-019)
- Filter bar only navigates on explicit user action (Apply/Reset) — no spurious re-renders
- Component is fully testable with props alone (no URL dependency inside the component)
- Clear data flow: URL → Server → props → local state → router.push → URL

**Trade-offs we accept:**
- `initialX` props become stale if the URL changes without a full re-render (acceptable — Apply/Reset always navigates to the new URL, so the server re-renders with fresh props)
- The filter bar must receive `defaultFrom`/`defaultTo` from the server so Reset uses the same MYT-computed defaults

**Revisit trigger:**
If multiple pages need identical filter bars, extract the pattern into a shared component. If filter state becomes complex (many fields, nested conditions), consider a URL-param management library.

---

### ADR-023: Two-step upload pattern — separate `uploadReceiptAction` + `createExpenseAction`

**Date:** 2026-05-19
**Status:** Accepted
**Phase:** Phase 4

**Context:**
Attaching a receipt to a new expense requires both a file upload and a DB row creation. These could be handled in one combined server action (receive the file + all expense fields, do everything in one call) or as two separate actions (upload first → get receiptId → pass to create).

**Options considered:**

1. **One combined server action** — Single `createExpenseWithReceiptAction` accepts both file and form fields. Simpler call site; one round-trip. But blends two concerns: binary file handling and expense CRUD. The form's `useActionState` would need to handle a much larger payload. Error recovery (e.g., upload succeeds but DB fails) is harder to communicate to the user.

2. **Two separate actions: upload first, then create** — Client uploads the file, gets back a `receiptId`, then includes it in the regular `createExpenseAction` FormData. Concerns stay separated. Upload state and expense-save state are tracked independently. If upload fails, user sees the error before any expense row is written. Consistent with ADR-012 (server actions in `lib/actions/<feature>.ts`).

**Decision:**
Option 2: separate `uploadReceiptAction` in `lib/actions/receipts.ts` and `createExpenseAction` in `lib/actions/expenses.ts`. The form's `onSubmit` handler calls upload first (if file selected), gets the receiptId, appends it to FormData, then calls dispatch (createExpenseAction) via `startTransition`.

**Reasoning:**
- Separation of concerns: file handling and expense CRUD are independent concerns with different error paths
- Upload state can be shown granularly to the user ("Uploading…" vs "Saving…")
- `createExpenseAction` remains reusable without a file (e.g., future bulk import)
- If upload fails, the user sees the error on the file field and can retry without losing form state

**Trade-offs we accept:**
- Two network round-trips on form submit (upload + create); acceptable at 6-user scale and for the clarity it provides
- The `onSubmit` intercept pattern bypasses native form progressive enhancement — acceptable since JS is required anyway
- A receiptId can be appended to FormData manually by a malicious client, but the receipts table enforces `userId` ownership on the row, so cross-user injection is not possible

**Revisit trigger:**
If Phase 5 (OCR pipeline) needs to change this flow (e.g., upload + queue OCR atomically), revisit combining upload into the expense create or making the OCR queue step happen server-side after create.

---

### ADR-024: EXIF stripping via sharp default (no `.withMetadata()` call)

**Date:** 2026-05-19
**Status:** Accepted
**Phase:** Phase 4

**Context:**
Receipt images may contain EXIF metadata including GPS coordinates (location leak risk). The session prompt specified "sharp with `.withMetadata(false)`". However, in sharp ≥0.29, `.withMetadata()` (called without arguments or with an options object) **keeps** metadata; the method has no `false` parameter in its TypeScript type signature. Sharp strips all metadata **by default** when `.withMetadata()` is not called.

**Options considered:**

1. **`.withMetadata(false)`** — Not a valid sharp API call. Would be a TypeScript error in strict mode. Prompt specified this but it does not exist in sharp ≥0.29.

2. **`.withMetadata({})`** — Explicitly keeps metadata (opposite of intent).

3. **No `.withMetadata()` call (sharp default)** — Sharp strips all metadata by default when the method is omitted. This is the correct way to strip EXIF in modern sharp.

**Decision:**
Option 3: call `sharp(buf).toBuffer()` with no `.withMetadata()`. A comment in the code documents that this strips EXIF by default.

**Reasoning:**
Sharp's documented default behavior is metadata stripping. The prompt's intent (strip EXIF) is achieved. Adding a non-existent `.withMetadata(false)` call would break the TypeScript build.

**Trade-offs we accept:**
- Sharp may change its default in a future major version; if it ever starts preserving metadata by default, EXIF stripping would silently stop working
- PDFs bypass the sharp step entirely — PDF metadata is not stripped (acceptable: PDFs are less likely to contain GPS coordinates than camera images)

**Revisit trigger:**
On any major sharp version upgrade, verify that metadata is still stripped by default. If sharp ever adds a dedicated `.stripMetadata()` or equivalent, switch to that for clarity.

---

### ADR-025: OCR service binds 0.0.0.0 inside container — no host port published

**Date:** 2026-05-20
**Status:** Accepted
**Phase:** Phase 5a

**Context:**
The Python FastAPI OCR service needs to be reachable by the Next.js `app` container but must not be reachable from the internet. CLAUDE.md Rule 8 previously said the OCR service "binds to `127.0.0.1` only" — that applies to the local dev setup where Python runs directly on the host. In Docker, `127.0.0.1` inside a container is the container's own loopback; binding to it makes the service unreachable from other containers.

**Options considered:**

1. **Bind to `127.0.0.1` inside container + publish port to host** — Keeps the bind address tight but publishes the port to the host network, making it reachable from the internet if a firewall rule is missing.
2. **Bind to `0.0.0.0` inside container + no `ports:` in compose** — Service listens on all interfaces inside the container's private bridge network. Not published to the host. Reachable only by containers on the same Docker bridge (i.e., `app`). Internet-unreachable.
3. **Bind to `0.0.0.0` + shared Docker network** — Same as option 2 but with an explicit named network. Unnecessary complexity when both services are in the same compose file and share the default bridge automatically.

**Decision:**
Option 2: bind `0.0.0.0:8001` inside the container, no `ports:` in `docker-compose.yml`.

**Reasoning:**
Docker's default bridge network isolates containers from the host by default. Without `ports:`, port 8001 is only reachable by containers in the same compose project — in our case, only `app`. The bind address inside the container (`0.0.0.0`) is irrelevant to internet exposure; that is controlled entirely by whether `ports:` is declared. This is the same pattern used for the `db` service (Postgres binds to all interfaces inside its container, no `ports:` declared, unreachable from outside).

**How `app` reaches the OCR service:**
`http://ocr-service:8001` — Docker's internal DNS resolves `ocr-service` to the container's bridge IP.

**CLAUDE.md Rule 8 update:**
Rule 8 ("OCR service: Python FastAPI binds to `127.0.0.1` only") applies to local dev (host process). In Docker, the correct form is: "no `ports:` published; bind address inside container is `0.0.0.0`." The security property is identical — internet-unreachable — achieved by different means.

**Trade-offs we accept:**
- Any future service added to the same compose project can reach `ocr-service:8001`. The `X-OCR-Secret` header provides defense-in-depth for this.
- If a port is accidentally published in a future `docker-compose.override.yml`, the OCR service becomes internet-reachable — mitigated by the secret header but worth noting.

**Revisit trigger:**
If we split services across multiple compose files or hosts and need explicit network declarations.

---

### ADR-026: OcrProvider pluggable interface

**Date:** 2026-05-22
**Status:** Accepted
**Phase:** Phase 5b

**Context:**
The OCR pipeline needs to call an external service. We could hard-code PaddleOCR calls everywhere, or abstract behind an interface so the provider can be swapped via env var without touching call sites.

**Options considered:**

1. **Direct calls to PaddleOCR HTTP API** — simpler to write, tightly coupled; every call site imports `paddle.ts` directly
2. **`OcrProvider` interface + concrete class** — one extra layer; all call sites depend on the interface, not the implementation; env var selects the active provider at runtime

**Decision:**
Option 2: `OcrProvider` interface in `lib/ocr/provider.ts`, `PaddleOcrProvider` in `lib/ocr/paddle.ts`.

**Reasoning:**
The `OCR_PROVIDER` env var already exists (defaults to `'paddle'`). With only the interface at call sites, the worker (and any future caller) never needs to know which concrete provider is active. Swapping to Claude Vision or OpenAI for a higher-accuracy tier requires no changes outside `lib/ocr/`.

**Trade-offs we accept:**
- One extra file and indirection layer.
- Factory / DI container not implemented — caller instantiates `new PaddleOcrProvider()` directly for now. A factory can be added in Phase 5e if needed.

**Revisit trigger:**
If a second concrete provider is actually built, add a factory function in `lib/ocr/index.ts` that reads `env.OCR_PROVIDER` and returns the right instance.

---

### ADR-027: `FOR UPDATE SKIP LOCKED` for OCR job claiming

**Date:** 2026-05-22
**Status:** Accepted
**Phase:** Phase 5c

**Context:**
The worker polls `ocr_jobs` every 5 seconds. With a simple `SELECT ... LIMIT 1` + separate `UPDATE`, two concurrent worker instances could race and both claim the same job. We need an atomic claim strategy.

**Options considered:**

1. **`SELECT ... FOR UPDATE` (blocking)** — second worker waits for the first to release the lock; works but causes latency stacking under load
2. **`SELECT ... FOR UPDATE SKIP LOCKED`** — second worker sees the locked row is unavailable and immediately moves on to the next eligible row (or returns nothing); no blocking
3. **Optimistic locking (CAS on `status`)** — `UPDATE ... WHERE status='pending' ... RETURNING *`, then check if any row was updated; simpler SQL but not guaranteed to be atomic across concurrent transactions without proper isolation

**Decision:**
Option 2: `UPDATE ocr_jobs SET status='processing' WHERE id = (SELECT id ... FOR UPDATE SKIP LOCKED) RETURNING *`

**Reasoning:**
At 6 users the concurrency concern is academic, but correctness is not. `SKIP LOCKED` is the idiomatic Postgres pattern for polling queues: atomic claim, no blocking, scales to N workers trivially. The entire claim is a single statement so there is no window between SELECT and UPDATE.

**Trade-offs we accept:**
- Raw `sql` template required in the WHERE clause — Drizzle's query builder has no native `FOR UPDATE SKIP LOCKED` API.
- If Postgres is unavailable, the entire tick throws; the worker catches and logs it.

**Revisit trigger:**
Never for this project — `SKIP LOCKED` is the right choice at any scale we will reach.

---

### ADR-028: vitest as the unit test runner

**Date:** 2026-05-22
**Status:** Accepted
**Phase:** Phase 5d

**Context:**
Phase 5d introduced the first unit-testable pure function (`parseReceiptText`). A test runner is needed. The project already uses Vite indirectly via Next.js tooling, and the codebase is TypeScript-first with ESM conventions.

**Options considered:**

1. **Jest** — dominant in the Node ecosystem; requires `ts-jest` or Babel transform; heavier config; slower on pure TS files
2. **vitest** — Vite-native; zero-config TypeScript support via esbuild; same assertion API as Jest (`expect`, `describe`, `it`); fast (~4ms for 10 tests here)
3. **Node built-in test runner** (`node:test`) — no install needed in Node v18+; less ergonomic API; fewer matchers

**Decision:**
vitest.

**Reasoning:**
Zero config for TypeScript was the deciding factor — `npm install -D vitest` and `vitest run` just worked without a config file, Babel setup, or transform declarations. The Jest-compatible API means no learning curve. At this project's scale (pure utility functions, no browser DOM) the performance difference is irrelevant, but vitest is meaningfully faster on cold starts.

**Trade-offs we accept:**
- Additional devDependency (~30 packages).
- `vitest run` is a one-shot runner; watch mode (`vitest`) is a separate invocation if needed.

**Revisit trigger:**
If we ever need Jest-specific features (e.g. module mocking via `jest.mock`) — unlikely for this project's test surface.

### ADR-029: Three-step receipt flow — upload → OCR queue → review → confirm

**Date:** 2026-05-23
**Status:** Accepted
**Phase:** Phase 5e

**Context:**
ADR-023 established a two-step upload pattern: `uploadReceiptAction` → `createExpenseAction`. Phase 5e adds async OCR between upload and expense creation. The user uploads, OCR runs in the background, then the user reviews extracted data before confirming. This extends the two-step pattern to a three-step flow.

**Options considered:**

1. **Upload → wait for OCR synchronously → show prefilled form** — User waits 5–10 seconds on the upload page while OCR runs. Simple to implement but bad UX — user stares at a spinner with no feedback.
2. **Upload → enqueue OCR → redirect to review page → poll for results** — User sees the review page immediately with a spinner. OCR runs in the background. User gets live feedback (elapsed time). If OCR fails, user can still enter data manually without re-uploading.
3. **Upload + create expense immediately, attach OCR results later** — Expense is created without OCR data, OCR runs later and updates the expense. Complicates the expense model (partially-filled vs complete).

**Decision:**
Option 2: redirect to `/receipts/[id]/review` after enqueuing OCR. Poll every 3 seconds for results.

**Reasoning:**
- Best UX: user sees progress, can bail out to manual entry at any point
- OCR failure is non-fatal — the receipt is already saved, user can manually enter
- `?warning=ocr_failed` on the redirect URL communicates that OCR was never queued (e.g., `createOcrJobAction` failed), so the review page skips polling entirely
- Consistent with ADR-023's separation-of-concerns principle — upload, OCR queueing, and expense creation remain three distinct actions

**Trade-offs we accept:**
- Three network round-trips total (upload + OCR queue + expense create) — acceptable at 6-user scale
- If the worker is not running, the review page polls forever showing "pending" — user must manually navigate away or refresh
- The `?warning=ocr_failed` query param is visible in the URL — acceptable since it only conveys "OCR didn't start", not sensitive data

**Revisit trigger:**
If polling latency becomes an issue (e.g., worker takes >30s), consider Server-Sent Events. If multiple pending receipts accumulate, consider a batch status endpoint.

---

### ADR-030: Frontend polling — 3-second `setInterval`, no SSE/WebSocket

**Date:** 2026-05-23
**Status:** Accepted
**Phase:** Phase 5e

**Context:**
The review page needs to know when OCR processing completes. Two approaches: client-side polling or server-push (SSE/WebSocket).

**Options considered:**

1. **3-second `setInterval` polling via server action** — Client calls `checkReceiptStatusAction` every 3s. Simple, no infrastructure changes. Adds one DB query every 3s per active review page.
2. **Server-Sent Events** — Server pushes status updates. Lower latency, fewer requests. Requires a dedicated SSE endpoint and connection management in Next.js.
3. **WebSocket** — Full bidirectional channel. Overkill for a single status update.

**Decision:**
Option 1: 3-second `setInterval` polling.

**Reasoning:**
At 6 users, the polling load is trivially small (at most 6 concurrent polls × 1 query/3s = 2 queries/second peak). SSE adds complexity (event stream handling, reconnection logic, Next.js route constraints) with no meaningful benefit at this scale. The 3-second interval is imperceptible to the user — OCR takes 5–10 seconds, so the UI updates within 1–2 poll cycles of completion.

**Implementation details:**
- Initial poll fires via `setTimeout(0)` inside `useEffect` (avoids React's sync-setState-in-effect lint rule)
- `useCallback` wraps the poll function so the interval reference is stable
- A second `useEffect` watches `pageStatus` and clears the interval when status is `completed` or `failed`
- `?warning=ocr_failed` on mount → polling skipped entirely (no `ocr_jobs` row exists)

**Trade-offs we accept:**
- Maximum 3-second staleness between OCR completion and UI update
- One extra DB query every 3 seconds per active review page (trivial)
- No reconnection logic needed — if a poll fails, the next interval retries naturally

**Revisit trigger:**
If user count exceeds 50 or if OCR latency drops below 2 seconds (e.g., switching to Claude OCR), consider SSE for instant feedback.

---

### ADR-031: Receipt ownership check in `createExpenseAction` (not in query layer)

**Date:** 2026-05-23
**Status:** Accepted
**Phase:** Phase 5e

**Context:**
A security review during Phase 5e Session B found that `createExpense` in `lib/db/queries.ts` accepts a `receiptId` parameter without verifying the receipt belongs to the user. A malicious client could inject another user's receipt ID. While the receipt file itself is protected by the API route's userId check, data integrity is violated (wrong receipt linked to expense). The ownership check needs to live somewhere.

**Options considered:**

1. **Check in `createExpense` (query layer)** — Consistent with other query helpers that verify ownership (e.g., `updateExpense` checks `getExpenseById` first). But `createExpense` currently has no ownership checks because it creates a new row with `userId` from the session — it doesn't need to. Adding a cross-table check here breaks the single-responsibility pattern.
2. **Check in `createExpenseAction` (action layer)** — The server action already has the session and can call `getReceiptById(userId, receiptId)` before calling `createExpense`. Keeps the query layer focused on its own table's data.
3. **Check via a database constraint (FK trigger)** — PostgreSQL could enforce that `receipts.userId` matches `expenses.userId` for the referenced row. Requires a composite foreign key or a trigger. Over-engineered for this scale.

**Decision:**
Option 2: ownership check in `createExpenseAction`.

**Reasoning:**
The server action is the natural integration point — it has the session user ID and orchestrates multiple query calls. Adding a `getReceiptById` check before `createExpense` is minimal, readable, and doesn't change the query layer's contract. This is consistent with ADR-012 (server actions in `lib/actions/` as the orchestration layer) and ADR-023 (server actions verify ownership before mutations).

**Trade-offs we accept:**
- If `createExpense` is ever called from a different code path (e.g., a bulk import action), that path must also add the ownership check — there is no enforcement at the DB level
- The check adds one extra DB query per expense creation with a receipt (one `SELECT` from `receipts` before the `INSERT` into `expenses`)

**Revisit trigger:**
If expense creation throughput becomes a concern (unlikely at 6 users), consider moving the check to the query layer or using a DB-level constraint.


---

## ADR-032 — Worker path translation for Windows dev + Docker OCR

**Date:** 2026-05-24
**Status:** Accepted

**Context:**
In local dev the Next.js app runs bare-metal on Windows and stores receipt `imagePath` values using Node's `path.join`, which produces Windows-style relative paths (`var\receipts\userId\file.jpg`). The OCR worker also runs bare-metal and sends this path to the OCR service, which runs inside Docker (Linux). Inside the container, `os.path.realpath()` treats backslashes as literal characters (not separators), so the path never resolves within `STORAGE_REAL` and OCR fails with 404/400.

**Options considered:**

1. **Fix at upload (store Docker-compatible paths)** — Change `uploadReceiptAction` to store paths in Linux format. Breaks file serving on Windows (Node reads files using OS paths).
2. **Fix at the OCR service (accept Windows paths)** — Add platform-aware path handling in Python. Fragile; the container is always Linux.
3. **Fix in the worker (translate before sending)** — Add a `toOcrPath()` helper in `lib/worker.ts` that converts Windows absolute paths to Docker-compatible Linux paths (`C:\...` → `/c/...`). No-op on Linux (production Docker worker). Minimal, isolated, reversible.

**Decision:**
Option 3: `toOcrPath()` in `lib/worker.ts`, guarded by `process.platform !== 'win32'`.

**Reasoning:**
The mismatch is a local-dev-only concern. Production runs both the worker and OCR service in Docker on Linux — paths are already consistent. The translation is a one-liner conversion (drive letter → `/x/`, backslashes → forward slashes), localised to the single caller, and has zero impact on any other code path.

**Trade-offs we accept:**
- If the project structure ever moves (e.g., receipts stored on a UNC path `\server\share\...`), the conversion will need updating.
- The imagePath stored in the DB remains Windows-relative — not ideal but acceptable until production Docker normalises it.

**Revisit trigger:**
When the local dev worker is containerised (i.e., run via `docker compose` instead of bare-metal), this helper becomes unreachable and can be removed.

---

## ADR-033 — Expense search via URL param + server-side `ilike`

**Date:** 2026-05-24
**Status:** Accepted

**Context:**
Phase 6 adds search-by-note to the `/expenses` list. Three approaches were possible: (1) client-side filtering of the already-fetched page, (2) a dedicated `/api/search` route, or (3) a `?q=` URL param that the Server Component reads and passes to the existing `getExpenses` query.

**Decision:**
Option 3: `?q=` URL param, Zod-validated in the Server Component, passed as `search?: string` to `getExpenses`, which adds `ilike(expenses.note, '%term%')` inside the existing `and(eq(expenses.userId, userId), ...)` clause.

**Reasoning:**
- Search state lives in the URL — bookmarkable, shareable, works with browser back/forward.
- Pagination (`?page=`) and search (`?q=`) compose naturally via `URLSearchParams`.
- The Server Component already does the session check and data fetch — no extra round-trip.
- `ilike` (case-insensitive LIKE) is a single Drizzle clause — no raw SQL, multi-tenancy preserved because `userId` filter is the unconditional outer `and()` condition.
- The 300 ms debounce in `SearchBar` keeps round-trips low without any added complexity.

**Trade-offs we accept:**
- Full-text ranking (relevance ordering) is not provided. Acceptable for 6 users.
- `ilike '%term%'` on a growing table is unindexed; at 6-user scale this is not a concern.

**Revisit trigger:** If note/merchant columns grow to tens of thousands of rows or full-text ranking is needed, migrate to a PostgreSQL `tsvector` index with `to_tsquery`.

---

## ADR-034 — Account deletion: manual cascade order + filesystem cleanup

**Date:** 2026-05-24
**Status:** Accepted

**Context:**
Better-Auth provides a `deleteUser` endpoint but it requires `options.user.deleteUser.enabled = true` and optionally an email-verification step. Enabling it would also give Better-Auth full control of the deletion order, with no hook for cleaning up receipt files on disk before the rows are gone.

**Decision:**
Manual deletion in `deleteUserData(userId)` within a single Drizzle transaction:
1. Collect `imagePath[]` from receipts **before** the transaction (can't read deleted rows).
2. Transaction: `DELETE expenses` → `DELETE receipts` (cascades `ocrJobs`) → `DELETE categories` → `DELETE user` (cascades `sessions`, `accounts`).
3. After transaction: `fs.unlink` each path, best-effort (never fails the action).

**Reasoning:**
- The explicit order avoids any ambiguity from simultaneous PostgreSQL CASCADE + SET NULL triggers (e.g., `expenses.categoryId → categories.id SET NULL` firing mid-cascade while expenses are being deleted).
- Collecting paths before the transaction means we always have the list even if the file cleanup runs after the DB commit.
- `fs.unlink` failures are swallowed — an orphaned file is less bad than a failed account deletion.
- No extra config, no email verification step, no opt-in flag.

**Trade-offs we accept:**
- If `deleteUserData` succeeds but the process crashes before `fs.unlink`, receipt files become orphans. Acceptable at this scale.
- Better-Auth's built-in `afterDelete` lifecycle hook is bypassed. We have no plugins that depend on it.

**Revisit trigger:** If we add Better-Auth plugins that hook into user deletion (e.g., audit logs, billing), switch to enabling Better-Auth's `deleteUser` with a `beforeDelete` hook for file cleanup.

---

### ADR-035: Sentry DSN is optional in env schema — app boots without it

---

### ADR-036: User cap enforced via `databaseHooks.user.create.before`
**Date:** 2026-05-26
**Status:** Accepted
**Phase:** Post-v1.0

**Context:**
App is designed for personal/family use with a hard upper limit on tenants. Need to prevent unlimited signups without requiring an invite system.

**Options considered:**
1. Client-side check before calling `authClient.signUp.email()` — bypassable, not secure
2. Custom API route wrapping signup — adds complexity, duplicates Better-Auth logic
3. `databaseHooks.user.create.before` — runs server-side inside Better-Auth before the DB insert; throwing blocks creation and surfaces the error to the client

**Decision:**
Option 3. One `before` hook in `lib/auth/index.ts` with a `MAX_USERS = 10` constant. `getUserCount()` in `lib/db/queries.ts` counts all rows in the `user` table. If `count >= MAX_USERS`, throws — Better-Auth returns the error to the client as `authError.message`.

**Consequences:**
- Cannot be bypassed from the browser
- To raise or lower the limit: change `MAX_USERS` in `lib/auth/index.ts` and redeploy
- `getUserCount()` is a system query with no `userId` filter — documented as such in `queries.ts`

**Date:** 2026-05-25
**Status:** Accepted
**Phase:** Phase 6

**Context:**
Sentry error tracking was added in Phase 6. The DSN must be configured for errors to be captured. The question is whether a missing DSN should be a hard boot failure (required env var) or a soft degradation (optional — Sentry simply stays disabled).

**Options considered:**
1. **Required** (`z.url()`) — guarantees Sentry is always configured; boot fails loudly if DSN is missing. Risk: blocks local dev setups that don't have a Sentry account, or future contributors who haven't configured it.
2. **Optional** (`z.string().optional()`) — app boots without it; Sentry SDK silently no-ops when DSN is absent. Monitoring is degraded but the app is fully functional.

**Decision:**
Option 2: `SENTRY_DSN: z.string().optional()`.

**Reasoning:**
Sentry is observability infrastructure, not application logic. A missing DSN means less visibility into errors — it does not break any user-facing feature. Making it required would break `npm run dev` for anyone who hasn't set up Sentry, which is bad developer experience for a self-hosted personal project. The Sentry SDK already handles a missing DSN gracefully (it no-ops).

**Trade-offs we accept:**
- It is possible to run production without Sentry configured. No runtime warning is emitted.
- `SENTRY_AUTH_TOKEN` is kept exclusively in `.env.sentry-build-plugin` (gitignored) — never in source or committed env files. This is enforced by `.gitignore`, not by the Zod schema.

**Revisit trigger:** Never — this is appropriate for the project's scale and audience.

---

### ADR-037: HTTP security headers via next.config.ts global headers() rule
**Date:** 2026-06-07
**Status:** Accepted
**Phase:** Post-v1.0

**Context:**
OWASP ZAP baseline scan (2026-06-07) found 9 actionable WARN findings, all missing HTTP response headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Permissions-Policy, COEP, COOP, Cache-Control on auth pages, X-Powered-By leak. No injection or authentication vulnerabilities found.

**Options considered:**
1. **Next.js middleware** — set headers in `proxy.ts` for every request. Works but middleware is already used for session redirect; mixing concerns in one file risks accidental header drops on new routes.
2. **Per-route `response.headers.set()`** — set headers individually in each route handler and page. Fragile: any new route silently omits headers.
3. **`headers()` in `next.config.ts`** — declarative, applied globally by Next.js before the response leaves the server. A single `source: "/(.*)"` rule covers all current and future routes with no per-route boilerplate. Auth-page cache rule is a supplemental entry in the same array.

**Decision:**
Option 3. Added `securityHeaders` array and `headers()` async function to `next.config.ts`. Added `poweredByHeader: false` to suppress `X-Powered-By`.

**Headers applied globally:**
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`
- `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.ingest.sentry.io; frame-ancestors 'none'`

**Auth pages additionally:**
- `Cache-Control: no-store` on `/sign-in` and `/sign-up`

**CSP trade-offs:**
`unsafe-inline` and `unsafe-eval` are required by Next.js App Router for hydration chunks. Tightening to a nonce-based CSP would require changes to the Next.js build pipeline and is out of scope for a 10-user self-hosted app. `frame-ancestors 'none'` duplicates `X-Frame-Options: DENY` for browsers that prefer CSP.

**Consequences:**
- All future routes automatically inherit these headers with no developer action
- `COEP: require-corp` may break third-party iframes or cross-origin resources if added later — revisit if that happens
- CSP `connect-src` must be updated if new external API calls are added (e.g., a payment provider)

**Revisit trigger:** Adding a third-party embed, payment provider, or CDN for static assets.

---

### ADR-038: Dashboard v2 — recharts pie chart + removal of Last 30 Days rolling window
**Date:** 2026-06-12
**Status:** Accepted
**Phase:** Post-v1.0 (Dashboard v2)

**Context:**
Two dashboard improvements requested: (1) add a pie chart visualisation for category spending, and (2) remove the "Last 30 Days" rolling-window metric card. Phase 3's original plan noted "chart in V2" for the category breakdown.

**Options considered (charting library):**

1. **recharts** — Most popular React charting library. shadcn/ui provides a `chart` component built on recharts. Declarative API, good TS types.
2. **chart.js + react-chartjs-2** — Canvas-based, larger bundle, imperative config, no shadcn integration.
3. **visx (Airbnb)** — Low-level D3 primitives for React. Very flexible but requires significantly more code for a simple pie chart.
4. **Nivo** — React + D3. Good pie chart, but another dependency without shadcn integration.

**Decision:**
recharts v3 via `npm install recharts`, integrated through shadcn's `ChartContainer` / `ChartTooltip` / `ChartTooltipContent` components (`npx shadcn@latest add chart`).

**Pie chart placement:**
Option A (side-by-side with table), Option B (replaces table), or Option C (above the table). Chose **Option C** — full-width donut chart above the existing category breakdown table. The table provides exact numbers; the chart provides visual proportion. Stacked layout works well on mobile. Pie slices have no inline labels — a color-key legend below the chart maps each color to its category, avoiding label crowding on thin slices.

**Removal of Last 30 Days rolling window:**
The "Last 30 Days" card was initially added in Phase 3 alongside "This Month" and "Filtered Total". Feedback was that a rolling 30-day window overlapping with the current-month total is redundant. The `getDashboardSummary` query was simplified from three DB queries to two (current month + last month), removing the last30Days computation. The dashboard metric card grid changed from `sm:grid-cols-3` to `sm:grid-cols-2`.

**Reasoning:**
- recharts is the path of least resistance because shadcn's `chart` component is built for it
- The donut chart + table combination preserves both at-a-glance visual and exact drill-down data
- Removing the last30Days query reduces DB load (one fewer aggregation per dashboard load)

**Trade-offs we accept:**
- recharts adds ~120KB gzipped to the client bundle (acceptable for 6-user self-hosted app)
- 10-color hardcoded palette in `CategoryPieChart` — categories beyond 10 wrap around and reuse colors
- The pie chart is a Client Component (`'use client'`) while the rest of the dashboard is a Server Component — inevitable for any interactive chart library

**Revisit trigger:**
If more than 10 distinct categories are in active use, extend the color palette or switch to a dynamically generated palette.

---

### ADR-039: UI localised to Manglish / Bahasa rojak — app renamed to KasiKira
**Date:** 2026-06-12
**Status:** Accepted
**Phase:** Post-v1.0

**Context:**
The app serves a Malaysian audience (family/friends, 6 users max). The original English UI felt too formal and "business serious." The request was to convert terminology to a relaxed, local-dialect tone that could include humour.

**Options considered:**

1. **Full formal BM translation** — "Amaun", "Kaedah Pembayaran", "Log Masuk". Grammatically correct but reads like a government form. Wrong tone.
2. **English only** — current state. Functional but impersonal.
3. **Manglish / Bahasa rojak** — hybrid Malaysian colloquial. "Emel", "Kata Laluan" for trust-sensitive fields; "Bulan Ni", "Jom catat belanja pertama", "Mana Duit Pi?" for everything else. Relaxed, conversational, appropriate for a personal finance app among friends.

**Decision:**
Option 3. Every user-facing string in all 14 UI files was localised. The app name changed from `MyExpense` to `KasiKira` ("just count it"). Technical labels (CSV, OCR) and server-side Zod error messages remain in English.

**Key naming conventions:**
- Auth: "Masuk" / "Daftar akaun" — clean, familiar
- Nav: "Ringkasan", "Belanja", "Tetapan", "Log keluar"
- Dashboard: "Bulan Ni", "Bulan lepas", "Jumlah Ditapis", "Mana Duit Pi?"
- Forms: "Jumlah (RM)", "Kategori", "Tarikh", "Cara Bayaran", "Nota (kalau nak)…"
- Payment: "Tunai", "Kad", "E-Wallet", "Lain-lain"
- Delete: "Padam belanja ni?", "Sekali padam, tak boleh patah balik."
- Settings danger zone: "Zon Bahaya" — deliberate edge
- Brand: "KasiKira" replaces "MyExpense" in the Nav

**Trade-offs we accept:**
- Non-Malaysian users will find some strings unfamiliar — acceptable for a 6-user self-hosted family app
- The "PADAM" confirmation keyword in the delete-account flow replaces "DELETE" — UX is the same, just localised
- Some strings ("E-Wallet") stay English because there is no established BM equivalent more recognisable than the English term

**Revisit trigger:**
If non-Malaysian users join, or if the app is ever open-sourced to a wider audience, consider i18n with locale files instead of hardcoded strings.
