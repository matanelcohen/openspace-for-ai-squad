# Multi-stage build for openspace.ai
# Produces a single image with API + Web on port 3000

# ── Stage 1: Install deps ────────────────────────────────────────
FROM node:22-slim AS deps

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/memory-store/package.json packages/memory-store/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY packages/skills-core/package.json packages/skills-core/
COPY packages/tracing/package.json packages/tracing/

RUN pnpm install --frozen-lockfile --prod=false

# ── Stage 2: Build ────────────────────────────────────────────────
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages
COPY . .

# Build Next.js for production
RUN cd apps/web && npx next build

# ── Stage 3: Production ──────────────────────────────────────────
FROM node:22-slim AS runner

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/apps/web ./apps/web
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/tsconfig.json ./

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

ENV NODE_ENV=production
ENV PORT=3000
ENV API_PORT=3000
ENV SERVE_UI=true
ENV HOST=0.0.0.0

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:3000/health || exit 1

# Start with tsx (API serves Next.js via @fastify/nextjs)
CMD ["npx", "tsx", "apps/api/src/index.ts"]
