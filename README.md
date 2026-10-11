# classifieds

A classifieds board: people sign up, publish listings with categories and photos, and everyone can
browse, search and filter them. There are no payments or carts. The point of the project is a solid
Node.js backend and two frontends that share one contract with it.

| App               | What it is                                                         | URL                   |
| ----------------- | ------------------------------------------------------------------ | --------------------- |
| `apps/api`        | REST API: Express 5, Drizzle ORM (PostgreSQL), better-auth, Multer | http://localhost:4000 |
| `apps/merchant`   | Merchant portal (React + Vite): sellers manage their own listings  | http://localhost:5173 |
| `apps/web`        | Public dashboard (Next.js, server-rendered): browse and search     | http://localhost:3000 |
| `packages/shared` | Zod schemas, types and formatters used by all three apps           | —                     |

## Quick start with Docker

```sh
docker compose up --build
```

This starts PostgreSQL, the API (it applies migrations and seeds the categories on every start), the
merchant portal and the public dashboard. Open http://localhost:5173 to register and post a listing,
then see it on http://localhost:3000.

The stack starts with categories only. To fill it with demo sellers and listings, run from the host
(needs Node.js 22 and pnpm, see below; the compose database is published on port 5432):

```sh
pnpm install
cp .env.example .env   # then set BETTER_AUTH_SECRET, e.g. to the output of `openssl rand -base64 32`
pnpm --filter @classifieds/api db:seed:demo
```

Demo sellers sign in as `olena@demo.classifieds`, `taras@demo.classifieds` or `iryna@demo.classifieds`
with the password `demo-password`.

The compose file uses a built-in development secret for auth. For anything beyond a local run, set
`BETTER_AUTH_SECRET` (at least 32 characters) in the environment before `docker compose up`.

## Local development

Requirements: Node.js 22 (`.nvmrc`), pnpm 10 (`corepack enable`), PostgreSQL 16.

```sh
pnpm install
cp .env.example .env                 # set BETTER_AUTH_SECRET
docker compose up -d db              # or a local PostgreSQL with the same credentials
pnpm --filter @classifieds/api db:migrate
pnpm --filter @classifieds/api db:seed          # categories
pnpm --filter @classifieds/api db:seed:demo     # optional demo users and listings

pnpm --filter @classifieds/api dev        # http://localhost:4000, restarts on change
pnpm --filter @classifieds/merchant dev   # http://localhost:5173, proxies /api and /uploads to the API
pnpm --filter @classifieds/web dev        # http://localhost:3000
```

Without Docker, create the role and the two databases yourself (the test suite uses its own database):

```sh
createuser --superuser --pwprompt classifieds   # password: classifieds
createdb -O classifieds classifieds
createdb -O classifieds classifieds_test
```

### Environment

All apps read one `.env` at the repository root; `.env.example` documents every variable.

| Variable             | Used by  | Meaning                                                                  |
| -------------------- | -------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`       | api      | PostgreSQL connection string                                             |
| `TEST_DATABASE_URL`  | api      | Database the tests rebuild from migrations on every run                  |
| `PORT`, `UPLOAD_DIR` | api      | Listen port; where photos are stored                                     |
| `BETTER_AUTH_URL`    | api      | The API's public URL                                                     |
| `BETTER_AUTH_SECRET` | api      | Session signing secret, at least 32 characters; required in production   |
| `TRUSTED_ORIGINS`    | api      | Frontend origins allowed to call the API with cookies (CORS, CSRF check) |
| `VITE_API_URL`       | merchant | Empty = call the API on the portal's own origin (proxied); or a URL      |
| `API_PROXY_TARGET`   | merchant | Where the dev server proxies `/api` and `/uploads`                       |
| `API_URL`            | web      | How the Next.js server reaches the API                                   |
| `PUBLIC_API_URL`     | web      | How browsers reach the API (photo URLs); defaults to `API_URL`           |
| `SITE_URL`           | web      | The dashboard's public URL (canonical links, Open Graph)                 |

The web variables are read per request, so one build or image serves any environment.

## Checks

```sh
pnpm lint            # ESLint across the repo
pnpm format:check    # Prettier
pnpm typecheck       # tsc in every workspace
pnpm test            # Vitest: shared units, API against a real PostgreSQL, frontend components
pnpm build           # build every workspace
```

API tests need PostgreSQL running and `TEST_DATABASE_URL` set; they recreate that database from the
migrations, so never point it at data you care about.

End-to-end checks drive a real browser against the real API and database. They start the servers they
need, or reuse ones already running on the same ports:

```sh
pnpm --filter @classifieds/merchant e2e   # sign-up, listing form, statuses, photos, profile
pnpm --filter @classifieds/web e2e        # server-rendered pages, checked with JavaScript disabled
```

Use `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium` to run them with an installed Chromium.
Against the Docker stack the API runs in production mode and limits sign-ups to 3 per 10 seconds per
client, so run the merchant specs one file at a time there.

## Architecture

```text
 browser ──► merchant :5173 ─── nginx (Docker) / Vite (dev) ──┐  /api, /uploads
                                                              ▼
 browser ──► web :3000 ── Next.js server ── API_URL ───► api :4000 ──► PostgreSQL
    │                                                         ▲  └──► uploads/ (photos)
    └──────────── photo URLs (PUBLIC_API_URL) ────────────────┘
