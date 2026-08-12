#!/usr/bin/env node
/**
 * One-shot migrator: moves a migrations tree from the sibling-snapshot
 * layout (per-package `start-contract.*`/`end-contract.*`, per-space
 * `contract.*`) into the content-addressed `migrations/snapshots/<hex>/`
 * store. See `projects/deduplicate-migration-snapshots/spec.md` D9.
 *
 * For every migration package directory (one containing `migration.json`):
 *   - `end-contract.json`/`.d.ts`, if present, are written into the store
 *     under `migration.json`'s `to` hash.
 *   - `start-contract.json`/`.d.ts`, if present, are written into the
 *     store under `migration.json`'s `from` hash.
 *   - `migration.ts`'s `'./end-contract...'` / `'./start-contract...'`
 *     import specifiers are rewritten to the store's specifiers.
 *   - the four sibling files are deleted.
 *
 * For every space directory (one with a sibling `refs/` directory) that
 * still carries a per-space `contract.json`/`contract.d.ts`: the pair is
 * written into the store under `refs/head.json`'s hash, then deleted.
 *
 * For every `refs/<name>.contract.json` + `refs/<name>.contract.d.ts` pair
 * (written by `ref set` / `--advance-ref` pre-TML-3072): the pair is written
 * into the store under the sibling pointer `refs/<name>.json`'s hash, then
 * deleted. The pointer itself is never written — a ref is now only its
 * pointer file, resolving its contract through the store by hash.
 *
 * Every contract's inner `storage.storageHash` is asserted against the
 * hash it is being filed under before anything is written or deleted —
 * the whole run aborts on the first mismatch, before any root's plan is
 * applied. Every package's `migrationHash` is re-verified unchanged
 * after migration (the migrator never edits `migration.json`/`ops.json`).
 *
 * Uses the production `writeContractSnapshot` / `snapshotsImportPathFrom`
 * (migration-tools) and `contractSnapshotJsonSpecifier` /
 * `contractSnapshotTypesSpecifier` (framework-components) so its output
 * is byte-identical to what `migration plan` / the regen scripts produce.
 *
 * Usage:
 *   node scripts/migrate-migrations-layout.mjs [migrationsRoot...]
 *
 * With no arguments, auto-discovers every migrations root in the repo:
 * every directory literally named `migrations` that has a `migration.json`
 * directly inside one of its subdirectories (shallow extension-repo
 * layout, `<pkg>/migration.json`) or inside a subdirectory of its `app`
 * subdirectory (consumer-project layout, `app/<pkg>/migration.json`).
 *
 * Idempotent-ish: on a tree that is already fully migrated, no sibling
 * files remain to read, so nothing is written, rewritten, or deleted.
 */

import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTRACT_SNAPSHOTS_DIRNAME,
  contractSnapshotJsonSpecifier,
  contractSnapshotTypesSpecifier,
} from '@internal/framework-components/control';
import {
  snapshotsImportPathFrom,
  writeContractSnapshot,
} from '@internal/migration-tools/contract-snapshot-store';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { readMigrationPackage } from '@internal/migration-tools/io';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export class MigrationLayoutAbortError extends Error {}

// ---------------------------------------------------------------------------
// fs helpers
// ---------------------------------------------------------------------------

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

async function listSubdirs(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter((entry) => entry.isDirectory()).map((entry) => join(dir, entry.name));
}

