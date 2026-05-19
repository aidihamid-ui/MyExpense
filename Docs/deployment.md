# Deployment Runbook

**App:** MyExpense
**VPS:** Ubuntu 24.04 · 187.77.155.88
**Live URL:** https://myexpense.srv1488589.hstgr.cloud
**Repo:** https://github.com/aidihamid-ui/MyExpense.git
**App dir on VPS:** `/docker/myexpense/repo/`

---

## Architecture

```
Internet → Traefik (:443, host mode, Let's Encrypt)
               ↓  routes via Docker socket label discovery
           app container (Next.js, port 3000, bridge IP)
               ↓  hostname "db", port 5432 (bridge only)
           db container (Postgres 17, never exposed to host)
```

No shared Traefik network needed. Traefik in host mode reaches the app container's bridge IP directly via the Docker provider. Postgres is never published to the host.

---

## Pre-flight Checklist

Complete **every** item before running `docker compose up`.

### 1 — Add swap (do this first — build needs ~1.5 GB RAM)

```bash
# Check if swap exists
free -h

# If Swap line shows 0, add 2 GB:
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make it permanent across reboots:
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify:
free -h
```

### 2 — Install make (if not present)

```bash
apt-get install -y make
```

### 3 — Verify DNS

DNS must resolve **before** Traefik can obtain a Let's Encrypt certificate.

```bash
dig myexpense.srv1488589.hstgr.cloud +short
# Must return: 187.77.155.88
# If it returns anything else or nothing, fix the A record first.
```

### 4 — Generate BETTER_AUTH_SECRET (do this on your LOCAL machine)

```bash
# Run locally — never generate secrets on the VPS
openssl rand -base64 32
```

Copy the output. Store it in your password manager. You will paste it into the `.env` file on the VPS in the next step.

---

## First-Time Deploy

### 1 — SSH to VPS and clone repo

```bash
ssh root@187.77.155.88

mkdir -p /docker/myexpense
cd /docker/myexpense
git clone https://github.com/aidihamid-ui/MyExpense.git repo
cd repo
```

> If the GitHub repo is private, set up an SSH deploy key or use a personal access token:
> `git clone https://<token>@github.com/aidihamid-ui/MyExpense.git repo`

### 2 — Create the production `.env`

```bash
nano /docker/myexpense/repo/.env
```

Paste and fill in all values:

```env
# Database — "db" is the Postgres service name in docker-compose.yml
DATABASE_URL=postgresql://myexpense:<POSTGRES_PASSWORD>@db:5432/myexpense

# Postgres container credentials
POSTGRES_DB=myexpense
POSTGRES_USER=myexpense
POSTGRES_PASSWORD=<strong-random-password>

# Better-Auth — exact URL, no trailing slash
BETTER_AUTH_SECRET=<output-of-openssl-rand-base64-32>
BETTER_AUTH_URL=https://myexpense.srv1488589.hstgr.cloud

# Phase 4+ (leave these for now — required by lib/env.ts when OCR is wired up)
# STORAGE_PATH=/var/lib/myexpense/receipts
# OCR_PROVIDER=paddle
# OCR_SECRET=<random>
```

Lock it down:

```bash
chmod 600 /docker/myexpense/repo/.env
```

### 3 — Build and start

```bash
cd /docker/myexpense/repo
docker compose up --build -d
```

The first build takes 3–5 minutes. Watch progress:

```bash
docker compose logs -f app
```

### 4 — Run migrations

**Always manual. Never automatic.**

```bash
make migrate
# or: docker compose run --rm migrate
```

### 5 — Verify

```bash
# Services are up
make ps

# App responds
curl -I https://myexpense.srv1488589.hstgr.cloud
# Expect: HTTP/2 200 (or 307 redirect to /login)

# Open in browser
# → should see the login page
# → log in with user-a@test.com / password123
```

---

## Environment Variables Reference

| Variable | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://myexpense:pw@db:5432/myexpense` | `db` = compose service name |
| `POSTGRES_DB` | `myexpense` | Postgres DB name |
| `POSTGRES_USER` | `myexpense` | Postgres role |
| `POSTGRES_PASSWORD` | *(random)* | Strong password, stored in password manager |
| `BETTER_AUTH_SECRET` | *(openssl output)* | Generated locally, never on VPS |
| `BETTER_AUTH_URL` | `https://myexpense.srv1488589.hstgr.cloud` | Exact URL, no trailing slash |

