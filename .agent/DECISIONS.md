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

## D5. Shared package resolution via a `source` export condition

`@classifieds/shared` exports `source`/`types` → `src/index.ts` and `default` → `dist/index.js`. Dev tools
(tsx, Vitest, Vite) resolve the `source` condition so no build is needed during development; production
builds use the compiled `dist`.

## D6. Listing schema — universal core + `attributes` jsonb

Core fields fit any classifieds niche: `title` (≤120), `description`, `price` (integer in minor units,
`null` = price on request), `currency` (ISO code, default `UAH`), `city`, `category_id`, `status`
(`active`/`paused`/`sold`), `seller_id`, timestamps. Niche-specific fields go into `attributes` (jsonb,
default `{}`), validated per category later if needed — new niches need no migrations. If a niche field
must be filtered/sorted heavily, it can be promoted to a real column or get an expression index.
Money as integer minor units avoids floating-point errors. Photos live in `listing_photos` with a
`position` for ordering. Categories are a tree via `parent_id`.

## D7. node-postgres driver

`pg` with `drizzle-orm/node-postgres`: the most common driver, works with better-auth's Drizzle adapter
and drizzle-kit.
