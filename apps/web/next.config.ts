import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

const repoRoot = path.resolve(import.meta.dirname, '../..');

// One `.env` at the repo root serves every app (see `.env.example`). Next.js only reads its own
// directory, so load the root file too; variables already set (e.g. by Docker) win.
const rootEnv = path.join(repoRoot, '.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  // Lets Turbopack follow the workspace link to @classifieds/shared.
  turbopack: { root: repoRoot },
  // Self-contained server bundle (`.next/standalone`) for the Docker image, which sets NEXT_OUTPUT;
  // local builds keep the regular output that `next start` serves.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  outputFileTracingRoot: repoRoot,
  poweredByHeader: false,
};

export default nextConfig;
