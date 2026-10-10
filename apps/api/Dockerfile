# Build context: repository root (see docker-compose.yml).
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @classifieds/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @classifieds/api... build \
  && pnpm --filter @classifieds/api deploy --prod --legacy /prod/api

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    UPLOAD_DIR=/app/uploads
WORKDIR /app
COPY --from=build --chown=node:node /prod/api .
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 4000
# Migrations and the category seed are idempotent, so they run on every start.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/db/seed.js && node dist/server.js"]
