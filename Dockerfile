# syntax=docker/dockerfile:1

# ── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time placeholders — Next.js standalone build requires these env vars to
# be present at build time. They are overridden at runtime by the real .env on the VPS.
ENV DATABASE_URL=postgresql://x:x@localhost:5432/x
ENV BETTER_AUTH_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ENV BETTER_AUTH_URL=http://localhost:3000
ENV STORAGE_PATH=/tmp/receipts
ARG OCR_SERVICE_URL=http://localhost:8001
ENV OCR_SERVICE_URL=$OCR_SERVICE_URL
ARG OCR_SECRET=placeholder-secret-not-used-at-runtime
ENV OCR_SECRET=$OCR_SECRET
RUN npm run build

# ── Stage 3: production runner (standalone, non-root) ─────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone output bundles only what the server needs
COPY --from=builder /app/public                          ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

# ── Stage 4: migrator (full deps, drizzle-kit available) ──────────────────────
FROM node:24-alpine AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL must be provided at runtime via --env or compose env.
# Drizzle-kit reads it from the environment directly (no --env-file needed).
CMD ["npx", "drizzle-kit", "migrate"]

# ── Stage 5: OCR worker (tsx runner) ────────────────────────────────────
FROM node:24-alpine AS worker
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["node_modules/.bin/tsx", "lib/worker.ts"]