async function readJsonFile(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * True when `dir` directly contains a `migration.json` — the marker of a
 * migration package directory in both the shallow extension-repo layout
 * (`<root>/<pkg>`) and the deep consumer-project layout
 * (`<root>/app/<pkg>`, `<root>/<space>/<pkg>`).
 */
async function isMigrationPackageDir(dir) {
  return pathExists(join(dir, 'migration.json'));
}

const AUTO_DISCOVERY_SKIP_DIRNAMES = new Set([
  'node_modules',
  '.git',
  '.turbo',
  'dist',
  'dist-tsc',
  'dist-tsc-prod',
  'coverage',
  '.cache',
]);

/**
 * True when `dir` (a directory literally named `migrations`) looks like a
 * migrations root: one of its subdirectories has a `migration.json`
 * directly inside it (shallow extension-repo layout), or its `app`
 * subdirectory has a subdirectory with a `migration.json` inside it
 * (consumer-project layout).
 */
async function looksLikeMigrationsRoot(dir) {
  for (const child of await listSubdirs(dir)) {
    if (await isMigrationPackageDir(child)) return true;
  }
  const appDir = join(dir, 'app');
  if (await isDirectory(appDir)) {
    for (const child of await listSubdirs(appDir)) {
      if (await isMigrationPackageDir(child)) return true;
    }
  }
  return false;
}

/**
 * Auto-discover every migrations root under `startDir`: every directory
 * literally named `migrations` that passes {@link looksLikeMigrationsRoot}.
 * Does not descend into a discovered root looking for nested roots.
 */
export async function discoverMigrationsRoots(startDir) {
  const found = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (AUTO_DISCOVERY_SKIP_DIRNAMES.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.name === 'migrations' && (await looksLikeMigrationsRoot(full))) {
        found.push(full);
        continue;
      }
      await walk(full);
    }
  }

  await walk(startDir);
  return found.sort();
}

/**
 * Depth-bounded search for migration package directories under a
 * migrations root: the root itself, its immediate children, and their
 * immediate children. Covers `<root>/<pkg>` (shallow) and
 * `<root>/app/<pkg>` / `<root>/<space>/<pkg>` (deep) without assuming
 * space names. The store directory (`snapshots`) is excluded from
 * descent.
 */
async function findMigrationPackageDirs(root) {
  const level1 = (await listSubdirs(root)).filter(
    (dir) => basename(dir) !== CONTRACT_SNAPSHOTS_DIRNAME,
  );
  const level2 = (await Promise.all(level1.map(listSubdirs))).flat();
  const candidates = [root, ...level1, ...level2];

  const packageDirs = [];
  for (const dir of candidates) {
    if (await isMigrationPackageDir(dir)) packageDirs.push(dir);
  }
  return packageDirs.sort();
}

/**
 * Space directories that still carry a per-space head contract: the
 * migrations root itself and its immediate children (excluding the
 * store), filtered to those with a sibling `refs/` directory and a
 * `contract.json` beside it.
 */
async function findSpaceHeadContractDirs(root) {
  const candidates = [root, ...(await listSubdirs(root))].filter(
    (dir) => basename(dir) !== CONTRACT_SNAPSHOTS_DIRNAME,
  );

  const spaceDirs = [];
  for (const dir of candidates) {
    if (!(await isDirectory(join(dir, 'refs')))) continue;
    if (!(await pathExists(join(dir, 'contract.json')))) continue;
    spaceDirs.push(dir);
  }
  return spaceDirs.sort();
}

/**
 * Every `refs/` directory under a migrations root: the root itself and its
 * immediate children (excluding the store), filtered to those with a `refs/`
 * subdirectory. Same candidate set as {@link findSpaceHeadContractDirs}, but
 * without requiring a sibling `contract.json` — a `refs/` directory can
 * carry ref-paired snapshots independently of a per-space head contract.
 */
async function findRefsDirs(root) {
  const candidates = [root, ...(await listSubdirs(root))].filter(
    (dir) => basename(dir) !== CONTRACT_SNAPSHOTS_DIRNAME,
  );

  const refsDirs = [];
  for (const dir of candidates) {
    const refsDir = join(dir, 'refs');
    if (await isDirectory(refsDir)) refsDirs.push(refsDir);
  }
  return refsDirs.sort();
}

const CONTRACT_JSON_SUFFIX = '.contract.json';

/**
 * Every `<name>.contract.json` file under a `refs/` directory, found
 * recursively (ref names may contain `/`, e.g. `staging/v1`). Returns paths
 * relative to `refsDir`, sorted.
 */
