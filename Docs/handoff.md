# Handoff

**Read this at the start of every Claude Code session.** It's the single source of truth for where the project stands right now.

**Last updated:** 2026-06-12
**Last session by:** Claude
**Current phase:** Phase 6 COMPLETE — v1.0 live. Dashboard v2 (pie chart via recharts, Last 30 Days removed, label crowding fix).

---

## Current State

### What's working

- Next.js 16.2.6 (App Router, TypeScript strict, Tailwind 4) at `localhost:3000`
- PostgreSQL 17.10 via Scoop at `localhost:5432`
  - Role: `myexpense` / password: `myexpense_dev` / DB: `myexpense_dev`
- Better-Auth 1.6.11 email/password auth (verification disabled)
- Session guard: `proxy.ts` — `/dashboard` and `/expenses/:path*` without cookie redirect to `/login`
- All protected server components double-check session with `auth.api.getSession()`
- Two test accounts in DB: `user-a@test.com` / `user-b@test.com` (password: `password123`)
- `npm run typecheck` — clean
- `npm run lint` — clean (ESLint flat config, `eslint-config-next/core-web-vitals` + TypeScript rules)
- `npm run build` — passes
- **VPS deploy live at https://myexpense.srv1488589.hstgr.cloud** ✓ (Phase 4 — deployed and verified 2026-05-19)
- GitHub: `https://github.com/aidihamid-ui/MyExpense.git` — up to date

**Phase 4 — COMPLETE:**

_Schema (migration 0002):_
- `receipts` table: id, userId (→ users.id cascade delete), imagePath, originalName, mimeType, sizeBytes, status (default 'pending'), rawOcrText, extractedDataJson, error, createdAt
- `expenses.receiptId` optional FK → receipts.id (set null on delete)

_Upload action (`lib/actions/receipts.ts`):_
- `uploadReceiptAction(formData)` — validates session, presence, 5MB max, MIME whitelist (JPEG/PNG/WebP/PDF), magic bytes, EXIF strip (sharp default, ADR-024), UUID filename, mkdir -p, write, DB insert
- Returns `{ ok: true, data: { receiptId } }` or `{ ok: false, error: { code, message } }`

_Query layer (`lib/db/queries.ts`):_
- `createReceipt(userId, data)` — inserts receipts row
- `getReceiptById(userId, receiptId)` — filters by userId (multi-tenancy boundary)
- `getExpenses` — updated to include `receiptId` in select

_Receipt serving route (`app/api/receipts/[id]/route.ts`):_
- Session check → 401; ownership via `getReceiptById` → 404; path traversal guard (path.resolve + sep); stream as Blob; `Cache-Control: private, no-store`

_Env (`lib/env.ts`, Dockerfile):_
- `STORAGE_PATH: z.string().min(1)` — no default; must be set. `.env.local` and `.env.example` already had it.
- Dockerfile builder stage: `ENV STORAGE_PATH=/tmp/receipts`

_UI:_
- `/expenses/new` — optional file input; two-step submit (upload first → receiptId → create); shows uploading/done/error state (ADR-023)
- `/expenses` list — "Receipt" link (opens in new tab) when `receiptId` is set; shown in both desktop table and mobile cards

_Docs:_
- `docs/architecture.md` — ADR-023 (two-step upload pattern) and ADR-024 (sharp EXIF default) added
- `docs/integration-map.md` — sections 14 (upload action), 15 (serving route), 16 (STORAGE_PATH) added

_Dependencies added:_
- `sharp@^0.34.5`

**Phase 3 — COMPLETE:**

_Query layer (`lib/db/queries.ts`):_
- `getDashboardSummary(userId, now)` — currentMonthTotal, lastMonthTotal; all boundaries computed in MYT (UTC+8) from `now: Date` (ADR-020). last30DaysTotal removed in dashboard v2.
- `getCategoryBreakdown(userId, from, to)` — array of {categoryId, categoryName, total, count} ordered by total desc; uncategorized grouped as 'uncategorized'
- `getFilteredExpenseSummary(userId, from, to, categoryId?)` — {total, count} for the active filter
- `getUserCategories` — alias for existing `getCategories`
- Imports extended: `count, gte, lt, lte, sum` from drizzle-orm

_Dashboard page (`app/dashboard/page.tsx`):_
- Server Component; reads `searchParams` (Promise in Next.js 16) for `from`, `to`, `categoryId`
- Zod `safeParse` validation — invalid params fall back to MYT current-month defaults silently (ADR-019)
- Row 1: 2 metric cards — This Month, Filtered Total (all formatted `RM X,XXX.XX`). Last 30 Days card removed in dashboard v2.
- Row 2: FilterBar client component
- Row 3: Category pie chart (donut via recharts + shadcn chart). Labels hide category name on small slices (&lt;7%) to prevent crowding.
- Row 4: Category breakdown table — Category | Amount | Transactions | % of Total; empty state message
- `formatRM()` helper — `en-MY` locale, 2 decimal places

