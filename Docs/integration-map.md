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

## 8. Signup side effects

**Rule:** All post-signup logic (seeding default data, sending welcome emails, etc.) goes in `databaseHooks.user.create.after` inside `lib/auth/index.ts`. Never intercept the signup route or add a wrapper action. Wrap in try/catch so failures never block account creation (ADR-011).

**File:** `lib/auth/index.ts`

**Example:**
```ts
// lib/auth/index.ts
databaseHooks: {
  user: {
    create: {
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
