# Integration Map

**Read at the start of every new phase.** This is the short reference card for how every integration point works. Use it to avoid hallucinating APIs or breaking conventions.

Based on all ADRs in `docs/architecture.md` and the 10 critical rules in `CLAUDE.md`.

---

## 1. Session check

**Rule:** Call `auth.api.getSession({ headers: await headers() })` at the top of every protected Server Component. Redirect to `/login` if null.

**File:** `lib/auth/index.ts` (exports `auth`)

**Example:**
```ts
// app/dashboard/page.tsx
const session = await auth.api.getSession({ headers: await headers() });
if (!session) redirect('/login');
const userId = session.user.id;
```

---

## 2. Route protection

**Rule:** `proxy.ts` checks for the `better-auth.session_token` cookie. It is a UX redirect only, NOT a security boundary. Every protected Server Component must still call `auth.api.getSession()` (see #1).

**File:** `proxy.ts` (Next.js 16 replacement for `middleware.ts`)

**Example:**
```ts
// proxy.ts matcher covers /dashboard and /expenses/:path*
// The proxy redirects on missing cookie; the server component is the real gate
```

---

## 3. All DB queries

**Rule:** Every exported query function in `lib/db/queries.ts` takes `userId: string` as its first parameter and filters strictly by it. Never query without a userId filter. Never write ad-hoc DB queries outside this file.

**File:** `lib/db/queries.ts`

**Example:**
```ts
// Correct
const expenses = await getExpenses(userId, { page: 1 });

// Wrong — no userId parameter
// db.select().from(expenses)  ← never do this in page/action code
```

---

## 4. Server actions

**Rule:** All server actions live in `lib/actions/<feature>.ts` with `'use server'` at the top. Never define server actions inline in page or component files (they cannot be imported by Client Components).

**File:** `lib/actions/expenses.ts` (example)

**Example:**
```ts
// lib/actions/expenses.ts
'use server';
export async function createExpenseAction(prevState: ..., formData: FormData) { ... }
```

---

## 5. Zod schemas

**Rule:** Shared Zod schemas (used by both server actions and client components) live in `lib/validators/<feature>.ts`. URL search param validation schemas live in the Server Component that consumes them (ADR-019).

**File:** `lib/validators/expense.ts` (example)

**Example:**
```ts
// lib/validators/expense.ts
export const createExpenseSchema = z.object({ amount: z.string()... });
```

---

## 6. Env vars

**Rule:** Never access `process.env.X` directly in application code. Import from `lib/env.ts` which validates all env vars at boot with Zod.

**File:** `lib/env.ts`

**Example:**
```ts
// Correct
import { env } from '@/lib/env';
const path = env.STORAGE_PATH;

// Wrong
// const path = process.env.STORAGE_PATH  ← never
```

---

## 7. Column naming

**Rule:** All Drizzle schema columns use camelCase string names (`'userId'`, `'createdAt'`, `'emailVerified'`). This is project-wide (ADR-005). Never use snake_case column names.

**File:** `lib/db/schema.ts`

**Example:**
```ts
// Correct
userId: text('userId').notNull()

// Wrong
// user_id: text('user_id')  ← never
```

---

## 8. Signup side effects and user cap

**User cap:** `databaseHooks.user.create.before` in `lib/auth/index.ts` calls `getUserCount()` and throws if `>= MAX_USERS (10)`. This is server-side — cannot be bypassed from the client. To change the limit, update `MAX_USERS` in `lib/auth/index.ts` (ADR-036).

**Post-signup side effects:** All logic goes in `databaseHooks.user.create.after`. Never intercept the signup route or add a wrapper action. Wrap in try/catch so failures never block account creation (ADR-011).

**File:** `lib/auth/index.ts`

**Example:**
```ts
// lib/auth/index.ts
databaseHooks: {
  user: {
    create: {
      before: async () => {
        const n = await getUserCount();
        if (n >= MAX_USERS) throw new Error('Registration is closed...');
      },
      after: async (user) => {
        try { await seedDefaultCategories(user.id); }
        catch (e) { console.error('Seed failed:', e); }
      },
    },
  },
},
```

---

## 9. Nav component

**Rule:** Import `<Nav />` at the top of every protected page. It is a Client Component (needs `usePathname` for active-link styling). Nav also contains the Sign Out button (added Phase 3).

**File:** `components/nav.tsx`

**Example:**
```tsx
// app/dashboard/page.tsx
import Nav from '@/components/nav';
// ...
return <div><Nav /><main>...</main></div>;
```

---

## 10. Migrations

**Rule:** Migrations NEVER run automatically on app startup. Always run `make migrate` manually after a schema change, both locally and on VPS. Never add `migrate()` calls to the app entrypoint (ADR-009).

**File:** `docker-compose.yml` (`migrate` service), `Makefile` (`make migrate`)

**Example:**
```bash
# After a schema change:
npx drizzle-kit generate   # generate migration file
make migrate               # apply on VPS (or run locally: npx drizzle-kit migrate)
```

---

## 11. URL search param validation (Phase 3+)

**Rule:** URL search params in Server Components are validated with `z.object({...}).safeParse()`. Invalid or missing params fall back to computed defaults silently — never throw on bad URL input (ADR-019).

**File:** `app/dashboard/page.tsx` (canonical example)

**Example:**
```ts
const paramSchema = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });
const parsed = paramSchema.safeParse(rawParams);
const validParams = parsed.success ? parsed.data : {};
const fromStr = validParams.from ?? defaultFrom;
```

---

## 12. Malaysia timezone for calendar queries (Phase 3+)

**Rule:** All calendar-boundary queries (current month, last month, rolling N days) compute MYT (UTC+8) boundaries in TypeScript and pass a `now: Date` (UTC) into the query function. Never call `new Date()` inside a query function; never use SQL `CURRENT_DATE` for MYT calculations (ADR-020).

**File:** `lib/db/queries.ts` → `getDashboardSummary(userId, now)`

**Example:**
```ts
// In the Server Component:
const now = new Date(); // UTC, captured once
const summary = await getDashboardSummary(userId, now);

// Inside getDashboardSummary:
const nowMYT = new Date(now.getTime() + 8 * 60 * 60 * 1000);
const year = nowMYT.getUTCFullYear();
```

---

## 14. Receipt upload action (Phase 4+)

**Rule:** Call `uploadReceiptAction(formData)` where `formData` has a `receipt` key set to a `File`. Call this BEFORE `createExpenseAction` to obtain a `receiptId`, then pass it as `formData.set('receiptId', receiptId)` to the create action. Never call upload inside `createExpenseAction` — they are separate concerns (ADR-023).

**File:** `lib/actions/receipts.ts`

**Return type:**
```ts
type UploadReceiptResult =
  | { ok: true; data: { receiptId: string } }
  | { ok: false; error: { code: string; message: string } };
```

**Validation order (reject at first failure):**
1. Session (→ `UNAUTHORIZED`)
2. File presence (→ `NO_FILE`)
3. Size ≤5 MB (→ `FILE_TOO_LARGE`)
4. MIME whitelist: `image/jpeg | image/png | image/webp | application/pdf` (→ `INVALID_MIME`)
5. Magic bytes (→ `MAGIC_MISMATCH`)
6. EXIF strip via sharp default (images only; PDFs pass through)
7. UUID filename + `{STORAGE_PATH}/{userId}/{uuid}.ext`
8. Insert `receipts` row (status: `pending`) → return `receiptId`

---

## 15. Receipt serving route (Phase 4+)

**Rule:** `GET /api/receipts/[id]` checks session (401 if missing), fetches via `getReceiptById(userId, id)` (404 if not found or wrong owner), applies path traversal guard, and streams the file. Response: `Cache-Control: private, no-store`. Never use 403 — always 404 for wrong-owner to avoid leaking existence (ADR-014).

**File:** `app/api/receipts/[id]/route.ts`

**Path traversal guard:**
```ts
const resolvedPath = path.resolve(receipt.imagePath);
const resolvedStorage = path.resolve(env.STORAGE_PATH);
if (!resolvedPath.startsWith(resolvedStorage + path.sep)) return 404;
```

---

## 16. STORAGE_PATH env var (Phase 4+)

**Rule:** `STORAGE_PATH` is validated at boot via `lib/env.ts` as `z.string().min(1)` — no default. Must be set in `.env.local` locally. VPS `.env` uses `/var/lib/myexpense/receipts`. Dockerfile builder stage uses `/tmp/receipts` as a placeholder so the build doesn't fail.

**File:** `lib/env.ts`, `.env.local`, `.env.example`, `Dockerfile`

**Example:**
```ts
import { env } from '@/lib/env';
const userDir = path.join(env.STORAGE_PATH, userId);
```

---

## 17. OCR service HTTP API (Phase 5a+)

**Rule:** The OCR service is a Python FastAPI sidecar. It is NOT called directly by Next.js yet (that's Phase 5b). This section documents the API contract so Phase 5b integration has a single reference.

**Base URL (Docker):** `http://ocr-service:8001` — internal Docker network only; never `http://localhost:8001` inside the app container (ADR-025).
**Base URL (bare metal dev):** `http://127.0.0.1:8001`

**File:** `ocr-service/main.py`

### GET /health

No auth. Returns `{"status":"ok"}` when the service is up and PaddleOCR is loaded.

### POST /ocr

Auth: `X-OCR-Secret: <OCR_SECRET>` header required. Returns 401 if missing or wrong.

Request body:
```json
{ "path": "/var/lib/myexpense/receipts/<userId>/<uuid>.jpg" }
```

> **Field name is `path`, not `image_path`.** The original `phases.md` spec said `image_path` — the Pydantic model in `main.py` uses `path`. Phase 5b must use `path`.

Path must be inside `STORAGE_PATH` (checked via `os.path.realpath` — symlink-safe). Returns 400 if path is outside. Returns 404 if file does not exist.

Response (200):
```json
{
  "text": "line1\nline2\n...",
  "lines": ["line1", "line2", "..."]
}
```

`text` is all OCR lines joined with `\n`. `lines` is the same data as an array (both provided for consumer convenience).

**Error responses:**
| Code | Cause |
|---|---|
| 401 | Missing or wrong `X-OCR-Secret` |
| 400 | Path outside `STORAGE_PATH` |
| 404 | File does not exist at path |
| 500 | OCR engine failure |

---

## 18. OcrProvider usage pattern (Phase 5b+)

**Rule:** Never call the OCR HTTP service directly. Use the `OcrProvider` interface. The active provider is determined by `env.OCR_PROVIDER`. Import `PaddleOcrProvider` and instantiate it where needed (Phase 5c worker). Do not call `PaddleOcrProvider` from server actions or route handlers — OCR runs asynchronously via the worker.

**Files:** `lib/ocr/provider.ts` (interface), `lib/ocr/paddle.ts` (implementation)

**Interface:**
```ts
interface OcrResult { text: string; lines: string[] }
interface OcrProvider { extractFromImage(imagePath: string): Promise<OcrResult> }
```

**Usage (Phase 5c worker):**
```ts
import { PaddleOcrProvider } from '@/lib/ocr/paddle';

const ocr = new PaddleOcrProvider();
const result = await ocr.extractFromImage('/var/lib/myexpense/receipts/<userId>/<uuid>.jpg');
// result.text — full OCR text joined with \n
// result.lines — array of OCR lines
```

**Error contract:**
- `OCR_SERVICE_URL` not set → throws `'OCR_SERVICE_URL is not set'`
- Network unreachable → throws `'OCR service unreachable: <cause>'`
- Non-200 response → throws `'OCR service returned <status>'`
- Retry logic is NOT in the provider — it belongs in the Phase 5c worker.

---

## 19. Worker job lifecycle (Phase 5c+)

**Rule:** OCR jobs are created via `createOcrJobAction` after a receipt upload completes (see §21). The worker polls every 5s, claims one job at a time, runs OCR + parser, and updates both `ocr_jobs` and `receipts`. Never call worker queries from server actions or route handlers.

**Job status flow:**
```
pending → [claim] → processing → [success] → done
                               → [fail, attempts<3] → pending (scheduledFor+30s, attempts+1)
                               → [fail, attempts≥3] → failed
```

**Files:** `lib/worker.ts`, `lib/db/queries.ts` (worker section)

**Claim query:** `claimNextOcrJob()` uses `FOR UPDATE SKIP LOCKED` — safe for concurrent workers (only one will ever claim a given job).

**Run worker locally:**
```bash
node --env-file=.env.local node_modules/tsx/dist/cli.cjs lib/worker.ts
```

> **Note:** Use `node_modules/tsx/dist/cli.cjs` directly, not `node_modules/.bin/tsx`. The `.bin/tsx` entry is a bash shim — Node on Windows executes it as JavaScript and throws a syntax error (same issue as drizzle-kit, see §10).

> **Windows + Docker path translation (ADR-032):** In local dev the worker runs bare-metal on Windows but the OCR service runs in Docker (Linux). `toOcrPath()` in `lib/worker.ts` converts the stored Windows relative path (`var\receipts\...`) to the Linux absolute path the Docker container expects (`/c/Users/.../var/receipts/...`). No-op in production (worker runs in Docker on Linux).

**Migration:** `lib/db/migrations/0003_misty_emma_frost.sql` — must be applied before starting the worker.

---

## 20. Receipt parser (Phase 5d+)

**Rule:** Call `parseReceiptText(rawOcrText)` after OCR succeeds in the worker. Store the result as JSON in `receipts.extractedDataJson`. Never call the parser from server actions or route handlers — parsing is part of the async OCR pipeline.

**File:** `lib/ocr/parser.ts`

**Type:**
```ts
type ParsedReceipt = { total: number | null; date: string | null; merchant: string | null }
```

**Usage (Phase 5e worker integration):**
```ts
import { parseReceiptText } from '@/lib/ocr/parser';

const parsed = parseReceiptText(ocrResult.text);
// store: receipts.extractedDataJson = JSON.stringify(parsed)
```

**Parser behaviour (conservative — null over wrong guess):**
- `total` — largest RM amount near a keyword (TOTAL/JUMLAH/AMAUN/AMOUNT/GRAND TOTAL); RM-only fallback; strips commas
- `date` — DD/MM/YYYY → YYYY-MM-DD; YYYY-MM-DD passthrough; null if none
- `merchant` — first non-digit, non-skip-prefix line (≤80 chars, max 3 tries); null if none

**Tests:** `lib/ocr/parser.test.ts` — `npm run test`

---

## 21. createOcrJobAction (Phase 5e+)

**Rule:** After `uploadReceiptAction` returns a `receiptId`, call `createOcrJobAction(receiptId)` to enqueue the receipt for async OCR processing. This must be called before `createExpenseAction` so the expense references a receipt that is already queued for OCR. The action verifies session + receipt ownership before creating the job.

**File:** `lib/actions/receipts.ts`

**Return type:**
```ts
type CreateOcrJobResult =
  | { ok: true; data: { jobId: string } }
  | { ok: false; error: { code: string; message: string } };
```

**Error codes:**
| Code | Condition |
|---|---|
| `INVALID_INPUT` | receiptId is not a valid UUID |
| `UNAUTHORIZED` | No session |
| `NOT_FOUND` | Receipt not found or wrong owner (same response — existence leak prevention per ADR-014) |

**Usage (two-step upload flow in Phase 5e Session B):**
```ts
// Step 1: Upload
const uploadResult = await uploadReceiptAction(formData);
if (!uploadResult.ok) return uploadResult.error;

// Step 2: Enqueue OCR
const ocrResult = await createOcrJobAction(uploadResult.data.receiptId);
if (!ocrResult.ok) return ocrResult.error;

// Step 3: Create expense
formData.set('receiptId', uploadResult.data.receiptId);
// ... call createExpenseAction(formData)
```

**Underlying query:** `createOcrJob(receiptId)` in `lib/db/queries.ts` — inserts `ocr_jobs` row (status: `pending`, attempts: 0, scheduledFor: now). System query — no userId filter.

---

## 22. getReceiptStatus (Phase 5e+)

**Rule:** Poll `getReceiptStatus(userId, receiptId)` to check whether OCR processing has completed and to retrieve extracted data for the review UI. Returns `null` if the receipt doesn't exist or belongs to another user.

**File:** `lib/db/queries.ts`

**Return type:**
```ts
{ status: string; extractedDataJson: string | null; rawOcrText: string | null } | null
```

**Status values:** `pending` → `completed` (OCR done, data in `extractedDataJson`) or `failed` (error in the receipts row; raw OcrText may or may not be present)

**Usage (Phase 5e Session B review UI):**
```ts
const status = await getReceiptStatus(userId, receiptId);
if (!status) return notFound(); // wrong owner or doesn't exist

if (status.status === 'completed') {
  const parsed = JSON.parse(status.extractedDataJson ?? '{}');
  // pre-fill form with parsed.total, parsed.date, parsed.merchant
  // show rawOcrText alongside for user verification
}
```

---

## 23. Worker service in Docker (Phase 5e+)

**Rule:** The OCR worker runs as a separate Docker Compose service alongside `app`, `db`, and `ocr-service`. It uses a dedicated Dockerfile stage (`target: worker`) that copies full node_modules and source, running via `tsx`. Never publish the worker's port — it is internal only.

**File:** `docker-compose.yml` (worker service), `Dockerfile` (worker stage)

**Worker stage (Dockerfile):**
```dockerfile
FROM node:24-alpine AS worker
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["node_modules/.bin/tsx", "lib/worker.ts"]
```

**Service config (docker-compose.yml):**
```yaml
worker:
  target: worker           # uses the worker Dockerfile stage
  restart: unless-stopped
  environment:             # same env vars as app
    DATABASE_URL, STORAGE_PATH, OCR_SECRET, OCR_SERVICE_URL, OCR_PROVIDER, NODE_ENV
  volumes:
    - ${STORAGE_PATH}:${STORAGE_PATH}:ro   # read-only receipt files
  depends_on:
    db: condition: service_healthy
    ocr-service: condition: service_started
```

**Local (no Docker):** `npm run worker` (calls `tsx lib/worker.ts`). Requires the same env vars in `.env.local`.

---

## 13. Select component pattern — two modes

**Rule:** Radix Select has two valid patterns in this codebase (ADR-018, ADR-021):
- **FormData / server action** → use `name` prop: `<Select name="field">` — Radix renders a hidden input
- **URL-param navigation** → use controlled: `<Select value={state} onValueChange={setState}>` — no `name` prop

**File:** `components/ui/select.tsx`, forms in `app/expenses/`, filter in `app/dashboard/filter-bar.tsx`

**Example:**
```tsx
// FormData form (ADR-018):
<Select name="paymentMethod" defaultValue="cash">...</Select>

// URL-param filter (ADR-021):
<Select value={categoryId} onValueChange={setCategoryId}>...</Select>
```

## 24. checkReceiptStatusAction (Phase 5e+)

**Rule:** Call `checkReceiptStatusAction(receiptId)` from a Client Component to poll receipt OCR status. Call it on a 3-second interval; stop when status is `completed` or `failed`. Never call from server components — this is a polling endpoint designed for `useEffect` + `setInterval`.

**File:** `lib/actions/receipts.ts`

**Return type:**
```ts
type CheckReceiptStatusResult =
  | { ok: true; data: { status: string; extractedDataJson: string | null; rawOcrText: string | null } }
  | { ok: false; error: { code: string; message: string } };
```

**Error codes:**
| Code | Condition |
|---|---|
| `INVALID_INPUT` | receiptId is not a valid UUID |
| `UNAUTHORIZED` | No session |
| `NOT_FOUND` | Receipt not found or wrong owner (same response — existence leak prevention per ADR-014) |

**Status values returned in `data.status`:**
| Status | Meaning |
|---|---|
| `pending` | OCR job not yet picked up by worker |
| `processing` | Worker is running OCR right now |
| `completed` | OCR done; `extractedDataJson` contains parsed receipt data, `rawOcrText` contains full OCR output |
| `failed` | OCR failed permanently (or any unexpected status) |

**Usage (review-client.tsx):**
```ts
const poll = useCallback(async () => {
  const result = await checkReceiptStatusAction(receiptId);
  if (!result.ok) { /* handle error */ return; }
  const { status, extractedDataJson, rawOcrText } = result.data;
  if (status === 'completed') { /* stop polling, show form */ }
}, [receiptId]);
```

---

## 25. Review page flow (Phase 5e+)

**Rule:** After uploading a receipt with OCR, the user lands on `/receipts/[id]/review`. This page polls `checkReceiptStatusAction` every 3 seconds until the OCR worker finishes, then shows a prefilled expense form. If OCR was never queued (`?warning=ocr_failed`), skip polling and show the blank form immediately.

**Files:** `app/receipts/[id]/review/page.tsx` (Server Component), `app/receipts/[id]/review/review-client.tsx` (Client Component)

**Page lifecycle:**
```
Server Component (page.tsx):
  1. auth.api.getSession() → redirect /login if null
  2. getReceiptById(userId, id) → notFound() if null (ADR-014)
  3. getCategories(userId) → pass to client
  4. Check searchParams.warning === 'ocr_failed' → pass ocrFailed prop

Client Component (review-client.tsx):
  1. If ocrFailed: render FailedView immediately (no polling)
  2. Else: start 3s polling via checkReceiptStatusAction
  3. loading → pending → processing → completed (prefilled form)
                                    → failed (blank form + warning)
  4. On confirm: submit createExpenseAction with receiptId + form data
```

**Sub-views:**
- **LoadingView** — spinner, "Checking receipt status…"
- **PendingView** — spinner + "Analysing your receipt…" + elapsed time
- **CompletedView** — green banner + prefilled form (merchant→note, date, total→amount) + collapsible raw OCR `<details>`
- **FailedView** — amber warning + blank expense form

**Polling stops** when `status` becomes `completed` or `failed`. The `?warning=ocr_failed` flag on mount means `createOcrJobAction` failed during upload — no `ocr_jobs` row exists, so polling would loop forever on `pending`. In this case polling is skipped and FailedView renders immediately.

**Proxy coverage:** `/receipts/:path*` added to `proxy.ts` matcher (UX redirect only — real auth is in the Server Component per ADR-006).

**Expense form (shared):** Uses `useActionState` + `createExpenseAction`. `receiptId` is passed as a hidden `<input>`. The action now verifies receipt ownership before creating the expense (ADR-031).


---

## 26. Expense search (Phase 6+)

**Rule:** Search state lives in `?q=` URL param. The Server Component reads and Zod-validates it, passes it to `getExpenses` as `search`. The query adds `ilike(expenses.note, '%term%')` inside the existing `and(eq(expenses.userId, userId), ...)` — multi-tenancy is never weakened. See ADR-033.

**Files:** `app/expenses/page.tsx` (Server Component), `app/expenses/search-bar.tsx` (Client Component), `lib/db/queries.ts` → `getExpenses`

**Data flow:**
```
User types in SearchBar
  → debounce 300ms
  → router.push('/expenses?q=<term>')   // resets page to 1
  → Server Component re-renders
  → Zod validates q (trim, max 200, catch '')
  → getExpenses(userId, { search: q })
  → ilike filter applied inside and(userId, ...)
  → results returned
```

**Pagination:** `buildHref(page, q)` in `page.tsx` always includes `?q=` in prev/next links so search is preserved across pages.

**Empty state:** Shows "No expenses match your search." when `q` is set and results are empty (vs "No expenses yet." when unfiltered and empty).

---

## 27. Settings actions (Phase 6+)

**Files:** `lib/actions/settings.ts`, `app/settings/page.tsx`, `app/settings/change-password-form.tsx`, `app/settings/delete-account.tsx`

### changePasswordAction

**Rule:** Form-based server action (`useActionState`). Zod validates three fields (currentPassword min 1, newPassword min 8, confirmNewPassword must equal newPassword). Then delegates to `auth.api.changePassword({ headers, body: { currentPassword, newPassword, revokeOtherSessions: false } })` — Better-Auth verifies the current password hash internally.

**Error mapping:**
| Better-Auth `err.message` | Returned field error |
|---|---|
| `"Invalid password"` | `errors.currentPassword` |
| `"Password too short"` | `errors.newPassword` |
| anything else | `general` message |

### deleteAccountAction

**Rule:** Called directly from a client event handler (not via form action). Requires typed confirmation `DELETE` in the UI before calling. The action: (1) session check, (2) `deleteUserData(userId)` → transaction deletes in FK-safe order + returns `imagePaths[]`, (3) `fs.unlink` each path best-effort. On `{ ok: true }`, client calls `authClient.signOut()` then redirects to `/login`. See ADR-034 for cascade order rationale.

**deleteUserData transaction order:**
```
DELETE expenses WHERE userId        -- eliminates SET NULL side-effects on categoryId/receiptId
DELETE receipts WHERE userId        -- cascades → ocrJobs
DELETE categories WHERE userId      -- safe: no remaining expenses to SET NULL
DELETE user WHERE id                -- cascades → sessions, accounts
```

---

## 28. CSV export route (Phase 6+)

**Rule:** `GET /api/expenses/export` is a route handler (not a server action). It checks session via `auth.api.getSession` (same as every protected Server Component — §1), calls `getAllExpensesForExport(userId)` from `lib/db/queries.ts`, builds RFC-4180 CSV with plain string joining, and returns a `Response` with `Content-Disposition: attachment`. Never accept `userId` from query params — always from the verified session.

**File:** `app/api/expenses/export/route.ts`

**Response headers:**
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="myexpense-YYYY-MM-DD.csv"
```

**CSV format:**
- Header row: `"Date","Amount","Category","Note","Payment Method"`
- Each value double-quoted; internal `"` escaped as `""`
- Lines separated by CRLF (`\r\n`) — RFC-4180 compliant
- Amount formatted as `toFixed(2)`; empty category → empty string

**UI trigger:** Plain `<a href="/api/expenses/export">` anchor on `/expenses` page — browser follows and downloads. No JavaScript required.
