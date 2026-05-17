# Subagent Rules (DeepSeek)

DeepSeek runs as a subagent. Cheaper, faster, but makes NO decisions. Claude orchestrates and reviews everything before commit.

---

## When to Delegate

Delegate well-defined, mechanical tasks where the pattern is established:

- **Boilerplate**: CRUD form scaffolds, basic list components, table renderers
- **Unit tests for already-written functions** (test cases are obvious from the function signature and behavior)
- **Mechanical refactors**: renaming a variable across files, moving files, splitting one file into two
- **Drizzle migration files** based on a schema diff that Claude has already designed
- **Mock/seed data** for development
- **Repetitive code where the pattern is established** (e.g., 10 form fields following the same structure)
- **Documentation strings** for existing functions whose behavior Claude has already verified

---

## NEVER Delegate

These stay with Claude no matter how busy or repetitive:

- **Architecture decisions** of any kind
- **Authentication, sessions, password handling** — any code in `lib/auth/`
- **Multi-tenancy logic** — any query touching user data, anything in `lib/db/queries.ts`
- **`lib/env.ts`** — env validation is security-critical
- **File upload validation** — MIME check, magic bytes, size limit, EXIF strip
- **Receipt serving routes** — the auth check that prevents cross-user access
- **Path handling** — anything where user input touches the filesystem
- **OCR pipeline orchestration** — worker, retries, error handling, parser
- **Database schema design** — only schema *implementation* after Claude has chosen the shape
- **Security reviews**
- **Debugging anything where root cause isn't obvious** — DeepSeek will pattern-match and miss
- **Anything touching Better-Auth**

When in doubt: don't delegate.

---

## How to Delegate (Claude's Checklist)

When handing a task to DeepSeek, Claude must:

1. **Provide full context.** Paste the relevant interface, schema, type definition, or existing pattern to follow. DeepSeek will not infer.
2. **Specify exact file paths** to create or modify.
3. **Specify acceptance criteria** — what "done" looks like.
4. **Specify what NOT to touch** — explicit boundary on its blast radius.
5. **Set a single output target** — one file or one function at a time when possible.
6. **Review every line before commit.** No DeepSeek code is committed without Claude reading it.

### Template Prompt for DeepSeek

```
TASK: [one sentence]

CONTEXT: [paste the interface/schema/pattern to follow]

CREATE: [exact file path]

REQUIREMENTS:
- [bullet]
- [bullet]

ACCEPTANCE: [what makes this done]

DO NOT TOUCH: [list of files or areas off-limits]

OUTPUT: just the file contents, no commentary.
```

---

## When DeepSeek's Output Is Wrong

Don't iterate with DeepSeek. The cost of back-and-forth exceeds the savings.

Instead:
1. Take the task back. Do it directly.
2. Note in the session handoff: "DeepSeek attempted X, failed because Y. I took it over."
3. Over time, this builds a list of categories DeepSeek can't handle for this project.

---

## Red Flags

If DeepSeek's output has any of these, reject it and rewrite:

- A query without a `userId` filter (where one is expected)
- A `try/catch` that swallows errors
- Hardcoded paths or URLs (should be env vars)
- `process.env.X` outside `lib/env.ts`
- `any` type without a `// reason:` comment
- Raw SQL with string interpolation
- Form submission without Zod validation
- A new dependency added without approval
- Any code in the "NEVER delegate" categories above (means the task should have stayed with Claude)
