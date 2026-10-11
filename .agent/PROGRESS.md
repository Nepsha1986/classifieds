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
- 2026-10-10 — 3.5 — GET /api/me/listings: shared myListingsQuerySchema (pagination + optional status), listOwnListings returns Paginated<Listing> newest first (createdAt, id desc), page + count in parallel; curl-verified (pages, status filter, 400, 401) → next: 3.6
- 2026-10-10 — 3.6 — test/listings.test.ts (HTTP): CRUD + Location, 404 unknown/malformed id, 401 on every write, 403 for non-owner (listing unchanged), 400 validation table (create/update/status, non-leaf category, malformed JSON), transitions incl. no-op and sold final/read-only/deletable, paused hidden, /api/me/listings ordering/pagination/status filter/empty/400 (api 42) → next: stage 3 acceptance

### Stage 3 complete — Listings CRUD and statuses (2026-10-10)

Verified by the verifier sub-agent: frozen install, lint, typecheck, format:check, tests (shared 14, api 42),
`db:migrate` + `db:seed`, and a two-user curl flow (201/200/403/401/400/409/204/404 as designed).
What works: `POST /api/listings`, `GET/PATCH/DELETE /api/listings/:id`, `PATCH /api/listings/:id/status`
(active ↔ paused, → sold; sold final and read-only), `GET /api/me/listings` (paginated, `?status=`).
Shared schemas: create/update/status inputs, `listingSchema`, `myListingsQuerySchema`, transition table.
Paused listings are visible only to the seller; writes lock the row; leaf categories only.
How to check: `pnpm test`; or run the API and use curl with a cookie jar (sign-up needs
`Origin: http://localhost:5173`), then POST a listing with the `cars` category id.
Next: Stage 4 — Categories and photo upload (step 4.1).

- 2026-10-10 — 4.1 — shared category.ts (recursive categorySchema/categoryTreeSchema, categorySubtreeIds for later filters); categories.service builds the tree from one ordered query; GET /api/categories (public, Cache-Control max-age=300); tests (shared 20, api 44), curl-verified → next: 4.2
- 2026-10-10 — 4.2 — multer 2.4: POST /api/listings/:id/photos (field `photos`, ≤5 MB each, JPEG/PNG/WebP, ≤10 per listing); ownership pre-check before the body is read, then multer to UPLOAD_DIR/tmp, magic-byte check, rename into UPLOAD_DIR/listings under a row lock, temp files always removed; shared photo.ts (limits + listingPhotoSchema); UPLOAD_DIR resolved against apps/api; tests use a temp upload dir; curl-verified 201/415/413/403/401/400/409 → next: 4.3
- 2026-10-10 — 4.3 — static /uploads/listings (immutable 1y cache, nosniff, tmp not exposed, JSON 404); listing output gains ordered `photos` (batch-loaded in one query for lists); PUT /api/listings/:id/photos/order (full permutation, shared reorderListingPhotosInputSchema); DELETE /api/listings/:id/photos/:photoId (204, positions compacted, file removed after commit); ownership helpers moved to services/listing-access.ts; curl-verified (shared 28, api 44) → next: 4.4
- 2026-10-10 — 4.4 — deleteListing collects photo file names in the transaction and removes the files after commit (photo delete already did, 4.3); services/upload-sweep.ts: startup safety net removes temp files and unreferenced photo files older than 1 h; test helper pngBytes(); sweep test (api 45); curl-verified listing delete removes its files → next: 4.5
- 2026-10-10 — 4.5 — test/photos.test.ts (HTTP): upload + download by URL (bytes, content-type, nosniff, immutable), JPEG/WebP named by real bytes, photos in listing and /api/me/listings, 415 declared/real type (all-or-nothing), 413 over limit and exact limit ok, 400 per request / 409 per listing, 400 no files / wrong field / text field, 401/403 (nothing written)/404, sold 409, paused ok, reorder 200/400/403/401, photo delete (file gone, positions compacted, 404 again, foreign photo 404, sold 409), listing delete removes files, temp dir empty and not served; test/uploads.test.ts magic bytes; categories tests from 4.1 (shared 28, api 77) → next: stage 4 acceptance

