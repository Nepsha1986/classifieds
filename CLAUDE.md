# Classifieds — project guide for Claude

A classifieds board: users register, create listings with categories and photos, search and filter
them. No payments or cart. The focus is solid Node.js backend fundamentals.

**Start every working session with the `work` skill** (`.claude/skills/work/SKILL.md`). It reads
project memory in `.agent/` (PLAN, PROGRESS, DECISIONS), finishes one stage, commits, and stops.

## Layout (pnpm workspaces monorepo)

- `apps/api` — backend: Node.js + Express 5, Drizzle ORM (PostgreSQL), better-auth, Multer, Zod.
- `apps/merchant` — merchant portal: React + Vite. Users manage their own listings.
- `apps/web` — public dashboard: Next.js (SSR) for browsing, search and filters.
- `packages/shared` — shared types and Zod schemas used by the API and both frontends.

## Commands (repo root)

- `pnpm install` — install everything.
- `pnpm lint` / `pnpm format` / `pnpm typecheck` / `pnpm test` — run across all workspaces.
- `pnpm --filter @classifieds/api dev` — run the API in watch mode.
- `pnpm --filter @classifieds/api db:generate` / `db:migrate` / `db:seed` — Drizzle migrations and seed.
- `docker compose up` — full stack (db + api + frontends).

## Environment

- PostgreSQL: `docker compose up -d db`. When Docker isn't available (e.g. cloud sessions), use a local
  cluster: `service postgresql start`, a `classifieds` superuser with password `classifieds`, and the
  databases `classifieds` and `classifieds_test`.
- Cloud sessions can start `dockerd` for image builds; TLS inside builds needs the session CA in a local
  base image (see `.agent/DECISIONS.md` D36). Docker Hub may rate-limit pulls: reuse local images.
- Copy `.env.example` to `.env` (API reads `apps/api/.env` or the root `.env`).

## Conventions

- TypeScript everywhere, ESM, strict mode.
- Request/response validation uses schemas from `@classifieds/shared`; never duplicate them.
- Business rules belong in the API's services, not in route handlers.
- Every step: lint + typecheck + tests green before commit. Commit code and memory together.
- Decisions go to `.agent/DECISIONS.md` with a short rationale.
