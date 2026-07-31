// The publish list: every package under `packages/9-public/`.
//
// Publishability is a directory property (ADR 242). `packages/9-public/` holds
// the whole public npm surface — the database facades, the extension packs, the
// platform shells, and the `prisma-next` bin shim — and every other workspace
// package is `"private": true`. Deriving the list from the directory rather
// than from a scan for non-private manifests means a package that lost its
// `private` flag cannot reach the registry by accident; `pnpm lint:publishable`
// is what reports that mistake.
//
// Usage:
//   node scripts/list-publishable-packages.mjs          — space-separated dirs
//   node scripts/list-publishable-packages.mjs --json   — [{ name, dir }, ...]

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The one directory whose packages publish. */
export const PUBLIC_DIR = 'packages/9-public';

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'dist-tsc',
  'dist-tsc-prod',
  'coverage',
  '.tmp-output',
  '.turbo',
  'src-gen',
]);

/**
 * Every package under `packages/9-public/`, as `{ name, dir }` sorted by
 * directory. A `"private": true` manifest in there is a mistake rather than an
 * opt-out, so it is still listed — `pnpm lint:publishable` fails on it.
 *
 * @param {string} [root] directory to resolve `packages/9-public` against
 * @returns {Array<{ name: string, dir: string }>}
 */
export function listPublicPackages(root = '.') {
  const found = [];
  walk(join(root, PUBLIC_DIR), root, found);
  found.sort((a, b) => a.dir.localeCompare(b.dir));
  return found;
}

function walk(dir, root, found) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;

    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path, root, found);
      continue;
    }
    if (entry !== 'package.json') continue;

    const pkg = JSON.parse(readFileSync(path, 'utf8'));
    const rel = dir.startsWith(`${root}/`) ? dir.slice(root.length + 1) : dir;
    found.push({ name: pkg.name, dir: `./${rel}` });
  }
}

if (process.argv[1]?.endsWith('list-publishable-packages.mjs')) {
  const packages = listPublicPackages();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(packages, null, 2));
  } else {
    console.log(packages.map((p) => p.dir).join(' '));
  }
}
