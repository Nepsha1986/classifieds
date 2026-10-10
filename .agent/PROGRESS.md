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
