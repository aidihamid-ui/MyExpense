# MyExpense — Build Plan

The "what" and the "why" of this project. Phase-by-phase steps live in `docs/phases.md`.

---

## Features

### V1 (the version you ship)
- **Auth:** email + password signup, login, password reset, email verification
- **Manual expense entry:** amount, category, date, note, payment method (cash/card/e-wallet)
- **Receipt upload:** photo → upload → OCR → review → confirm
- **OCR pipeline:** PaddleOCR text extraction + lightweight parser
- **Categories:** default set + user-defined
- **Dashboard:** this month total, by category, last 30 days
- **Transactions list:** search, filter, sort, edit, delete
- **Settings:** profile, change password, delete account (MYR locked)

### V2 (after V1 has real users for a month)
Budgets per category · recurring expenses · receipt image gallery · tags · CSV export · charts (pie/bar/line) · PWA (installable, offline entry) · weekly/monthly email summary.

### V3 (only if traction)
Shared expenses with another user · multi-currency for travel · AI spending insights · bill reminders · income + net worth tracking.

### Deliberately NOT in V1
Bank integration (no clean Malaysian open banking) · native mobile app (PWA enough) · family/team sharing · investment tracking.

---

## Architecture

### Stack
| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, Server Actions) |
| Language | TypeScript strict mode |
| Database | PostgreSQL 16 (local Postgres in dev, same on VPS in prod) |
| ORM | Drizzle |
| Auth | Better-Auth (email/password, verification, reset built-in) |
| Storage | Local filesystem (`STORAGE_PATH` env var) |
| OCR | PaddleOCR via FastAPI sidecar on `localhost:8001` |
| Job queue | Postgres-backed (`ocr_jobs` table, polled every 5s) |
| Process manager | PM2 (prod only) |
| Web server | Nginx + Let's Encrypt SSL (prod only) |
| Email | Resend (free tier) |
| Error tracking | Sentry (optional, free tier) |

### Pluggable OCR
```
OcrProvider (interface)
  ├── PaddleOcrProvider     ← V1, free, local
  ├── ClaudeOcrProvider     ← upgrade option
  └── OpenAiOcrProvider     ← upgrade option
```
Switch via `OCR_PROVIDER=paddle|claude|openai`.

### Receipt OCR Data Flow
1. User uploads photo via Server Action
2. App validates file (MIME, magic bytes, size)
3. App saves to `{STORAGE_PATH}/{userId}/{uuid}.{ext}`
4. App inserts `receipts` row (status: pending) + `ocr_jobs` row
5. Worker polls every 5s, picks up pending job
6. Worker calls `http://localhost:8001/ocr` with image path
7. Python service runs PaddleOCR → text + bounding boxes
8. Worker runs parser (regex/heuristics for total, date, merchant)
9. Worker updates `receipts` row (status: completed)
10. User refreshes UI → reviews prefilled form → confirms → expense rows created

### Database Schema (simplified)
```
users        (id, email, password_hash, email_verified, created_at, ...)
sessions     (id, user_id, expires_at, ...)
categories   (id, user_id, name, icon, color, is_default)
expenses     (id, user_id, amount, currency, category_id, date, note,
              payment_method, receipt_id?, created_at)
receipts     (id, user_id, image_path, status, raw_ocr_text,
              extracted_data_json, error?, created_at)
ocr_jobs     (id, receipt_id, status, attempts, scheduled_for, last_error?)
```

---

## Local-First Workflow

Build entire app on laptop. Provision VPS only at Phase 1.5 (after auth works). Subsequent phases stay local-first with a deploy after each.

### Why this order
Fast feedback (hot reload, no deploy step) · free while building · safe to break things · first deploy happens while app is still tiny and easy to debug.

### Local environment
- Node 20+ via nvm/fnm (commit `.nvmrc`)
- PostgreSQL 16 installed locally
- Python 3.11+ with venv
- Git + GitHub repo
- VS Code (or editor of choice)

### Keeping local and prod in sync — the four rules

**1. Everything that differs goes in env vars.** Never hardcode paths, URLs, secrets, hosts. Files:
- `.env.example` — committed, placeholder values, documents what exists
- `.env.local` — gitignored, real dev values
- `.env` on VPS — gitignored, real prod values

**2. Same Node version everywhere.** Commit `.nvmrc`. VPS uses the same. Mismatch = mystery bugs.

**3. Same migration path local and prod.** Drizzle migrations in git. On VPS, run `npm run db:migrate` after every `git pull`. Never edit prod DB by hand.

**4. Git is the only deployment mechanism.** Never edit code on VPS, not even a typo. Flow: edit local → commit → push → SSH → `git pull` → migrate → reload.

### What differs (and how it's handled)

