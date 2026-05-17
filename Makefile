## MyExpense — Docker management
## Run these from /docker/myexpense/repo on the VPS.

# Pull latest code from GitHub, rebuild images, and restart all services.
deploy:
	git pull && docker compose up --build -d

# Run database migrations manually. Always run after deploy if schema changed.
# Never runs automatically on startup.
migrate:
	docker compose run --rm migrate

# Tail live logs for the app container (Ctrl+C to stop).
logs:
	docker compose logs -f app

# Back up the Postgres database to /var/backups/myexpense/ (gzipped, 30-day retention).
backup:
	bash scripts/backup-db.sh

# Open an interactive shell inside the running app container.
shell:
	docker compose exec app sh

# Show the status of all running services.
ps:
	docker compose ps

.PHONY: deploy migrate logs backup shell ps
