# Build context: repository root (see docker-compose.yml).
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/merchant/package.json apps/merchant/
RUN pnpm install --frozen-lockfile --filter @classifieds/merchant...
COPY packages/shared packages/shared
COPY apps/merchant apps/merchant
# Empty = the app calls the API on its own origin, and nginx below proxies it (no CORS, first-party cookies).
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @classifieds/merchant build

FROM nginx:1.29-alpine AS runtime
# Where nginx forwards /api and /uploads; substituted into the config when the container starts.
ENV API_UPSTREAM=http://api:4000
COPY apps/merchant/docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/apps/merchant/dist /usr/share/nginx/html
EXPOSE 80
