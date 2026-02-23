# ── Stage 1: Build everything ────────────────────────────────────────────────
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

# ── Stage 2: Prune node_modules for api ──────────────────────────────────────
FROM builder AS api-pruned
RUN pnpm --filter @forgeportal/api deploy --legacy --prod /pruned/api

# ── Stage 3: Prune node_modules for worker ───────────────────────────────────
FROM builder AS worker-pruned
RUN pnpm --filter @forgeportal/worker deploy --legacy --prod /pruned/worker

# ── Stage 4: API runtime image ────────────────────────────────────────────────
FROM node:20-slim AS api
RUN groupadd -g 1001 forgeportal && useradd -u 1001 -g forgeportal -s /bin/sh forgeportal
WORKDIR /app
COPY --from=api-pruned /pruned/api/node_modules ./node_modules
COPY --from=api-pruned /pruned/api/package.json ./package.json
COPY --from=builder    /app/apps/api/dist        ./dist
COPY --from=builder    /app/tools/migration      ./tools/migration
COPY --from=builder    /app/tools/seed           ./tools/seed
USER forgeportal
EXPOSE 4000
CMD ["node", "dist/server.js"]

# ── Stage 5: Worker runtime image ────────────────────────────────────────────
FROM node:20-slim AS worker
RUN groupadd -g 1001 forgeportal && useradd -u 1001 -g forgeportal -s /bin/sh forgeportal
WORKDIR /app
COPY --from=worker-pruned /pruned/worker/node_modules ./node_modules
COPY --from=worker-pruned /pruned/worker/package.json ./package.json
COPY --from=builder       /app/apps/worker/dist        ./dist
USER forgeportal
CMD ["node", "dist/worker.js"]

# ── Stage 6: UI production image (nginx serving Vite build) ──────────────────
FROM builder AS ui-build
RUN pnpm --filter @forgeportal/ui build

FROM nginx:1.27-alpine AS ui
COPY --from=ui-build /app/apps/ui/dist /usr/share/nginx/html
COPY deployments/docker-compose/nginx-ui.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
