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

### ADR-005: _[fill in next decision here]_
