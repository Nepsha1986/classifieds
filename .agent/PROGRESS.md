# Progress log

Newest entries at the bottom. Format: date — step — what was done → next.

- 2026-10-10 — 0.1 — First run: created `work` skill, verifier sub-agent, `CLAUDE.md`, plan and memory → next: 1.1
- 2026-10-10 — 1.1 — Monorepo root: pnpm workspaces, tsconfig.base, .gitignore, .env.example → next: 1.2
- 2026-10-10 — 1.2 — ESLint 10 flat config + typescript-eslint + Prettier; lint and format:check green → next: 1.3
- 2026-10-10 — 1.3 — packages/shared: Zod 4 listing status + pagination schemas, tsc build, vitest → next: 1.4
- 2026-10-10 — 1.4 — apps/api: Express 5 skeleton, Zod-validated config (process.loadEnvFile), /health, 404 + error handler; smoke-tested with curl → next: 1.5
- 2026-10-10 — 1.5 — Drizzle (node-postgres) client + schema: categories (tree), listings, listing_photos → next: 1.6
- 2026-10-10 — 1.6 — Initial migration (drizzle/0000_init.sql), migrate + idempotent category seed scripts (25 categories, 2 levels) → next: 1.7
- 2026-10-10 — 1.7 — Vitest + supertest in API; global setup rebuilds classifieds_test from migrations; /health checks DB (503 when down); tests for health and seed → next: 1.8
- 2026-10-10 — 1.8 — API Dockerfile (multi-stage, pnpm deploy), docker-compose (postgres 16 + api, test DB init script), .dockerignore. No Docker daemon here: compose validated with `docker compose config`, build stage simulated in a clean copy, prod bundle run against local Postgres → next: stage 1 acceptance

### Stage 1 complete — Project setup and database (2026-10-10)

Verified by the verifier sub-agent: frozen install, lint, typecheck, tests (shared 3, api 3), format:check,
migrate + seed on an empty DB (25 categories, idempotent), `GET /health` → `{"status":"ok","db":"ok"}`.
How to check: `pnpm install && pnpm lint && pnpm typecheck && pnpm test`; `docker compose up -d db`
(or local Postgres), `pnpm --filter @classifieds/api db:migrate && pnpm --filter @classifieds/api db:seed`,
`pnpm --filter @classifieds/api dev`, `curl localhost:4000/health`.
Next: Stage 2 — Authentication (step 2.1).

- 2026-10-10 — 2.1 — better-auth 1.7 with Drizzle adapter (usePlural); users/sessions/accounts/verifications tables + profile fields phone/city; listings.seller_id FK → users; migration 0001_auth; auth env (BETTER_AUTH_URL/SECRET, TRUSTED_ORIGINS) → next: 2.2
- 2026-10-10 — 2.2 — better-auth handler mounted at /api/auth/{*path} before express.json(); curl: sign-up, get-session, sign-in (401 on bad password), sign-out (needs trusted Origin with cookies) → next: 2.3
- 2026-10-10 — 2.3 — middleware/auth.ts: loadSession, requireAuth (401), getAuth; req.auth typed via global Express augmentation; tests for no/invalid/valid session → next: 2.4
- 2026-10-10 — 2.4 — shared user.ts (updateProfileInputSchema, profileSchema, publicUserSchema); users.service; GET/PATCH /api/me behind requireAuth; error handler maps exposed 4xx (malformed JSON) to 400; curl-verified → next: 2.5
- 2026-10-10 — 2.5 — GET /api/users/:id (public profile, no email; 404 for unknown id); curl-verified → next: 2.6
- 2026-10-10 — 2.6 — test/auth.test.ts: sign-up → me → sign-out → sign-in → me, wrong password 401, duplicate 422, short password 400, profile fields rejected at sign-up, /api/me 401/update/clear/400, public profile (schema-checked, no email), 404; helpers.signUpAgent → next: stage 2 acceptance
- 2026-10-10 — 2.x — docker-compose: auth env for the api service (local default secret, overridable); prod build verified: refuses to start without secret, sign-up works with one → next: stage 2 acceptance

### Stage 2 complete — Authentication (2026-10-10)

Verified by the verifier sub-agent: frozen install, lint, typecheck, format:check, tests (shared 7, api 15),
`db:migrate` on an existing DB, and the curl cookie flow (sign-up → me → PATCH me / 400 → public profile
without email → sign-out → 401 → sign-in → me; 401 without cookie).
What works: better-auth email + password under `/api/auth/*` (sessions in Postgres via Drizzle),
`requireAuth`/`loadSession` middleware (`req.auth`), `GET/PATCH /api/me`, `GET /api/users/:id`.
How to check: `pnpm test`; or run the API and use curl with a cookie jar — cookie-authenticated POSTs to
`/api/auth/*` need `Origin: http://localhost:5173` (a trusted origin).
Next: Stage 3 — Listings CRUD and statuses (step 3.1).

- 2026-10-10 — 3.1 — shared listing.ts: create/update/status input schemas, listingSchema output, scalar `attributes` map, status transition table + canChangeListingStatus; unit tests (shared 14) → next: 3.2
- 2026-10-10 — 3.2 — listings.service: create (leaf category check, always active), get (paused only for seller), update (sold is read-only → 409), delete, changeStatus (transition table, idempotent); writes lock the row (SELECT … FOR UPDATE), 404 unknown/non-UUID id, 403 not owner; service tests + seededCategories helper (api 21) → next: 3.3
- 2026-10-10 — 3.3 — routes/listings.ts: POST /api/listings (201 + Location), GET /:id (loadSession, paused only for seller), PATCH /:id, DELETE /:id (204); Request<{ id }> typing since Express 5 types drop params after a middleware; curl-verified → next: 3.4
- 2026-10-10 — 3.4 — PATCH /api/listings/:id/status (changeListingStatusInputSchema → service transition table); curl: active→paused→paused(no-op)→active→sold 200, sold→active 409, bad status 400, anon 401 → next: 3.5