### Stage 4 complete — Categories and photo upload (2026-10-10)

Verified by the verifier sub-agent: frozen install, lint, typecheck, format:check, tests (shared 28, api 77),
`db:migrate` + `db:seed`, `db:generate` (no schema changes), API build, and a curl flow: category tree,
PNG upload 201 → download by URL 200 `image/png` with identical bytes, 415 (declared and real type),
413, 403, 401, reorder, photo delete (file removed, positions compacted), listing delete (files removed),
temp dir empty.
What works: `GET /api/categories` (tree), `POST /api/listings/:id/photos` (multipart `photos`, JPEG/PNG/WebP
by magic bytes, ≤5 MB, ≤10 per listing), static `/uploads/listings/*`, `PUT /api/listings/:id/photos/order`,
`DELETE /api/listings/:id/photos/:photoId`; every listing response has ordered `photos`; files are removed
on photo/listing delete; a startup sweep removes stale temp and orphaned photo files.
How to check: `pnpm test`; or run the API, sign up with a cookie jar (`Origin: http://localhost:5173`),
create a listing, `curl -b jar -F photos=@a.png localhost:4000/api/listings/<id>/photos`, then GET the `url`.
Next: Stage 5 — Search, filters, pagination (step 5.1).

- 2026-10-11 — 5.1 — shared listingSearchQuerySchema (q, category subtree id, city, min/maxPrice, currency, sort incl. relevance-only-with-q, pagination; blank params = unset; min ≤ max), LISTING_SORTS; unit tests (shared 33) → next: 5.2
- 2026-10-11 — 5.2 — GET /api/listings (public): searchListings — active only, category subtree via recursive CTE, case-insensitive city, currency, inclusive price bounds (null price excluded), sorts newest/oldest/price_asc/price_desc (NULLS LAST, id tie-break), Paginated with total; q accepted but not applied yet; curl-verified → next: 5.3 (full-text q + relevance)
- 2026-10-11 — 5.3 — migration 0002_search: generated search_vector (simple config, title A / description B) + GIN index; q → prefix tsquery from letters/digits (AND), @@ filter, relevance = ts_rank then newest (default sort with q); list queries skip the vector; curl-verified incl. Cyrillic prefixes and tsquery-syntax input (shared 33, api 77) → next: 5.4
- 2026-10-11 — 5.4 — migration 0003_search_indexes: partial (status='active') indexes on (category_id, created_at), lower(city), price; seller index → (seller_id, created_at); status filter as SQL literal for partial-index matching; EXPLAIN-checked on 50k rows; db:seed:demo (3 demo sellers via better-auth, 36 listings, idempotent skip), demo sign-in verified (shared 33, api 77) → next: 5.5
- 2026-10-11 — 5.5 — test/search.test.ts (HTTP, own fixtures on an emptied table): defaults (active only, newest, schema-valid, public, blank params), category subtree/leaf/unknown, city case-insensitive exact, inclusive price bounds + null excluded, currency, q (title ranked first, prefixes, AND, case, Cyrillic, paused/sold never found, tsquery syntax harmless, punctuation-only → empty), toPrefixTsquery unit, sorts incl. NULLS LAST and sort overriding relevance, combinations, pagination (pages, partial/past-end, after filters, max size), 400 table; seedDemo test (shared 33, api 115) → next: stage 5 acceptance

### Stage 5 complete — Search, filters, pagination (2026-10-11)

Verified by the verifier sub-agent: frozen install, lint, typecheck, format:check, tests (shared 33, api 115),
fresh-DB `db:migrate` + `db:seed` + `db:seed:demo` (second run skipped), `db:generate` (no schema changes),
and a curl flow on demo data: defaults (active only, newest first), category subtree, case-insensitive city,
price bounds, currency, `q=iphone`, `q=вело`, price sort with null prices last, pagination consistency,
400 for relevance without `q` and min > max; paused/sold listings never returned; demo sign-in 200.
What works: public `GET /api/listings` with `q` (prefix full-text over title/description, ranked by
`ts_rank`), `category` (incl. descendants), `city`, `minPrice`/`maxPrice`, `currency`, `sort`
(relevance/newest/oldest/price_asc/price_desc), `page`/`pageSize` → `Paginated<Listing>` with `total`.
Migrations 0002 (generated `search_vector` + GIN) and 0003 (partial indexes on active listings).
`pnpm --filter @classifieds/api db:seed:demo` → 3 demo sellers (`*@demo.classifieds` / `demo-password`),
36 listings.
How to check: `pnpm test`; or `db:seed:demo`, run the API, `curl 'localhost:4000/api/listings?q=iphone&city=kyiv'`.
Next: Stage 6 — Merchant portal (React), step 6.1.