| Concern | Local | Production | Mechanism |
|---|---|---|---|
| App URL | `http://localhost:3000` | `https://myexpense.{domain}` | `APP_URL` env var |
| DB | local Postgres | local Postgres on VPS | `DATABASE_URL` |
| Receipt path | `./var/receipts` | `/var/lib/myexpense/receipts` | `STORAGE_PATH` |
| Email | log to console (dev) | Resend (prod) | `NODE_ENV` check |
| Process mgmt | `npm run dev` | PM2 | per-env commands |
| HTTPS | no (localhost) | yes (Certbot) | Nginx in prod |
| OCR service | Python venv | Python venv on VPS | `OCR_SERVICE_URL=localhost:8001` (same) |

### Linux compatibility (if dev on Mac/Windows)
- Forward slashes in paths (Node handles, but be aware)
- Lowercase filenames (Linux is case-sensitive)
- `git config --global core.autocrlf input` (Mac/Linux) or `true` (Windows)

---

## `.env.example` (commit this)

```env
# App
APP_URL=http://localhost:3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://myexpense:password@localhost:5432/myexpense_dev

# Auth
BETTER_AUTH_SECRET=generate-random-32-char-string
BETTER_AUTH_URL=http://localhost:3000

# Storage
STORAGE_PATH=./var/receipts

# OCR
OCR_PROVIDER=paddle
OCR_SERVICE_URL=http://localhost:8001
OCR_SERVICE_SECRET=generate-another-random-string

# Email
RESEND_API_KEY=
EMAIL_FROM=noreply@example.com

# Sentry (optional)
SENTRY_DSN=
```

---

## Security Overview

Critical rules live in `CLAUDE.md` — read those for the binding list. This is the "why" summary:

- **Multi-tenancy is the #1 risk.** One missed `WHERE user_id = ?` = data leak across users. All user-data queries route through `lib/db/queries.ts` to make this auditable.
- **Receipt files never publicly accessible.** Served via auth-checked Next.js route, not Nginx static.
- **Python OCR service binds to 127.0.0.1 only.** No external exposure. Path traversal prevented by validating image paths stay inside `STORAGE_PATH`.
- **VPS hardening (Phase 1.5):** SSH key-only, UFW firewall (22/80/443 only), non-root deploy user, fail2ban, unattended security upgrades.
- **Backups:** Daily `pg_dump` (30-day retention) + rsync receipts to a second location. Test restore quarterly.

---

## Cost

| Item | Monthly |
|---|---|
| Hostinger KVM 2 VPS (2GB RAM, 2 vCPU, 80GB SSD) | ~RM23 |
| Domain (.com) amortized | ~RM5 |
| Resend email | Free tier (100/day) |
| Sentry | Free tier |
| OCR | Free (PaddleOCR runs local) |
| Backup storage (optional) | RM0-5 |
| **Total** | **~RM28-35** |

**While building locally (Phase 0-1): RM0.**

---

## Phase Summary

Full details in `docs/phases.md`. Quick reference:

| Phase | Name | Tag |
|---|---|---|
| 0 | Local Setup | `v0.0-scaffold` |
| 1 | Auth | `v0.1-auth-working` |
| 1.5 | First VPS Deploy | `v0.1.5-first-deploy` |
| 2 | Manual Expense Entry | `v0.2-expenses-done` |
| 3 | Dashboard | `v0.3-dashboard-done` |
| 4 | Receipt Upload (no OCR) | `v0.4-uploads-done` |
| 5 | OCR Pipeline | `v0.5-ocr-working` |
| 6 | Polish & Production | `v1.0-production` |

---

## Honest Warnings

- **Auth bugs are silent and severe.** Two browsers, two accounts, every phase. Verify A can't see B.
- **PaddleOCR is ~60-70% accurate on Malaysian thermal receipts.** Always show raw OCR text alongside the prefilled form.
- **2GB RAM is tight.** PaddleOCR + Postgres + Node + worker. Monitor `htop`, `pm2 monit`. Add swap if needed.
- **Untested backups don't exist.** Test restore in first month.
- **First deploy (Phase 1.5) is the hardest.** Budget a full day, not "a couple hours."
- **Postgres and OCR service NEVER public.** UFW + 127.0.0.1 bindings.

---

## Upgrade Path (when V1 isn't enough)

Each is independent of the others:

- **Better OCR accuracy** → `OCR_PROVIDER=claude` in env, deploy. ~RM0.05/receipt.
- **More users** → VPS upgrade (KVM 4 or 8).
- **Better uptime** → managed Postgres (Neon), keep VPS for app.
- **Bigger files** → move receipts to Cloudflare R2.
- **Public app** → invite system, payments, ToS, privacy policy.
