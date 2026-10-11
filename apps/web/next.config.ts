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
  poweredByHeader: false,
};

export default nextConfig;
