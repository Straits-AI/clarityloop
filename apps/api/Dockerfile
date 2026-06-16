FROM node:20-slim AS base
RUN corepack enable
WORKDIR /app

# Install deps using the workspace manifests for cache efficiency
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/core/package.json packages/core/
COPY packages/qwen/package.json packages/qwen/
COPY packages/storage/package.json packages/storage/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile=false

# Copy sources and build
COPY . .
RUN pnpm --filter @clarityloop/api... build

EXPOSE 8080
CMD ["node", "apps/api/dist/server.js"]
