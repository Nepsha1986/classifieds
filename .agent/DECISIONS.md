# Decisions

## D1. pnpm workspaces
pnpm is installed and handles workspaces and strict dependency isolation better than npm.

## D2. Merchant portal on Vite, public dashboard on Next.js
The brief's architecture puts the public dashboard on Next.js (SSR for SEO); the merchant portal is a
plain React SPA behind login, so Vite is enough there.

## D3. Local PostgreSQL fallback when Docker is unavailable
Cloud sessions have the Docker CLI but no daemon. Verification uses a local PostgreSQL 16 cluster with the
same credentials as `docker-compose.yml`; Docker files are still written and kept correct.

## D4. Current major versions
Express 5, Zod 4, Drizzle ORM 0.45 / drizzle-kit 0.31, better-auth 1.x, Next.js 16, Vitest for tests.