- 2026-10-11 — 6.1 — API: CORS for TRUSTED_ORIGINS with credentials (mounted before better-auth, preflights for API + auth), test/cors.test.ts; shared paginatedSchema(); apps/merchant: Vite 8 + React 19 + React Router 8 (data router) + TanStack Query, `source` condition for shared, dev proxy /api + /uploads → API, env from the root .env (VITE_API_URL), fetch client (cookies, JSON/FormData, responses parsed with shared schemas, ApiError for our and better-auth error shapes), typed endpoints for auth/me/categories/listings/photos, layout + start + 404 pages, Vitest + jsdom + Testing Library; react-hooks ESLint rules for merchant; build ok; proxy curl-verified (demo sign-in → /api/me → /api/me/listings) (shared 35, api 118, merchant 10) → next: 6.2
- 2026-10-11 — 6.2 — shared signUpInputSchema/signInInputSchema + PASSWORD_MIN/MAX_LENGTH (better-auth config uses them); merchant: react-hook-form + zodResolver with shared schemas, /login and /register (GuestOnly), RequireAuth guard (?next= kept, only same-app paths followed), sign-out in the header, session switch drops other cached data but keeps `me` observed, any 401 resets `me` → guard redirects; form helpers (Field, FormError, applyFieldErrors); fake-API test helper; Playwright set up (apps/merchant/e2e, `pnpm --filter @classifieds/merchant e2e`, starts/reuses API + Vite, PLAYWRIGHT_CHROMIUM_PATH) — e2e auth spec passes against the real API (shared 38, api 118, merchant 20) → next: 6.3
- 2026-10-11 — 6.3 — My listings page at `/`: status tabs (All/Active/Paused/Sold) and page synced with the URL (unknown status ignored), rows with cover thumb, title, status badge, price (minor units via Intl, whole amounts without decimals, null → "Price on request"), category path, city, date; actions only from LISTING_STATUS_TRANSITIONS (sold → only Delete), confirm before "Mark as sold" and delete, API errors shown, list refetched after mutations, pagination, empty / past-the-end states; queries.ts (query keys, categories cached forever); format.ts; component tests with an in-memory fake API; e2e my-listings spec passes against the real API (shared 38, api 118, merchant 34) → next: 6.4
- 2026-10-11 — 6.4 — /listings/new and /listings/:id/edit: ListingForm (react-hook-form) validated by a resolver that converts the typed values (price in major units with spaces/comma, select ids) and runs the shared createListingInputSchema, errors mapped to fields; API 400 fieldErrors shown on fields, other errors above the button; category select with leaf categories only, grouped by top-level (form mounts after categories load); currency select; city defaults to the profile city; create → edit page with "published" notice (photos next); edit prefilled, PATCH without attributes (kept), sold → read-only, 404 page; "New listing" in header and list, "Edit" for non-sold rows, titles link to edit; shared listing messages made human-readable; e2e listing-form spec (shared 39, api 118, merchant 50) → next: 6.5
- 2026-10-11 — 6.5 — PhotosEditor on the edit page: grid in order with the cover marked, "Make cover" / ← / → (full permutation PUT), remove with confirm, "Add photos" (multiple) uploads right after picking; client checks with shared limits (type, 5 MB, 10 per listing; over-limit selection rejected whole) before sending; API errors shown; the listing cache gets the returned photos and the list refetches (covers); sold → photos read-only; component tests + e2e photos spec (real PNGs decoded by the browser via the /uploads proxy, order survives reload, cover in the list) (shared 39, api 118, merchant 60) → next: 6.6
