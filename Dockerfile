# Stage 1: Build
FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json tsconfig.ui.json ./
COPY apps/ apps/
COPY packages/ packages/
COPY tools/ tools/
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Stage 2: Prune for api
FROM builder AS api-pruned
RUN pnpm --filter @forgeportal/api deploy --legacy --prod /pruned/api

# Stage 3: Prune for worker
FROM builder AS worker-pruned
RUN pnpm --filter @forgeportal/worker deploy --legacy --prod /pruned/worker

# Stage 4: Run
FROM node:20-slim AS runner
RUN groupadd -g 1001 forgeportal && useradd -u 1001 -g forgeportal -s /bin/sh forgeportal
WORKDIR /app
COPY --from=api-pruned /pruned/api/node_modules ./api/node_modules
COPY --from=api-pruned /pruned/api/package.json ./api/package.json
COPY --from=builder /app/apps/api/dist ./api/dist
COPY --from=worker-pruned /pruned/worker/node_modules ./worker/node_modules
COPY --from=worker-pruned /pruned/worker/package.json ./worker/package.json
COPY --from=builder /app/apps/worker/dist ./worker/dist
COPY --from=builder /app/tools/migration ./tools/migration
COPY --from=builder /app/tools/seed ./tools/seed
USER forgeportal
EXPOSE 4000
CMD ["node", "api/dist/server.js"]