_Filter bar (`app/dashboard/filter-bar.tsx`):_
- Client Component; controlled state (`useState`) initialized from server props (ADR-022)
- From/to date inputs, category dropdown (controlled Radix Select, no `name` prop — ADR-021)
- Apply → `router.push('/dashboard?from=...&to=...&categoryId=...')`
- Reset → `router.push('/dashboard')` + resets local state to MYT defaults

_Nav (`components/nav.tsx`):_
- Sign Out button added to right side; calls `authClient.signOut()` → `router.push('/login')`
- `logout-button.tsx` in `app/dashboard/` is now unused (kept for reference; delete later if desired)

_Docs:_
- `docs/architecture.md` — ADRs 019–022 added
- `docs/integration-map.md` — created; reference card for all integration points
- `CLAUDE.md` — integration-map.md added to Document Map

**Phase 2 — COMPLETE (all sessions):**

_DB layer:_
- `categories` + `expenses` tables in schema and DB (migration 0001 applied locally; VPS on Phase 2 schema)
- `seedDefaultCategories(userId)` — idempotent, fires via `databaseHooks.user.create.after`
- `lib/db/queries.ts` — full CRUD with userId filter on all operations
- `lib/validators/expense.ts` — `createExpenseSchema` + `updateExpenseSchema`

_UI layer:_
- `/expenses` — paginated list (20/page prev/next), desktop table + mobile cards, empty state, Edit + Delete per row
- `/expenses/new` — add form (amount, category, date, payment method, note), field-level Zod errors
- `/expenses/[id]/edit` — pre-filled edit form, same validation; wrong-owner → 404
- Delete confirmation modal (`components/delete-expense-button.tsx`) — `revalidatePath` + `router.refresh()` on success
- `lib/actions/expenses.ts` — `createExpenseAction`, `updateExpenseAction`, `deleteExpenseAction`
- Tagged `v0.2-expenses-done`

_Security (verified):_
- user-b visiting `/expenses/[user-a-id]/edit` → HTTP 404
- Query layer: `getExpenseById(user-b-id, user-a-expense-id)` → 0 rows → delete blocked → expense intact

**For startup commands and the full local env runbook, see `Docs/environment.md`.**
**For VPS deploy and future deploys, see `Docs/deployment.md`.**

### Phase 5d — COMPLETE (2026-05-22)

_Parser (`lib/ocr/parser.ts`):_
- `parseReceiptText(rawText): ParsedReceipt` — `{ total, date, merchant }`
- **total**: keyword pattern (TOTAL/JUMLAH/AMAUN/AMOUNT/GRAND TOTAL) + RM fallback; takes largest value; strips commas
- **date**: DD/MM/YYYY → YYYY-MM-DD; YYYY-MM-DD passthrough; validates month 1-12, day 1-31
- **merchant**: first non-empty, non-digit, non-skip-prefix line (max 3 tries, capped 80 chars)

_Tests (`lib/ocr/parser.test.ts`):_
- 10 vitest tests, all passing — `npm run test`

_Dependencies:_
- `vitest@^4.1.7` added to devDependencies
- `"test": "vitest run"` added to package.json scripts

---

### Phase 5e Session A — COMPLETE (2026-05-23)

_Backend-only — no UI changes. Commit `a9b6236`._

_env + Dockerfile:_
- `OCR_SERVICE_URL: z.url()` (was `.optional()`) in `lib/env.ts` — now required
- Dockerfile builder stage: `ARG`/`ENV` placeholders for `OCR_SERVICE_URL` and `OCR_SECRET`

_Worker parser wiring (`lib/worker.ts`):_
- After OCR succeeds, calls `parseReceiptText(result.text)` → stores `JSON.stringify(parsed)` as `extractedDataJson` on the receipt row
- `markOcrJobDone` signature updated to accept `extractedDataJson: string` (4th param)

_Query layer (`lib/db/queries.ts`):_
- `createOcrJob(receiptId)` — inserts pending ocr_jobs row (system query, no userId filter)
- `getReceiptStatus(userId, receiptId)` — returns `{ status, extractedDataJson, rawOcrText }` filtered by userId

_Action (`lib/actions/receipts.ts`):_
- `createOcrJobAction(receiptId)` — validates UUID → session check → ownership via `getReceiptById` → inserts OCR job

