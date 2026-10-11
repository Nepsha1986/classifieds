// better-auth declares optional peers for every framework it integrates with. pnpm resolves an optional
// peer whenever the workspace has it, so the API's better-auth was wired to Next.js and React (from
// apps/web) and to vitest/drizzle-kit, and `pnpm deploy --prod` shipped them all in the API image.
// The API uses only the core and the Drizzle adapter, so drop the integration peers it never loads.
const UNUSED_BETTER_AUTH_PEERS = ['next', 'react', 'react-dom', 'vitest', 'drizzle-kit'];

function readPackage(pkg) {
  if (pkg.name === 'better-auth') {
    for (const name of UNUSED_BETTER_AUTH_PEERS) {
      delete pkg.peerDependencies?.[name];
      delete pkg.peerDependenciesMeta?.[name];
    }
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