async function findRefContractJsonPaths(refsDir) {
  let entries;
  try {
    entries = await readdir(refsDir, { recursive: true, encoding: 'utf-8' });
  } catch {
    return [];
  }
  return entries.filter((entry) => entry.endsWith(CONTRACT_JSON_SUFFIX)).sort();
}

// ---------------------------------------------------------------------------
// Planning (read-only; throws before anything is written or deleted)
// ---------------------------------------------------------------------------

/**
 * If `<dir>/<baseName>.json` exists, read + parse it and its sibling
 * `.d.ts`, asserting the JSON's inner `storage.storageHash` equals
 * `expectedHash`. Returns `undefined` when the file does not exist (an
 * already-migrated package, or a baseline's absent start side).
 */
async function planContractSide(dir, baseName, expectedHash) {
  const jsonPath = join(dir, `${baseName}.json`);
  if (!(await pathExists(jsonPath))) return undefined;

  const contractJson = await readJsonFile(jsonPath);
  const actualHash = contractJson?.storage?.storageHash;
  if (actualHash !== expectedHash) {
    throw new MigrationLayoutAbortError(
      `${jsonPath}: inner storage.storageHash "${actualHash}" does not match the recorded hash ` +
        `"${expectedHash}". Aborting before writing or deleting anything.`,
    );
  }

  const dtsPath = join(dir, `${baseName}.d.ts`);
  if (!(await pathExists(dtsPath))) {
    throw new MigrationLayoutAbortError(
      `${jsonPath} exists but ${dtsPath} does not. Aborting before writing or deleting anything.`,
    );
  }
  const contractDts = await readFile(dtsPath, 'utf8');

  return { contractJson, contractDts };
}

/**
 * Replace the exact quoted `'./end-contract...'` / `'./start-contract...'`
 * specifiers in a `migration.ts` source with the store's specifiers. Pure
 * string replacement — no AST parsing, matching how the renderers emit
 * these files (uniform, biome-formatted, single-quoted).
 */
export function rewriteImportSpecifiers(source, { snapshotsImportPath, toHash, fromHash }) {
  let updated = source
    .replaceAll(
      `'./end-contract.json'`,
      `'${contractSnapshotJsonSpecifier(snapshotsImportPath, toHash)}'`,
    )
    .replaceAll(
      `'./end-contract'`,
      `'${contractSnapshotTypesSpecifier(snapshotsImportPath, toHash)}'`,
    );

  if (fromHash !== null) {
    updated = updated
      .replaceAll(
        `'./start-contract.json'`,
        `'${contractSnapshotJsonSpecifier(snapshotsImportPath, fromHash)}'`,
      )
      .replaceAll(
        `'./start-contract'`,
        `'${contractSnapshotTypesSpecifier(snapshotsImportPath, fromHash)}'`,
      );
  }

  return updated;
}

async function planPackageDir(root, dir) {
  const pkg = await readMigrationPackage(dir, { migrationsDir: root });
  const { metadata, ops } = pkg;

  const migrationJsonBefore = await readFile(join(dir, 'migration.json'), 'utf8');
  const opsJsonBefore = await readFile(join(dir, 'ops.json'), 'utf8');

  const toSnapshot = await planContractSide(dir, 'end-contract', metadata.to);
  const fromSnapshot =
    metadata.from === null
      ? undefined
      : await planContractSide(dir, 'start-contract', metadata.from);

  // Materialised extension packages inside a consumer project's space
  // directory (`<space>/<pkg-dir>/`) carry only `migration.json` +
  // `ops.json` — no `migration.ts` of their own (it lives in the
  // extension's source repo). Nothing to rewrite in that case.
  const migrationTsPath = join(dir, 'migration.ts');
  const hasMigrationTs = await pathExists(migrationTsPath);
  const migrationTsBefore = hasMigrationTs ? await readFile(migrationTsPath, 'utf8') : undefined;
  const snapshotsImportPath = snapshotsImportPathFrom(dir, root);
  const migrationTsAfter = hasMigrationTs
    ? rewriteImportSpecifiers(migrationTsBefore, {
        snapshotsImportPath,
        toHash: metadata.to,
        fromHash: metadata.from,
      })
    : undefined;

  const filesToDelete = [];
  if (toSnapshot !== undefined) {
    filesToDelete.push(join(dir, 'end-contract.json'), join(dir, 'end-contract.d.ts'));
  }
  if (fromSnapshot !== undefined) {
    filesToDelete.push(join(dir, 'start-contract.json'), join(dir, 'start-contract.d.ts'));
  }

  return {
    dir,
    metadata,
    ops,
    migrationJsonBefore,
    opsJsonBefore,
    toSnapshot,
    fromSnapshot,
    migrationTsPath,
    migrationTsBefore,
    migrationTsAfter,
    filesToDelete,
  };
}