_Migration:_
- Migration 0003 (`ocr_jobs` table) applied locally via `npm run db:migrate`

_Docker:_
- New `worker` Dockerfile stage — copies deps + source, runs via `tsx`
- `worker` service in `docker-compose.yml` — same env vars as `app`, `STORAGE_PATH` mounted `:ro`, depends on `db` (healthy) + `ocr-service` (started), no published ports

---

### Phase 5c — COMPLETE (2026-05-22)

_Schema (`lib/db/schema.ts`):_
- `ocrJobs` table: id (uuid PK), receiptId (uuid FK→receipts cascade), status (pending|processing|done|failed), attempts (int, default 0), scheduledFor (timestamp, default now()), lastError (text nullable)

_Queries (`lib/db/queries.ts`):_
- `claimNextOcrJob()` — atomically claims one pending job (FOR UPDATE SKIP LOCKED), returns job row + imagePath or null
- `markOcrJobDone(jobId, receiptId, ocrText)` — sets job done, receipt completed + rawOcrText
- `markOcrJobFailed(jobId, receiptId, error, attempts)` — if attempts ≥ 3: permanent fail; else: reschedule +30s with attempts+1

_Worker (`lib/worker.ts`):_
- Polls every 5s via `setInterval`
- Calls `PaddleOcrProvider.extractFromImage` on claimed jobs
- Logs each event: claimed | done | failed
- Graceful shutdown on SIGTERM/SIGINT

_Migration:_
- `lib/db/migrations/0003_misty_emma_frost.sql` — generated, **NOT applied yet** (apply in Phase 5e with `make migrate`)

_Note:_ All `db:*` scripts now use `node_modules/drizzle-kit/bin.cjs` directly (fixed — see `Docs/environment.md` § Database Scripts).

---

### Phase 5b — COMPLETE (2026-05-22)

_OcrProvider interface (`lib/ocr/provider.ts`):_
- `OcrResult { text: string; lines: string[] }`
- `OcrProvider { extractFromImage(imagePath: string): Promise<OcrResult> }`

_PaddleOcrProvider (`lib/ocr/paddle.ts`):_
- Reads `env.OCR_SERVICE_URL` and `env.OCR_SECRET`
- `POST {OCR_SERVICE_URL}/ocr` with body `{ path: imagePath }` and `X-OCR-Secret` header
- Non-200 response → `Error('OCR service returned <status>')`
- Network failure → `Error('OCR service unreachable: ...')`
- No retry logic (retries go in Phase 5c worker)

_Env (`lib/env.ts`):_
- `OCR_SERVICE_URL: z.url().optional()` added

_Docs:_
- `Docs/integration-map.md` — section 18 added (OcrProvider usage pattern)

---

### Phase 5e Session B — COMPLETE (2026-05-23)

_Commit `c751713`. This session built the UI and final wiring._

_Upload flow (`app/expenses/new/expense-form.tsx`):_
- After `uploadReceiptAction` succeeds, calls `createOcrJobAction(receiptId)`
- On OCR queue success: redirects to `/receipts/[id]/review`
- On OCR queue failure: redirects to `/receipts/[id]/review?warning=ocr_failed`
- Three-state label: "Uploading receipt…" → "Starting OCR…" → redirect
- No-file path unchanged (direct `createExpenseAction`)

_Review page (`app/receipts/[id]/review/`):_
- `page.tsx` — Server Component: session check, `getReceiptById` (notFound on miss), fetches categories, reads `?warning=ocr_failed` search param
- `review-client.tsx` — Client Component with 4 sub-views:
  - **LoadingView** — spinner, "Checking receipt status…"
  - **PendingView** — spinner + "Analysing…" with elapsed time counter
  - **CompletedView** — green banner + prefilled expense form (merchant→note, date, total→amount) + collapsible raw OCR `<details>`
  - **FailedView** — amber warning + blank expense form
- Polling: `checkReceiptStatusAction` every 3s via `setInterval`; stops on completed/failed
- `?warning=ocr_failed` → skips polling entirely, renders FailedView immediately
- Shared `ExpenseForm` component with `useActionState` → `createExpenseAction` + hidden `receiptId`

_Server action (`lib/actions/receipts.ts`):_
- `checkReceiptStatusAction(receiptId)` — validates UUID → session check → `getReceiptStatus(userId, receiptId)` → returns status + extracted data

_Proxy (`proxy.ts`):_
- Matcher extended: `/receipts/:path*` added for UX redirect on unauthenticated users

_Multi-tenancy fix (`lib/actions/expenses.ts`):_
- `createExpenseAction` now verifies receipt ownership via `getReceiptById(userId, receiptId)` before creating expense — prevents cross-user receiptId injection

