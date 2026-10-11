# Build context: repository root (see docker-compose.yml).
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @classifieds/web...
COPY packages/shared packages/shared
COPY apps/web apps/web
# `prebuild` compiles @classifieds/shared first; pages render per request, so the API is not needed here.
RUN pnpm --filter @classifieds/web build

FROM node:22-alpine AS runtime
# API_URL, PUBLIC_API_URL and SITE_URL are read per request: set them on the container, not at build time.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
# The standalone output mirrors the repo layout (traced from the root) with only the files it needs.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