async function planSpaceDir(dir) {
  const headRefPath = join(dir, 'refs', 'head.json');
  const headRefBefore = await readFile(headRefPath, 'utf8');
  const hash = JSON.parse(headRefBefore).hash;

  const jsonPath = join(dir, 'contract.json');
  const contractJson = await readJsonFile(jsonPath);
  const actualHash = contractJson?.storage?.storageHash;
  if (actualHash !== hash) {
    throw new MigrationLayoutAbortError(
      `${jsonPath}: inner storage.storageHash "${actualHash}" does not match refs/head.json's hash ` +
        `"${hash}". Aborting before writing or deleting anything.`,
    );
  }

  const dtsPath = join(dir, 'contract.d.ts');
  if (!(await pathExists(dtsPath))) {
    throw new MigrationLayoutAbortError(
      `${jsonPath} exists but ${dtsPath} does not. Aborting before writing or deleting anything.`,
    );
  }
  const contractDts = await readFile(dtsPath, 'utf8');

  return {
    dir,
    headRefPath,
    headRefBefore,
    hash,
    contractJson,
    contractDts,
    filesToDelete: [jsonPath, dtsPath],
  };
}

/**
 * Plan one ref-paired snapshot: `refsDir/<name>.contract.json` (found at
 * `contractJsonRelPath`, relative to `refsDir`) plus its sibling
 * `refsDir/<name>.contract.d.ts`. A `.contract.json` with no sibling pointer
 * (`refsDir/<name>.json`) is an abort-worthy inconsistency — it can't be
 * filed under any hash. The pointer's `hash` is asserted against the
 * contract's inner `storage.storageHash`, same style as
 * {@link planContractSide} / {@link planSpaceDir}. The pointer is read but
 * never written by this migrator — folding leaves it byte-identical.
 */
async function planRefPair(refsDir, contractJsonRelPath) {
  const name = contractJsonRelPath.slice(0, -CONTRACT_JSON_SUFFIX.length);
  const contractJsonPath = join(refsDir, contractJsonRelPath);
  const pointerPath = join(refsDir, `${name}.json`);

  if (!(await pathExists(pointerPath))) {
    throw new MigrationLayoutAbortError(
      `${contractJsonPath} exists but its pointer ${pointerPath} does not. ` +
        'Aborting before writing or deleting anything.',
    );
  }
  const pointerBefore = await readFile(pointerPath, 'utf8');
  const hash = JSON.parse(pointerBefore).hash;

  const contractJson = await readJsonFile(contractJsonPath);
  const actualHash = contractJson?.storage?.storageHash;
  if (actualHash !== hash) {
    throw new MigrationLayoutAbortError(
      `${contractJsonPath}: inner storage.storageHash "${actualHash}" does not match ` +
        `${pointerPath}'s hash "${hash}". Aborting before writing or deleting anything.`,
    );
  }

  const dtsPath = join(refsDir, `${name}.contract.d.ts`);
  if (!(await pathExists(dtsPath))) {
    throw new MigrationLayoutAbortError(
      `${contractJsonPath} exists but ${dtsPath} does not. ` +
        'Aborting before writing or deleting anything.',
    );
  }
  const contractDts = await readFile(dtsPath, 'utf8');

  return {
    pointerPath,
    pointerBefore,
    hash,
    contractJson,
    contractDts,
    filesToDelete: [contractJsonPath, dtsPath],
  };
}