_Docs:_
- `CLAUDE.md` — Doc paths normalised from `Docs/` to `docs/`


---

### Phase 5a — COMPLETE on VPS (2026-05-20)

_OCR sidecar (`ocr-service/`):_
- `Dockerfile` — python:3.11-slim, apt deps for OpenCV/libGL, pip install, uvicorn CMD bound to `0.0.0.0:8001`
- `requirements.txt` — fastapi, uvicorn, paddlepaddle==2.6.2 (CPU), paddleocr==2.9.1, Pillow
- `main.py` — env validation at startup (STORAGE_PATH + OCR_SECRET required, exit 1 if missing); PaddleOCR singleton loaded once in FastAPI lifespan; `/health` (no auth); `/ocr` POST (X-OCR-Secret header auth + `os.path.realpath` path traversal guard)

_docker-compose.yml changes:_
- `ocr-service` service added: no `ports:`, STORAGE_PATH mounted `:ro`, `paddleocr_cache` named volume at `/root/.paddleocr`
- `app.depends_on` extended to include `ocr-service: condition: service_started`
- `app` env: `OCR_SECRET`, `OCR_PROVIDER` (default: `paddle`) added
- `paddleocr_cache` named volume added

_Docs:_
- `Docs/architecture.md` — ADR-025 appended (OCR binds 0.0.0.0 inside container, no ports published)

#### Post-v1.0 — HTTP security headers (2026-06-07)

_Commit `fe21f07`. No schema changes, no new dependencies._