---

## Future Deploys

```bash
ssh root@187.77.155.88
cd /docker/myexpense/repo
make deploy          # git pull + rebuild + restart
make migrate         # only if schema changed this release
```

Check the release notes / handoff to know if a migration is needed.

---

## Backup

### Manual backup

```bash
make backup
# Saves to /var/backups/myexpense/db-YYYY-MM-DD_HH-MM-SS.sql.gz
```

### Automated daily backup (cron)

```bash
sudo crontab -e
```

Add this line:

```
0 2 * * * bash /docker/myexpense/repo/scripts/backup-db.sh >> /var/log/myexpense-backup.log 2>&1
```

Backups older than 30 days are pruned automatically.

### Restore from backup

```bash
gunzip -c /var/backups/myexpense/db-<timestamp>.sql.gz \
  | docker compose exec -T db psql -U myexpense myexpense
```

---

## Useful Commands

| Command | What it does |
|---|---|
| `make deploy` | Pull + rebuild + restart |
| `make migrate` | Run Drizzle migrations |
| `make logs` | Tail app logs |
| `make backup` | Manual DB backup |
| `make shell` | Shell inside app container |
| `make ps` | Service status |

---

## Troubleshooting

**Traefik not routing / no HTTPS**
→ Check DNS resolves correctly (`dig myexpense.srv1488589.hstgr.cloud`)
→ Check Traefik logs: `docker logs traefik` (or wherever Traefik runs)
→ Ensure port 443 is open in the firewall: `ufw status`

**App won't start (exits immediately)**
→ `docker compose logs app` — look for missing env var errors
→ Confirm all variables in `.env` are set and `DATABASE_URL` uses `db` not `localhost`

**Migrations fail ("relation does not exist" or connection refused)**
→ Confirm Postgres is healthy first: `make ps`
→ Confirm `DATABASE_URL` in `.env` matches `POSTGRES_USER`/`POSTGRES_PASSWORD`

**`make migrate` exits silently but tables still missing**
→ Root cause (hit in Phase 3 deploy): `make migrate` ran successfully but drizzle-kit silently skipped a migration because the journal (`__drizzle_migrations`) was out of sync — it had 0000 recorded but not 0001.
→ Diagnose: `docker compose exec db psql -U postgres` then `\c <dbname>` then `\dt` — see which tables actually exist, and `SELECT * FROM "__drizzle_migrations";` to compare with files in `drizzle/`.
→ Fix: if journal is missing an entry, manually run the SQL from `drizzle/0001_*.sql` in psql, then insert the missing row into `__drizzle_migrations`.
→ After any manual fix, run `make migrate` once more — it should exit with no output, confirming journal and schema are in sync.
→ **Signup side effect:** `databaseHooks.user.create.after` seeds default categories at signup. If `categories` table didn't exist at signup time, the seed fails silently. Accounts created before the migration was applied will have no categories. Fix: sign out and sign up with a new account, or manually insert categories via psql.

**Build OOMs / killed**
→ VPS ran out of memory. Add swap (Pre-flight step 1) and retry.

**Database data lost after restart**
→ `db_data` Docker volume persists data. If volume was manually deleted, data is gone.
→ Restore from backup (see above).

**Build fails with Zod validation errors on env vars (e.g. "Invalid url", "String must contain at least 32 character(s)")**
→ The Dockerfile builder stage sets placeholder values for env vars so that `lib/env.ts` can be imported during `next build`.
→ These placeholders must be valid-shaped, not literal words like `placeholder`. A URL placeholder must be a real URL format; a secret placeholder must be ≥ 32 characters.
→ After any phase that adds new env vars to `lib/env.ts`, update the corresponding `ARG`/`ENV` lines in the Dockerfile builder stage to use correctly-shaped placeholders, or the build will fail.

---

## Rollback

```bash
# Find last known-good commit
git log --oneline -10

# Roll back
git checkout <commit-hash>
docker compose up --build -d

# If schema was rolled back too, restore DB from backup
```