/**
 * Build the full plan for one migrations root: read every package, space,
 * and ref-paired snapshot, asserting every inner hash against the value it
 * is recorded under. Throws {@link MigrationLayoutAbortError} (or lets a
 * production `readMigrationPackage` error propagate) on the first
 * inconsistency — nothing is written or deleted while planning.
 */
export async function planMigrationsRoot(root) {
  const packageDirs = await findMigrationPackageDirs(root);
  const spaceDirs = await findSpaceHeadContractDirs(root);
  const refsDirs = await findRefsDirs(root);

  const packages = [];
  for (const dir of packageDirs) {
    packages.push(await planPackageDir(root, dir));
  }
  const spaces = [];
  for (const dir of spaceDirs) {
    spaces.push(await planSpaceDir(dir));
  }
  const refs = [];
  for (const refsDir of refsDirs) {
    for (const contractJsonRelPath of await findRefContractJsonPaths(refsDir)) {
      refs.push(await planRefPair(refsDir, contractJsonRelPath));
    }
  }

  return { root, packages, spaces, refs };
}

// ---------------------------------------------------------------------------
// Applying (writes, rewrites, deletes; only reached once every root's plan
// has been built without error)
// ---------------------------------------------------------------------------

function emptySummary(root) {
  return {
    root,
    packagesProcessed: 0,
    spacesProcessed: 0,
    refsProcessed: 0,
    storeEntriesWritten: 0,
    storeEntriesAlreadyPresent: 0,
    filesDeleted: 0,
    migrationHashesVerified: 0,
  };
}

export async function applyMigrationsRootPlan(plan) {
  const { root } = plan;
  const summary = emptySummary(root);

  for (const pkg of plan.packages) {
    if (pkg.toSnapshot !== undefined) {
      const { written } = await writeContractSnapshot(root, pkg.metadata.to, pkg.toSnapshot);
      written ? summary.storeEntriesWritten++ : summary.storeEntriesAlreadyPresent++;
    }
    if (pkg.fromSnapshot !== undefined) {
      const { written } = await writeContractSnapshot(root, pkg.metadata.from, pkg.fromSnapshot);
      written ? summary.storeEntriesWritten++ : summary.storeEntriesAlreadyPresent++;
    }
    if (pkg.migrationTsAfter !== pkg.migrationTsBefore) {
      await writeFile(pkg.migrationTsPath, pkg.migrationTsAfter, 'utf8');
    }
    for (const file of pkg.filesToDelete) {
      await rm(file);
      summary.filesDeleted++;
    }

    const migrationJsonAfter = await readFile(join(pkg.dir, 'migration.json'), 'utf8');
    if (migrationJsonAfter !== pkg.migrationJsonBefore) {
      throw new MigrationLayoutAbortError(
        `${join(pkg.dir, 'migration.json')} changed during migration; the migrator never writes this file.`,
      );
    }
    const opsJsonAfter = await readFile(join(pkg.dir, 'ops.json'), 'utf8');
    if (opsJsonAfter !== pkg.opsJsonBefore) {
      throw new MigrationLayoutAbortError(
        `${join(pkg.dir, 'ops.json')} changed during migration; the migrator never writes this file.`,
      );
    }
    const recomputedHash = computeMigrationHash(
      JSON.parse(migrationJsonAfter),
      JSON.parse(opsJsonAfter),
    );
    if (recomputedHash !== pkg.metadata.migrationHash) {
      throw new MigrationLayoutAbortError(
        `${pkg.dir}: recomputed migrationHash "${recomputedHash}" no longer matches the stored ` +
          `"${pkg.metadata.migrationHash}" after migration.`,
      );
    }

    summary.migrationHashesVerified++;
    summary.packagesProcessed++;
  }

  for (const space of plan.spaces) {
    const { written } = await writeContractSnapshot(root, space.hash, {
      contractJson: space.contractJson,
      contractDts: space.contractDts,
    });
    written ? summary.storeEntriesWritten++ : summary.storeEntriesAlreadyPresent++;

    for (const file of space.filesToDelete) {
      await rm(file);
      summary.filesDeleted++;
    }

    const headRefAfter = await readFile(space.headRefPath, 'utf8');
    if (headRefAfter !== space.headRefBefore) {
      throw new MigrationLayoutAbortError(
        `${space.headRefPath} changed during migration; the migrator never writes this file.`,
      );
    }

    summary.spacesProcessed++;
  }

  for (const ref of plan.refs) {
    const { written } = await writeContractSnapshot(root, ref.hash, {
      contractJson: ref.contractJson,
      contractDts: ref.contractDts,
    });
    written ? summary.storeEntriesWritten++ : summary.storeEntriesAlreadyPresent++;

    for (const file of ref.filesToDelete) {
      await rm(file);
      summary.filesDeleted++;
    }

    const pointerAfter = await readFile(ref.pointerPath, 'utf8');
    if (pointerAfter !== ref.pointerBefore) {
      throw new MigrationLayoutAbortError(
        `${ref.pointerPath} changed during migration; the migrator never writes this file.`,
      );
    }

    summary.refsProcessed++;
  }

  return summary;
}

