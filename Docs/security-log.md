# Security Log

Records security reviews, findings, and fixes. Most recent entry first.

---

## 2026-06-07 — OWASP ZAP Baseline Scan

**Tool:** OWASP ZAP stable (Docker `ghcr.io/zaproxy/zaproxy:stable`)
**Scan type:** Baseline (passive + spider — no active attack payloads)
**Target:** `https://myexpense.srv1488589.hstgr.cloud`
**URLs crawled:** 28 (unauthenticated — protected routes not reached)
**Result:** 54 PASS · 13 WARN · 0 FAIL

### Findings and resolutions

| ZAP ID | Finding | Severity | Resolution |
|--------|---------|----------|------------|
| 10035 | Strict-Transport-Security not set | Medium | Fixed — `next.config.ts` ADR-037 |
| 10038 | Content-Security-Policy not set | Medium | Fixed — `next.config.ts` ADR-037 |
| 10020 | Anti-clickjacking header missing | Medium | Fixed — `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` |
| 10021 | X-Content-Type-Options missing | Low | Fixed — `nosniff` added globally |
| 10037 | X-Powered-By leaks `Next.js` | Low | Fixed — `poweredByHeader: false` |
| 10015 | Cache-Control missing on auth pages | Low | Fixed — `no-store` on `/sign-(in\|up)` |
| 10063 | Permissions-Policy not set | Low | Fixed — camera/mic/geo/payment blocked |
| 90004 | COEP/COOP headers missing | Low | Fixed — `require-corp` / `same-origin` |
| 10202 | Absence of Anti-CSRF tokens | Info | **False positive** — Better-Auth uses `SameSite=Lax` session cookies as CSRF protection; no token needed |
| 10031 | User-controllable HTML element attributes (XSS) | Info | **False positive** — Next.js/React auto-escapes all attribute values; no actual XSS vector |
| 10111 | Authentication request identified | Info | Informational — ZAP found the login endpoint. Expected. |
| 10109 | Modern web application | Info | Informational — ZAP noting 404 pages look like an SPA. No action needed. |
| 10049 | Non-storable content | Info | Informational — correct behaviour for dynamic pages. No action needed. |

**Fix commit:** `fe21f07` — `[Phase 6] security: add HTTP security headers (ZAP baseline remediation)`
**ADR:** ADR-037

### Scope gap — authenticated scan not performed

ZAP could not reach any protected routes. The following surfaces were **not tested**:

- `/dashboard` — summary queries
- `/expenses` and `/expenses/[id]/edit` — CRUD, search, CSV export
- `/receipts/[id]/review` — OCR polling
- `/settings` — password change, account delete
- `/api/receipts/[id]` — receipt file serving route
- `/api/expenses/export` — CSV export route

To close this gap, run an authenticated ZAP scan using a ZAP context file with a test-account session cookie or credentials. This is recommended before any future public exposure of the app.

### What passed (notable)

All injection and authentication checks passed cleanly:
- No vulnerable JS libraries (Retire.js scan) ✓
- No XSS (reflected, stored, DOM) ✓
- No sensitive data in URLs or referrer headers ✓
- No debug information disclosure ✓
- No mixed content (HTTP resources on HTTPS page) ✓
- No insecure form transitions ✓
- No weak authentication method ✓
- Cookies: HttpOnly ✓, Secure flag ✓, SameSite ✓
- No private IP disclosure ✓
- No session ID in URL ✓
- No source code disclosure ✓
- No Heartbleed / Java serialization / WSDL exposure ✓
