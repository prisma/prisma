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
 * `--restore` puts them back.
 *
 * A `package.json.pack-lock` beside it makes the pair exclusive, because two
 * processes can pack the same package at once — vitest runs test files in
 * parallel and more than one of them packs the same shell. Without it the
 * second stripper would restore the manifest out from under the first while
 * it was still assembling its tarball. A process killed while holding the
 * lock leaves the manifest stripped and the lock on disk; the next `--strip`
 * times out saying so, and `pnpm check:clean-tree` reports the modified
 * manifest in the meantime rather than letting it pass unnoticed.
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
const LOCK = 'package.json.pack-lock';

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

/** How long to wait for another packer to release the manifest, in ms. */
const LOCK_TIMEOUT_MS = 120_000;
const LOCK_POLL_MS = 50;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Take the manifest, blocking while another pack of the same package holds
 * it. The lock is a separate file from the backup and is created before the
 * manifest is read, so a process killed between the two leaves the manifest
 * untouched rather than backed up mid-strip.
 */
function acquire(lockPath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      writeFileSync(lockPath, `${process.pid}\n`, { flag: 'wx' });
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() > deadline) {
        throw new Error(
          `${lockPath} still exists after ${timeoutMs}ms. Either another pack is ` +
            'stuck, or one was killed while holding it — in which case package.json ' +
            'may still be stripped, and the .pack-backup beside it puts it back.',
        );
      }
      sleepSync(LOCK_POLL_MS);
    }
  }
}

export function strip(dir, { timeoutMs = LOCK_TIMEOUT_MS } = {}) {
  const manifestPath = join(dir, 'package.json');
  acquire(join(dir, LOCK), timeoutMs);
  const original = readFileSync(manifestPath, 'utf8');
  writeFileSync(join(dir, BACKUP), original);
  writeFileSync(
    manifestPath,
    `${JSON.stringify(stripPrivateDeps(JSON.parse(original)), null, 2)}\n`,
  );
}

export function restore(dir) {
  const backupPath = join(dir, BACKUP);
  if (existsSync(backupPath)) {
    writeFileSync(join(dir, 'package.json'), readFileSync(backupPath, 'utf8'));
    rmSync(backupPath, { force: true });
  }
  rmSync(join(dir, LOCK), { force: true });
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