- `next.config.ts` — `securityHeaders` array + `headers()` config added; `poweredByHeader: false`
- Headers applied globally: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Permissions-Policy, COEP, COOP
- Auth pages (`/sign-in`, `/sign-up`) additionally get `Cache-Control: no-store`
- Remediates all 9 actionable findings from OWASP ZAP baseline scan (2026-06-07)
- Two ZAP WARN findings confirmed false positives: [10202] CSRF (Better-Auth uses SameSite cookies), [10031] XSS (React auto-escaping)
- **Note:** ZAP only scanned 28 unauthenticated URLs — protected routes (/dashboard, /expenses, /receipts, /api/*) were NOT tested. Run authenticated ZAP scan to complete coverage.

---

#### Post-v1.0 — 10-user cap (2026-05-26)

_Commit `4afa9cf`. No schema changes, no new dependencies._

- `lib/db/queries.ts` — `getUserCount()` system query added (counts all rows in `user` table, no userId filter)
- `lib/auth/index.ts` — `MAX_USERS = 10` constant + `databaseHooks.user.create.before` hook: throws if `getUserCount() >= MAX_USERS`, blocking signup server-side
- Error message shown in signup form: "Registration is closed. This app has reached its maximum number of users."
- To change the limit: update `MAX_USERS` in `lib/auth/index.ts`

---

#### Post-v1.0 — PDPA compliance (2026-05-26)

_Commit `05ccdb7`. No schema changes, no new dependencies._

- `app/privacy/page.tsx` — new public static page (`○` prerendered); full PDPA 2010 privacy policy: data collected, no third-party sharing, Hostinger storage, delete-account = full removal, user rights, contact email
- `app/(auth)/signup/page.tsx` — consent checkbox added; "Create account" button disabled until checked; checkbox links to `/privacy` (opens in new tab)
- `app/(auth)/layout.tsx` — footer added to login + signup pages: "Your data is private and never shared. Privacy Policy"
- `CLAUDE.md` — Session Protocol updated: read handoff + architecture + integration-map first; only read source files if those three don't provide enough context

---

#### Phase 6 Session E — COMPLETE (2026-05-25)

_Commits `f93a49c`, `523fb22`, `3bd8c7b`, `4a82778`._

_Sentry error tracking + README. No schema changes, no new DB queries._

_Sentry (`@sentry/nextjs@^10.53.1`):_
- Wizard generated: `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `app/global-error.tsx`, `next.config.ts` (`withSentryConfig` wrapper)
- `SENTRY_AUTH_TOKEN` stays in `.env.sentry-build-plugin` (gitignored — wizard added the rule); never committed
- `lib/env.ts`: `SENTRY_DSN: z.string().optional()` — app boots without it (ADR-035)
- `.env.example`: `SENTRY_DSN=` placeholder; `.env.local`: DSN set (gitignored)
- Verified: `SentryExampleFrontendError` + `SentryExampleAPIError` both appeared in Sentry dashboard within seconds of triggering
- Example pages removed after verification

_README.md:_ Full rewrite replacing `create-next-app` boilerplate — what it does, tech stack, 4-terminal local setup, deploy reference, env var table, not-open-for-contributions note.

_ADR-035:_ `SENTRY_DSN` optional in env schema — Sentry is observability, not app logic; missing DSN degrades monitoring, not functionality.

---

#### Phase 6 Session D — COMPLETE (2026-05-25)

_Commit `4a45efb`._

_CSV export — no new dependencies, no schema changes._

_Query (`lib/db/queries.ts`):_
- `getAllExpensesForExport(userId)` — fetches all expenses (no limit/offset) with category left-join; selects date, amount, categoryName, note, paymentMethod; filtered by `eq(expenses.userId, userId)`; ordered by date desc

_Route (`app/api/expenses/export/route.ts`):_
- `GET` handler — session check via `auth.api.getSession` → redirect `/login` if unauthenticated
- Calls `getAllExpensesForExport(session.user.id)` — userId from session only, never from query params
- Builds RFC-4180 CSV: double-quote wrapping, `""` escaping for internal quotes, CRLF line endings
- Headers: `Date, Amount, Category, Note, Payment Method`
- Response: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="myexpense-YYYY-MM-DD.csv"`

_UI (`app/expenses/page.tsx`):_
- "Export CSV" anchor-button (`variant="outline"`, `h-11 px-5`) added alongside "Add expense" in heading row
- Simple `<a href="/api/expenses/export">` — browser follows and triggers download

_Multi-tenancy:_ Route reads `userId` exclusively from verified session; query filters by it unconditionally. Confirmed by code — user A's session cannot produce user B's rows.

---

#### Phase 6 Session C — COMPLETE (2026-05-25)

_Commit `51a7382`._

_Mobile responsive audit — 8 issues found and fixed. Phone testing at `http://192.168.1.105:3000` verified all pages work correctly._

- **Nav** (`components/nav.tsx`): Two-row layout on mobile — brand+sign-out on row 1, nav links as full-width tab strip on row 2 (with `border-t`). Desktop unchanged (brand + inline separator + links + sign-out, single row). All links `min-h-[44px]`.
- **Dashboard table** (`app/dashboard/page.tsx`): Wrapped 4-column category breakdown `<Table>` in `overflow-x-auto` div — horizontal scroll on narrow screens instead of overflow/clipping.
- **FilterBar** (`app/dashboard/filter-bar.tsx`): `h-9` → `h-11` on date inputs, category select; `flex-col` on mobile / `flex-row sm:flex-wrap` on desktop; date inputs `w-full` on mobile / `w-36` on sm; buttons paired `flex-1` on mobile via wrapper div.
- **Settings change-password form** (`app/settings/change-password-form.tsx`): Added `h-11` to all 3 password inputs; added `w-full` to submit button.
- **Expense forms** (`app/expenses/new/expense-form.tsx`, `app/expenses/[id]/edit/edit-expense-form.tsx`): Cancel button gets `flex-1` to match Submit width on mobile.

_No issues found on:_ /login, /signup, /expenses mobile cards, /receipts/[id]/review, delete dialogs.

_Phone login fix (commits `2dea104`, `056937f`):_
- **Better-Auth trusted origins** (`lib/auth/index.ts`): Added `BETTER_AUTH_TRUSTED_ORIGINS` env var support so LAN IP requests pass CSRF check. (Note: Better-Auth also reads this env var natively — the config entry is redundant but harmless.)
- **Next.js `allowedDevOrigins`** (`next.config.ts`): Root cause of phone login failure — Next.js 16 blocks cross-origin access to dev JS bundles from LAN IPs by default, causing the phone to receive HTML with no JS, making the form fall back to native submit. Fixed by adding `allowedDevOrigins: ['192.168.1.105']`.
- **`.env.local`**: `BETTER_AUTH_TRUSTED_ORIGINS=http://192.168.1.105:3000` added (gitignored).

_Phone test results (verified 2026-05-25):_
- [x] Login works from phone at `http://192.168.1.105:3000` ✓
- [x] Receipt upload via phone ✓ (OCR pipeline runs end-to-end)
- [x] Mobile layout fixes verified — nav tab strip, filter bar, forms all usable at 375px ✓

---

#### Phase 6 Session B — COMPLETE (2026-05-24)

_Commit `a353982`._

_Settings page (`app/settings/`):_
- `page.tsx` — Server Component: session guard, displays email, renders `ChangePasswordForm` + `DeleteAccountSection`
- `change-password-form.tsx` — Client Component: `useActionState` + `changePasswordAction`; fields: current password, new password, confirm new password; field-level Zod errors + success banner
- `delete-account.tsx` — Client Component: "Delete account" button → Dialog with typed confirmation (`DELETE`); confirm button gated on exact text match; calls `deleteAccountAction()` → on ok: `authClient.signOut()` + router push to `/login`

_Server actions (`lib/actions/settings.ts`):_
- `changePasswordAction(prevState, formData)` — Zod validates 3 fields + confirm match; session check; delegates to `auth.api.changePassword` (verifies current password internally); maps Better-Auth error messages ("Invalid password" → field error, "Password too short" → field error)
- `deleteAccountAction()` — session check; calls `deleteUserData(userId)`; deletes physical receipt files (best-effort); returns `{ ok: true }`

_Query layer (`lib/db/queries.ts`):_
- `deleteUserData(userId)`: Drizzle transaction, safe cascade order — expenses → receipts (cascades ocrJobs) → categories → user (cascades sessions/accounts); returns `imagePaths[]` for filesystem cleanup
- Added `user` to schema imports

_Nav/proxy:_
- `components/nav.tsx`: Settings link added to `links` array
- `proxy.ts`: `/settings/:path*` added to protected matcher

_Deleted:_ `app/dashboard/logout-button.tsx` (was unused since Phase 3)

---

### Phase 6 Session A — COMPLETE (2026-05-24)

_Commit `fe7614f`._

_Search (`app/expenses/`)_:
- `search-bar.tsx` — Client Component: controlled `<Input>`, 300ms debounce via `useRef`+`setTimeout`, calls `router.push('/expenses?q=<term>')` on change, resets page to 1
- `page.tsx` — reads `?q` from `searchParams`, Zod-validates (trim + max 200 chars, `.catch('')`), passes `search: q` to `getExpenses`, renders `<SearchBar>` between heading and list, pagination `<Link>` hrefs built via `buildHref(page, q)` to preserve `q` across pages
- Empty-state message varies: "No expenses match your search." when `q` is set

_Query layer (`lib/db/queries.ts`)_:
- `getExpenses`: new `search?: string` option; when non-empty adds `ilike(expenses.note, '%term%')` inside the existing `and(eq(expenses.userId, userId), ...)` — multi-tenancy preserved, no raw SQL
- Added `ilike` to drizzle-orm imports

_Multi-tenancy:_ `userId` filter is unconditional in the outer `and()`; search filter is nested inside it. User A's search cannot touch User B's rows.

---

## What's broken or incomplete

- Backup cron not yet set up on VPS (see `Docs/deployment.md` — Automated daily backup section)
- `user-a@test.com` has no expenses — test account only, safe to ignore or delete

### Post-v1.0 fixes (2026-05-25)

**`OCR_SERVICE_URL` missing from app container (`b5638c2`):**
`lib/env.ts` requires it (`z.url()`), so every request crashed with ZodError — signup/login broken. Worker had it in its env block; app service did not. Fixed in `docker-compose.yml`, deployed with `--force-recreate app` (no rebuild needed).

**Category dropdown appeared broken — data fix, not code:**
Two accounts (`aidi.hamid@yahoo.com.my`, `user-a@test.com`) were created during the ZodError crash window so `seedDefaultCategories` never ran for them. Fixed via direct SQL INSERT on VPS — no code changed.

**Travel and Home Care added to default categories (`96199ca`):**
Added to `lib/db/seed-categories.ts` (future signups get 9 categories). Seeded directly to all 3 existing VPS accounts via SQL. Deployed via `make deploy`.

- Last commit: `96199ca` — [Phase 6] feat: add Travel and Home Care to default categories

### Phase 5a VPS verification — COMPLETE (2026-05-20)

All 5 tests passed via `docker compose exec app sh`:

| Test | Expected | Result |
|---|---|---|
| `GET /health` | `{"status":"ok"}` | ✓ |
| `POST /ocr` no secret | 401 | ✓ |
| `POST /ocr` wrong secret | 401 | ✓ |
| `POST /ocr` path="/etc/passwd" | 400 | ✓ |
| `POST /ocr` path outside STORAGE_PATH | 400 | ✓ |

**Field name correction for Phase 5b:** POST /ocr request body field is `"path"`, not `"image_path"`. `phases.md` spec had a typo. See integration-map §17.

**Phase 5b critical flag:** `OCR_SERVICE_URL` must be `http://ocr-service:8001` — NOT `http://localhost:8001` (ADR-025).

### Phase 4 Test Checklist Status

- [x] `npm run typecheck` clean
- [x] `npm run lint` clean
- [x] `npm run build` passes (2 Turbopack warnings about dynamic path.join — expected, not errors)
- [x] No session → 401 on `/api/receipts/[id]` (verified via curl)
- [x] Authenticated + guessed receipt ID → 404 (verified via curl)
- [ ] Upload 5 receipts of different sizes/formats — **needs manual browser test**
- [ ] Try uploading `.exe` (must reject) — **needs manual browser test**
- [ ] Try uploading 10 MB file (must reject) — **needs manual browser test**
- [ ] Direct filesystem path access without session → 401 — verified above
- [ ] User A can't access User B's receipt by guessing ID → 404 — verified above (no-match query)

### Last known-good git state

- Branch: master
- Last tag: `v1.0-production`
- Last commit: `96199ca` — [Phase 6] feat: add Travel and Home Care to default categories

---

## What Was Done — Phase 5a (2026-05-20)

- `ocr-service/Dockerfile` — python:3.11-slim, apt OpenCV deps, pip install, uvicorn CMD on `0.0.0.0:8001`
- `ocr-service/requirements.txt` — updated with paddlepaddle==2.6.2 (CPU), paddleocr==2.9.1, Pillow
- `ocr-service/main.py` — env validation at startup (STORAGE_PATH + OCR_SECRET), PaddleOCR singleton in FastAPI lifespan, `/health`, `/ocr` with secret auth + path traversal guard
- `docker-compose.yml` — ocr-service added (no ports, STORAGE_PATH :ro, paddleocr_cache volume); app.depends_on extended; OCR_SECRET + OCR_PROVIDER added to app env
- `Docs/architecture.md` — ADR-025 appended
- `Docs/handoff.md` — Phase 5a state, VPS verification steps, test checklist
- `CLAUDE.md` — Rule 8 updated for Docker context (ADR-025)

---

## What Was Done — Phase 4 (this session)

- `receipts` table + `expenses.receiptId` schema; migration 0002 generated and applied locally + on VPS
- `uploadReceiptAction` in `lib/actions/receipts.ts` — full validation pipeline (session, size, MIME, magic bytes, EXIF strip via sharp, UUID filename, DB insert)
- `getReceiptById` + `createReceipt` added to `lib/db/queries.ts`; `getExpenses` updated to include `receiptId`
- `GET /api/receipts/[id]` route — auth, ownership (404), path traversal guard, Blob stream, `Cache-Control: private, no-store`
- `STORAGE_PATH: z.string().min(1)` in `lib/env.ts`; `ENV STORAGE_PATH=/tmp/receipts` in Dockerfile builder
- Expense form updated: optional file input, two-step submit, upload state UI
- Expenses list: Receipt link on desktop table and mobile cards
- `sharp@^0.34.5` added
- ADR-023 (two-step upload), ADR-024 (sharp EXIF default); integration-map §14–16
- Tagged `v0.4-uploads-done`, pushed to GitHub
- Deployed to VPS — `STORAGE_PATH` added to `.env`, `/var/lib/myexpense/receipts` created, `make deploy` + `make migrate` run, HTTP/2 200 verified

### VPS deploy note
`make migrate` exits silently when nothing to apply — this is normal, not an error. Migration 0002 was confirmed applied via `drizzle.__drizzle_migrations` (3 rows) and `\dt` (receipts table present).

---

## What Was Done — Phase 3 (this session)

- **Query layer** — 4 new functions in `lib/db/queries.ts`; MYT timezone math in `getDashboardSummary`
- **Dashboard page** — full rewrite: real data, Zod URL param validation, 3 metric cards, filter bar, category breakdown table
- **Filter bar** — new `app/dashboard/filter-bar.tsx`; Client Component, controlled state, router.push navigation
- **Nav** — Sign Out button added to right side; `authClient.signOut()` → redirect
- **ADRs 019–022** written in `docs/architecture.md`
- **`docs/integration-map.md`** created — integration point reference card for future phases
- **CLAUDE.md** — integration-map.md added to Document Map
- `npm run typecheck` clean, `npm run lint` clean, `npm run build` passes
- Tagged `v0.3-dashboard-done`, pushed

### Phase 3 Test Checklist Status

Tests listed in `docs/phases.md` — **ALL PASSED** (verified 2026-05-19):
- [x] Numbers add up exactly to expense list totals
- [x] Date filters work across a month boundary
- [x] Two accounts: each sees only their own numbers

**Post-commit bug fixed:** Newer Radix Select forbids `value=""` on `<SelectItem>` — crashed the page on load. Fixed across all 3 affected forms (filter-bar, expense-form, edit-expense-form) and server action. Sentinels: `"all"` (category filter) and `"none"` (category on expense forms). This was a pre-existing regression from the shadcn/ui restyle, also hit by the new filter-bar.

---

## What Was Done — Phase 2 Session 3 (final)

- `app/expenses/[id]/edit/page.tsx` — edit page
- `app/expenses/[id]/edit/edit-expense-form.tsx` — pre-filled client form
- `lib/actions/expenses.ts` — `updateExpenseAction` + `deleteExpenseAction`
- `components/delete-expense-button.tsx` — Delete button + confirmation modal
- ESLint setup: `eslint.config.mjs`, `npm run lint` script
- ADRs 014–016 recorded
- Tagged `v0.2-expenses-done`, pushed

## What Was Done — UI pre-work (between Phase 2 and Phase 3)

- shadcn/ui installed and all pages restyled (commit 378f80e)
- ADR-017 and ADR-018 recorded

---

## Next Up

### 1. Complete local smoke test (in progress)

Smoke test continued 2026-05-24. Core pipeline verified end-to-end:

- [x] Dev server starts clean (signup, login work)
- [x] Receipt upload → `createOcrJobAction` → redirect to `/receipts/[id]/review`
- [x] Review page polls `checkReceiptStatusAction` correctly
- [x] Worker picks up jobs and logs them
- [x] OCR service (Docker) processes jobs — PaddleOCR extracts text correctly
- [x] Review page transitions from spinner → prefilled form
- [x] Expense saves with `receiptId` linked (confirmed via DB)
- [x] FailedView path — receipt.status forced to `failed`, review page polling detected within 3s, amber warning + blank manual form shown ✓ (2026-05-24). Note: `markOcrJobFailed` attempts >= 2 fix is correct in code; end-to-end retry→fail path to verify cleanly on VPS
- [x] Receipt variety test — 3 receipts tested locally (sufficient for local smoke test; full 10-receipt batch to be done on VPS):
  - Receipt 1 (NYONYA COLORS): total ✓, date ✓, merchant ✓
  - Receipt 2 (faded thermal): total ✗ (faded ink — expected null), date ✓, merchant ✓
  - Receipt 3: total ✓, date ✓, merchant ✓
- [x] Worker survives OCR service restart (retry logic) — OCR down → `attempts` increments, job rescheduled; OCR back up → job completes. 500 on cold-start also recovered via retry. ✓ (verified 2026-05-24)
- [x] Two users uploading simultaneously — jobs don't cross — two jobs injected simultaneously, each receipt updated with its own data, no cross-contamination ✓ (verified 2026-05-24)
- [x] Cross-user isolation — user A can't access user B's review page → 404 ✓ (verified 2026-05-24 via curl)

**Bug fixed (2026-05-24):** Worker sent Windows-style relative paths (`var\receipts\...`) to the Docker OCR service, which expects Linux absolute paths (`/c/Users/.../var/receipts/...`). Fixed in `lib/worker.ts` via `toOcrPath()` — converts Windows paths to Docker-compatible paths on `win32` only; no-op on Linux (production). See ADR-032.

**Blocker resolved:** Docker Desktop was already installed and running. OCR service started with `docker compose up ocr-service -d`. `.env` file at project root had the correct vars.

### 2. Deploy Phase 5e to VPS — COMPLETE (2026-05-24)

- Migration 0003 applied (`ocr_jobs` table — 4 migrations total in journal)
- `make deploy` successful — all 4 services up: app, db, ocr-service, worker
- Worker polling confirmed via `docker compose logs worker`
- Live URL returns 200: https://myexpense.srv1488589.hstgr.cloud

**VPS deploy bugs fixed during this session:**
- `OCR_SERVICE_URL` was missing from VPS `.env` — added manually before deploy
- Worker crash-looped: `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL` not passed to worker service in `docker-compose.yml` — fixed and pushed (`fe496be`)

---

## Open Questions / Blockers

- [x] Deploy Phase 3 to VPS — done 2026-05-19 ✓
- [x] Phase 4 complete locally and on VPS ✓ (2026-05-19)
- [x] Phase 5a complete locally ✓ (2026-05-20)
- [x] Phase 5a verified on VPS ✓ (2026-05-20) — all 5 tests passed
- [ ] Manual browser test checklist for Phase 4 (5 formats, .exe rejection, 10MB rejection)
- [x] Phase 5e browser smoke test — core pipeline verified 2026-05-24 ✓ (remaining: failure path, 10-receipt batch, multi-user)
- [x] Create `.env` file at project root for `docker compose` — done ✓
- [ ] Set up backup cron on VPS (`Docs/deployment.md` → Automated daily backup)
- [ ] ADR-013 revisit: 5 protected pages now (dashboard, expenses, receipts, settings + settings sub-paths) — revisit trigger met; consider route group layout
