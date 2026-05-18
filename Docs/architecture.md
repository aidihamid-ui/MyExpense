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
