# Progress log

Newest entries at the bottom. Format: date — step — what was done → next.

- 2026-10-10 — 0.1 — First run: created `work` skill, verifier sub-agent, `CLAUDE.md`, plan and memory → next: 1.1
- 2026-10-10 — 1.1 — Monorepo root: pnpm workspaces, tsconfig.base, .gitignore, .env.example → next: 1.2
- 2026-10-10 — 1.2 — ESLint 10 flat config + typescript-eslint + Prettier; lint and format:check green → next: 1.3
- 2026-10-10 — 1.3 — packages/shared: Zod 4 listing status + pagination schemas, tsc build, vitest → next: 1.4
- 2026-10-10 — 1.4 — apps/api: Express 5 skeleton, Zod-validated config (process.loadEnvFile), /health, 404 + error handler; smoke-tested with curl → next: 1.5
- 2026-10-10 — 1.5 — Drizzle (node-postgres) client + schema: categories (tree), listings, listing_photos → next: 1.6
