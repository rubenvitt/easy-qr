# syntax=docker/dockerfile:1.7

# ---------- Stage 1: deps (with build toolchain for native modules) ----------
FROM node:22-bookworm-slim AS deps

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=1

# Native build deps for better-sqlite3 (node-gyp)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
        ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

WORKDIR /app

# Copy only manifest files first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc ./

# Install all deps (dev + prod). Compiles better-sqlite3 against Node 22.
RUN pnpm install --frozen-lockfile


# ---------- Stage 2: build SvelteKit (adapter-node) ----------
FROM node:22-bookworm-slim AS build

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=1 \
    NODE_ENV=development

RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build


# ---------- Stage 3: runtime ----------
FROM node:22-bookworm-slim AS runtime

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DB_PATH=/data/app.db

# Toolchain needed once more to (re)compile better-sqlite3 against the runtime image,
# then removed to keep the final image lean.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
        ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

# Non-root runtime user
RUN groupadd --system --gid 1001 app \
 && useradd  --system --uid 1001 --gid app --home /app --shell /usr/sbin/nologin app

WORKDIR /app

# Production deps only (devDependencies excluded; better-sqlite3 compiles here)
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/.npmrc ./
RUN pnpm install --frozen-lockfile --prod \
 && pnpm store prune || true

# Remove the toolchain after native modules are built
RUN apt-get purge -y --auto-remove python3 make g++ \
 && rm -rf /var/lib/apt/lists/* /root/.cache /tmp/* /var/tmp/*

# Built SvelteKit server + migrations
COPY --from=build /app/build ./build
COPY --from=build /app/migrations ./migrations

# Data volume for SQLite
RUN mkdir -p /data \
 && chown -R app:app /data /app

USER app

EXPOSE 3000
VOLUME ["/data"]

CMD ["node", "build/index.js"]
