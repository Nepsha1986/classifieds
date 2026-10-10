# Plan

Status: `[ ]` todo · `[~]` in progress · `[x]` done. One `work` run = one stage.

## Stage 0 — Bootstrap the agent

- [x] 0.1 Create `work` skill, verifier sub-agent, `CLAUDE.md`, memory files and this plan

## Stage 1 — Project setup and database

- [x] 1.1 Monorepo root: pnpm workspaces, TypeScript base config, `.gitignore`, `.env.example`
- [x] 1.2 ESLint (flat config) + Prettier at the root, `lint`/`format`/`typecheck` scripts
- [ ] 1.3 `packages/shared`: package skeleton, build setup, first Zod schemas (listing status, pagination)
- [ ] 1.4 `apps/api`: Express 5 skeleton, config loaded/validated with Zod, `/health` endpoint, error handler
- [ ] 1.5 Drizzle setup: connection, schema for categories, listings, listing_photos (auth tables come in Stage 2)
- [ ] 1.6 Migrations generated and applied; seed script for categories
- [ ] 1.7 Vitest in the API with a test DB; `/health` test that also checks the DB
- [ ] 1.8 `docker-compose.yml` (postgres + api) and API `Dockerfile`
- Acceptance: `pnpm lint && pnpm typecheck && pnpm test` green; `db:migrate` + `db:seed` work on an empty DB;
  `GET /health` returns `{ status: "ok", db: "ok" }`.

## Stage 2 — Authentication

- [ ] 2.1 better-auth server config with Drizzle adapter; auth tables in the schema + migration
- [ ] 2.2 Mount the auth handler in Express; email + password sign-up / sign-in / sign-out
- [ ] 2.3 `requireAuth` middleware that loads the session onto `req`
- [ ] 2.4 Profile: `GET /api/me`, `PATCH /api/me` (name, phone, city) with shared Zod schemas
- [ ] 2.5 Public user profile `GET /api/users/:id`
- [ ] 2.6 Tests: sign-up → sign-in → me → sign-out; unauthorized access is 401
- Acceptance: tests green; curl flow with cookies works.

## Stage 3 — Listings CRUD and statuses

- [ ] 3.1 Shared schemas: create/update listing input, listing output
- [ ] 3.2 Service layer: create, get, update, delete with ownership checks
- [ ] 3.3 Routes: `POST /api/listings`, `GET /api/listings/:id`, `PATCH`, `DELETE`
- [ ] 3.4 Statuses active / sold / paused: `PATCH /api/listings/:id/status` with allowed transitions
- [ ] 3.5 `GET /api/me/listings` (own listings, any status)
- [ ] 3.6 Tests for CRUD, ownership (403), validation (400), status transitions
- Acceptance: tests green.

## Stage 4 — Categories and photo upload

- [ ] 4.1 `GET /api/categories` (tree: parent/children)
- [ ] 4.2 Multer upload to local disk: `POST /api/listings/:id/photos` (type/size/count limits)
- [ ] 4.3 Serve uploads statically; `DELETE /api/listings/:id/photos/:photoId`; photo ordering
- [ ] 4.4 Delete files from disk when a listing or photo is deleted
- [ ] 4.5 Tests for categories and upload (valid image, wrong type, too large, not owner)
- Acceptance: tests green; uploaded photo is downloadable by URL.

## Stage 5 — Search, filters, pagination

- [ ] 5.1 Shared query schema: q, category (incl. children), city, price min/max, sort, page, pageSize
- [ ] 5.2 `GET /api/listings` — only active listings, filters, sorting, paginated response with total
- [ ] 5.3 Full-text search via PostgreSQL `tsvector` + GIN index (migration)
- [ ] 5.4 Indexes for filter columns; demo seed with sample users/listings
- [ ] 5.5 Tests for each filter, combinations, pagination edges
- Acceptance: tests green.

## Stage 6 — Merchant portal (React)

- [ ] 6.1 Vite + React + TS app, router, API client using shared types, CORS/cookies in the API
- [ ] 6.2 Sign-up / sign-in / sign-out pages, auth guard
- [ ] 6.3 My listings page with status badges and status actions
- [ ] 6.4 Create/edit listing form (Zod validation from shared), category select
- [ ] 6.5 Photo upload/remove in the edit form
- [ ] 6.6 Profile page
- Acceptance: build passes; manual flow works against the API (checked with Playwright).

## Stage 7 — Public dashboard (Next.js)

- [ ] 7.1 Next.js app (App Router), server-side data fetching from the API
- [ ] 7.2 Feed with pagination
- [ ] 7.3 Search and filters synced with the URL
- [ ] 7.4 Listing page (photos, seller), metadata for SEO
- [ ] 7.5 Seller public profile page
- Acceptance: build passes; pages render server-side (checked with Playwright).

## Stage 8 — Docker and finishing

- [ ] 8.1 Dockerfiles for merchant and web; full `docker-compose.yml`
- [ ] 8.2 README: setup, running, architecture, API overview
- [ ] 8.3 Final pass: lint, tests, builds, fix leftovers
- Acceptance: all checks green; README instructions reproduce a running stack.
