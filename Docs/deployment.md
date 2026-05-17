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

### 2 — Verify DNS

DNS must resolve **before** Traefik can obtain a Let's Encrypt certificate.

```bash
dig myexpense.srv1488589.hstgr.cloud +short
# Must return: 187.77.155.88
# If it returns anything else or nothing, fix the A record first.
```

### 3 — Generate BETTER_AUTH_SECRET (do this on your LOCAL machine)

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

**Build OOMs / killed**
→ VPS ran out of memory. Add swap (Pre-flight step 1) and retry.

**Database data lost after restart**
→ `db_data` Docker volume persists data. If volume was manually deleted, data is gone.
→ Restore from backup (see above).

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
