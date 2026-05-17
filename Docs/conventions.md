# Coding Conventions

How code should look in MyExpense. Loaded when in doubt about style.

---

## TypeScript

- **Strict mode is on.** No exceptions.
- **No `any`** without a `// reason: ...` comment explaining why.
- **No `as` casting** unless you can justify it. Prefer type guards.
- **Prefer `unknown` over `any`** when the type is genuinely unknown.

---

## Errors

Server actions and route handlers return a typed result:

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
```

Never return a bare string error. Never throw for expected failures (validation, not-found, unauthorized). Throw only for genuinely unexpected conditions.

**No try/catch swallowing.** If you catch, you either log + re-throw, or handle deliberately with a returned error result.

---

## Database access

- **All user-data queries live in `lib/db/queries.ts`.** This is the audit boundary for multi-tenancy.
- Query helpers are named `getUser*`, `updateUser*`, `deleteUser*` and accept `userId` as the first parameter.
- Inside the helper, `userId` MUST appear in the `WHERE` clause.

```ts
// ✅ correct
export async function getUserExpenses(userId: string) {
  return db.select().from(expenses).where(eq(expenses.userId, userId));
}

// ❌ wrong - no userId filter
export async function getExpenses() {
  return db.select().from(expenses);
}
```

- **No raw SQL with string interpolation.** Drizzle's query builder only.
- If you genuinely need raw SQL, use Drizzle's `sql` template tag with parameter substitution.

---

## Validation

- **Zod schemas live in `lib/validators/`.**
- Import the same schema in the server action AND the client form (so client + server validation share rules).
- Validate at the boundary: first thing the server action does is `schema.parse(input)`.

---

## Server vs Client Components

- **Server components by default.** Add `"use client"` only when needed:
  - Form with state
  - Interactivity (onClick, useEffect)
  - Browser-only APIs
- Server Actions handle mutations, not API routes. API routes only for file streaming (`/api/receipts/[id]`) and webhooks.

---

## Styling

- **Tailwind only.** No `.css` or `.scss` files.
- No inline `style` attributes unless dynamically computed (e.g., chart positioning).
- Compose with `clsx` or `cn()` helper for conditional classes.

---

## File and Directory Naming

- **kebab-case** for filenames: `expense-form.tsx`, not `ExpenseForm.tsx` or `expenseForm.tsx`.
- Component names inside files are PascalCase: `export function ExpenseForm() { ... }`.
- Directories: kebab-case.

---

## Environment Variables

- **Never `process.env.X` scattered across the codebase.**
- All env vars read through `lib/env.ts`, which uses Zod to validate at boot.
- If `lib/env.ts` parsing fails, the app crashes — that's the point. Bad config should never silently produce a bad runtime.

```ts
// lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  STORAGE_PATH: z.string(),
  OCR_PROVIDER: z.enum(['paddle', 'claude', 'openai']).default('paddle'),
  // ...
});

export const env = envSchema.parse(process.env);
```

---

## Logging

- No `console.log` in committed code. Use the project logger (pino, set up Phase 6).
- Log at the right level: `error` for failures, `warn` for unexpected-but-handled, `info` for milestones, `debug` for tracing.
- Never log secrets, passwords, tokens, or full request bodies.

---

## React Specifics

- **No `dangerouslySetInnerHTML`.** Ever. If you think you need it, you don't.
- Server Actions over API endpoints for mutations.
- Form fields use `useFormState`/`useActionState` to surface errors inline.
- Loading states: use `useTransition` or framework streaming.

---

## Imports

- Absolute imports via `@/*` alias (configured in `tsconfig.json`).
- Group: external packages first, then `@/lib/...`, then `@/components/...`, then relative `./...`.
- No barrel files (`index.ts` that re-exports) — they slow IDE indexing and break tree-shaking.