```

- **One contract.** Every request and response shape is a Zod schema in `@classifieds/shared`. The API
  validates input with it; both frontends parse every response with it, so drift fails loudly instead
  of rendering wrong data. The merchant form validates with the same schema the API uses.
- **API layers.** Routes only parse input and shape responses; business rules (ownership, status
  transitions, visibility, photo limits) live in `apps/api/src/services`. Errors are `HttpError`s that
  one error handler turns into `{ "error": "...", "details": ... }`; Zod failures become 400.
- **Data.** Drizzle schema in `apps/api/src/db/schema.ts`; SQL migrations in `apps/api/drizzle` are
  generated by drizzle-kit and applied by our own script. Listings keep a universal core (title,
  description, price in minor units + currency, city, category) plus a free-form `attributes` map.
  Search uses a PostgreSQL `tsvector` column with a GIN index plus indexes for the filters.
- **Auth.** better-auth with email and password, sessions stored in PostgreSQL, an httpOnly cookie.
  The merchant portal calls the API on its own origin (Vite proxy in development, nginx in Docker), so
  the cookie is first-party and no CORS is needed. The public dashboard shows public data only and
  never sends cookies.
- **Photos.** Multer writes uploads to disk after the ownership check; type is checked by magic bytes.
  Files are served by the API with immutable caching and deleted along with their photo or listing.
- **Public dashboard.** Server components only: every page is rendered on the server from the API, works
  without JavaScript, and the search state lives in the URL (one canonical URL per search). Listing
  pages carry SEO metadata, Open Graph tags and schema.org `Product` data.

The reasoning behind these choices is recorded in [`.agent/DECISIONS.md`](.agent/DECISIONS.md).

## API overview

All JSON. Writes need the session cookie; cookie-authenticated requests to `/api/auth/*` must come from
one of `TRUSTED_ORIGINS`.

| Method   | Path                                | Auth  | Description                                                 |
| -------- | ----------------------------------- | ----- | ----------------------------------------------------------- |
| `GET`    | `/health`                           |       | `{ status, db }`; 503 when the database is down             |
| `POST`   | `/api/auth/sign-up/email`           |       | `{ name, email, password }` — creates the user, signs in    |
| `POST`   | `/api/auth/sign-in/email`           |       | `{ email, password }`                                       |
| `POST`   | `/api/auth/sign-out`                | yes   | Ends the session                                            |
| `GET`    | `/api/me`                           | yes   | Own profile                                                 |
| `PATCH`  | `/api/me`                           | yes   | Update `name`, `phone`, `city`                              |
| `GET`    | `/api/me/listings`                  | yes   | Own listings in any status; `?status=&page=&pageSize=`      |
| `GET`    | `/api/users/:id`                    |       | Public profile (no email)                                   |
| `GET`    | `/api/categories`                   |       | Category tree                                               |
| `GET`    | `/api/listings`                     |       | Search active listings (query below), paginated             |
| `POST`   | `/api/listings`                     | yes   | Create a listing (leaf category); 201 + `Location`          |
| `GET`    | `/api/listings/:id`                 |       | A listing; paused ones only for their seller                |
| `PATCH`  | `/api/listings/:id`                 | owner | Update fields; sold listings are read-only                  |
| `DELETE` | `/api/listings/:id`                 | owner | Delete the listing and its photo files                      |
| `PATCH`  | `/api/listings/:id/status`          | owner | `{ status }`: `active` ⇄ `paused`, either → `sold` (final)  |
| `POST`   | `/api/listings/:id/photos`          | owner | Multipart field `photos`: JPEG/PNG/WebP, ≤ 5 MB, ≤ 10 total |
| `PUT`    | `/api/listings/:id/photos/order`    | owner | `{ photoIds }` — the full new order; the first is the cover |
| `DELETE` | `/api/listings/:id/photos/:photoId` | owner | Remove one photo                                            |
| `GET`    | `/uploads/...`                      |       | Photo files                                                 |

`GET /api/listings` query parameters: `q` (full-text), `category` (ID; a parent includes its
subcategories), `city`, `minPrice` / `maxPrice` (minor units, inclusive), `currency`, `seller` (user
ID), `sort` (`relevance` with `q`, `newest`, `oldest`, `price_asc`, `price_desc`), `page`, `pageSize`.
Paginated responses look like `{ items, page, pageSize, total, totalPages }`.

Status codes: 400 invalid input (with `details`), 401 not signed in, 403 not the owner, 404 unknown or
hidden, 409 not allowed in the current state (e.g. editing a sold listing), 429 too many auth attempts.

## Repository layout

```text
apps/api          Express app: routes/, services/, middleware/, db/ (schema, migrate, seeds), drizzle/
apps/merchant     React app: pages/, api/ (fetch client), components/, e2e/; Dockerfile + nginx config
apps/web          Next.js app: src/app (routes), src/lib (API client, filters), e2e/; Dockerfile
packages/shared   Zod schemas and helpers shared by everything above
docker/           PostgreSQL init script (creates the test database)
.agent/           Project memory for the AI agent that builds this repo: plan, progress log, decisions
```
