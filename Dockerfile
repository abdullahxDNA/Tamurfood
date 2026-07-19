# ─── Build stage: install ALL deps (incl. dev) and build the frontend ───
FROM oven/bun:1.2 AS builder

WORKDIR /app

# Install dependencies (workspace-aware)
COPY bun.lock package.json ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/db/package.json packages/db/
RUN bun install --frozen-lockfile

# Copy all source files
COPY . .
# Remove any .env files/symlinks so Railway env vars are used
RUN find . -name ".env" -o -name ".env.local" | xargs rm -f 2>/dev/null || true

# Build frontend — VITE_ vars are baked in at build time (VITE_SENTRY_DSN is a
# local-dev fallback; production injects the DSN at runtime via window.__ENV__).
ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN bun run --cwd apps/web build:docker

# ─── Runtime stage: production deps + built artifacts only ───
# Keeps dev/build tooling (vite, eslint, tsc, drizzle-kit, …) out of the shipped
# image — smaller image and a much smaller dependency-audit surface.
FROM oven/bun:1.2 AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Production dependencies only. --ignore-scripts skips the root "prepare" hook
# (husky — a dev-only git-hook installer that isn't present in --production and
# is meaningless in a container); no runtime dependency needs a postinstall.
COPY bun.lock package.json ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/db/package.json packages/db/
RUN bun install --frozen-lockfile --production --ignore-scripts

# Server + db source (Bun runs the TypeScript directly) and the built frontend.
COPY apps/server ./apps/server
COPY packages/db ./packages/db
COPY --from=builder /app/apps/web/dist ./apps/web/dist
# Remove any .env files/symlinks so Railway env vars are used.
RUN find . -name ".env" -o -name ".env.local" | xargs rm -f 2>/dev/null || true

EXPOSE 3000

# Run migrations then start the server
CMD ["sh", "-c", "bun packages/db/src/migrate.ts && bun apps/server/src/index.ts"]
