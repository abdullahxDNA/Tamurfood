FROM oven/bun:1.2

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

# Build frontend — VITE_ vars are baked in at build time
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN bun run --cwd apps/web build

ENV NODE_ENV=production
EXPOSE 3000

# Run migrations then start the server
CMD ["sh", "-c", "bun packages/db/src/migrate.ts && bun apps/server/src/index.ts"]
