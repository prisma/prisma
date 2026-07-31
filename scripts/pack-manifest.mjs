#!/usr/bin/env node
/**
 * Keep private workspace names out of a published tarball's manifest.
 *
 * A publish shell is generated from internal packages, so it declares them as
 * `devDependencies` to make pnpm link them for the build. `pnpm pack` copies
 * every dependency field into the tarball verbatim (rewriting `workspace:` to
 * a plain version on the way), so those entries would ship as
 * `"@prisma-next/cli": "0.16.0"` — a version of a package that is not on the
 * registry at all. Nothing installs them, but they are the manifest a user
 * reads, and pointing that manifest at names that do not exist is exactly what
 * ADR 242 set out to stop.
 *
 * pnpm can override `bin`, `exports` and friends through `publishConfig`, but
 * not dependency fields, so this runs as `prepack`/`postpack` around the pack
 * itself:
 *
 *   "prepack":  "node ../../../../scripts/pack-manifest.mjs --strip"
 *   "postpack": "node ../../../../scripts/pack-manifest.mjs --restore"
 *
 * `--strip` keeps the original bytes in `package.json.pack-backup` and
 * `--restore` puts them back. A run killed between the two leaves the
 * manifest stripped and the backup on disk; the next `--strip` restores
 * before stripping, so packing again repairs it, and `pnpm check:clean-tree`
 * reports it in the meantime rather than letting it pass unnoticed.
 *
 * `scripts/check-publish-deps.mjs` verifies the result on the packed tarball,
 * so a shell that forgets these hooks — or a publish path that skips lifecycle
 * scripts — fails the release rather than shipping the names.
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Scope of the workspace-internal packages that never reach the registry. */
export const PRIVATE_SCOPE = '@prisma-next/';

const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

const BACKUP = 'package.json.pack-backup';

/**
 * The manifest with every `PRIVATE_SCOPE` entry dropped, and any dependency
 * field left empty by that removed. Pure; exported for tests.
 */
export function stripPrivateDeps(manifest) {
  const out = { ...manifest };
  for (const field of DEP_FIELDS) {
    const deps = out[field];
    if (deps === undefined || deps === null || typeof deps !== 'object') continue;
    const kept = Object.fromEntries(
      Object.entries(deps).filter(([name]) => !name.startsWith(PRIVATE_SCOPE)),
    );
    if (Object.keys(kept).length === 0) delete out[field];
    else out[field] = kept;
  }
  return out;
}

export function strip(dir) {
  const manifestPath = join(dir, 'package.json');
  const backupPath = join(dir, BACKUP);
  if (existsSync(backupPath)) writeFileSync(manifestPath, readFileSync(backupPath, 'utf8'));
  const original = readFileSync(manifestPath, 'utf8');
  writeFileSync(backupPath, original);
  const stripped = stripPrivateDeps(JSON.parse(original));
  writeFileSync(manifestPath, `${JSON.stringify(stripped, null, 2)}\n`);
}

export function restore(dir) {
  const backupPath = join(dir, BACKUP);
  if (!existsSync(backupPath)) return;
  writeFileSync(join(dir, 'package.json'), readFileSync(backupPath, 'utf8'));
  rmSync(backupPath);
}

export function main(argv, dir = process.cwd()) {
  if (argv.includes('--strip')) {
    strip(dir);
    return 0;
  }
  if (argv.includes('--restore')) {
    restore(dir);
    return 0;
  }
  process.stderr.write('Usage: pack-manifest.mjs --strip | --restore\n');
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