/**
 * Plan every root first (read-only), then apply every plan. A hash
 * mismatch anywhere — in any package or space, in any root — throws
 * before any root's plan is applied, so a multi-root invocation either
 * migrates everything or deletes/writes nothing at all.
 */
export async function migrateMigrationsRoots(roots) {
  const plans = [];
  for (const root of roots) {
    plans.push(await planMigrationsRoot(root));
  }

  const summaries = [];
  for (const plan of plans) {
    summaries.push(await applyMigrationsRootPlan(plan));
  }
  return summaries;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function relativeToRepoRoot(path) {
  return path.startsWith(`${repoRoot}/`) ? path.slice(repoRoot.length + 1) : path;
}

export function formatSummary(summaries) {
  const lines = [`migrate-migrations-layout: processed ${summaries.length} root(s)`, ''];
  const totals = { written: 0, present: 0, deleted: 0, verified: 0 };

  for (const s of summaries) {
    lines.push(`  ${relativeToRepoRoot(s.root)}`);
    lines.push(
      `    packages: ${s.packagesProcessed}  spaces: ${s.spacesProcessed}  ` +
        `refs: ${s.refsProcessed}  ` +
        `store writes: ${s.storeEntriesWritten} (${s.storeEntriesAlreadyPresent} already present)  ` +
        `files deleted: ${s.filesDeleted}  migrationHash verified: ${s.migrationHashesVerified}`,
    );
    totals.written += s.storeEntriesWritten;
    totals.present += s.storeEntriesAlreadyPresent;
    totals.deleted += s.filesDeleted;
    totals.verified += s.migrationHashesVerified;
  }

  lines.push('');
  lines.push(
    `TOTAL: ${summaries.length} root(s), ${totals.written} store writes ` +
      `(${totals.present} already present), ${totals.deleted} files deleted, ` +
      `${totals.verified} migrationHash verifications passed`,
  );
  return lines.join('\n');
}

export async function main(argv) {
  const args = argv.slice(2);
  const roots =
    args.length > 0
      ? args.map((arg) => resolve(process.cwd(), arg))
      : await discoverMigrationsRoots(repoRoot);

  if (roots.length === 0) {
    process.stdout.write('migrate-migrations-layout: no migrations roots found\n');
    return;
  }

  const summaries = await migrateMigrationsRoots(roots);
  process.stdout.write(`${formatSummary(summaries)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
