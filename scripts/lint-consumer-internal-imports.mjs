#!/usr/bin/env node
/**
 * Committed high-water-mark thresholds for internal workspace packages in the
 * consumer trees.
 *
 * ADR 242 makes an application depend on exactly one `@prisma/orm-*` facade
 * plus whatever extension packs it installs. The repository's own consumers
 * are the standing proof of that, and they can fall short of it in two ways,
 * so each scope is measured twice:
 *
 *   - **imports** — lines naming an internal `@prisma-next/*` specifier.
 *   - **manifests** — internal packages a consumer declares in its
 *     `package.json` (`dependencies` + `devDependencies`). This is what ADR
 *     242 actually claims: a consumer could import nothing internal and still
 *     list a dozen internal packages, and its install would look nothing like
 *     a real application's.
 *
 * Both counts are compared against numbers recorded in
 * lint-consumer-internal-imports.config.json:
 *
 *   - count > threshold — one was added; fail, and name where.
 *   - count < threshold — the scope improved; fail, and tell the author to
 *     lower the recorded threshold to lock in the reduction.
 *   - count === threshold — pass.
 *
 * There is no git merge-base or temporary worktree involved — the thresholds
 * are numbers checked into the config, so the check works from any checkout
 * (shallow, detached, no origin/main) and the counts may only ever shrink.
 *
 * This is not `lint-single-import-root.mjs`. That one forbids a consumer
 * naming *both* roots at once, which loads two copies of every module they
 * share; it is a correctness check and fails hard with no threshold. This one
 * forbids naming the internal root at all, and ratchets down.
 *
 * Exit codes:
 *   0 — every scope's counts equal its recorded thresholds
 *   1 — at least one count differs from its threshold
 *
 * The script uses process.cwd() as the git root (and reads its config relative
 * to that root) so tests can supply a temporary fixture repo by setting cwd on
 * the child process.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GIT_ROOT = process.cwd();
const CONFIG_PATH = join(GIT_ROOT, 'scripts', 'lint-consumer-internal-imports.config.json');

const INTERNAL_SCOPE = '@prisma-next/';

/**
 * Every form hand-written and generated code uses to name a module: `import …
 * from '<s>'`, a bare side-effect `import '<s>'`, `import('<s>')` in a type
 * position, and `export … from '<s>'`. Both quote styles, so a change of
 * quoting cannot silently empty the scan.
 */
const MODULE_SPECIFIER = /\b(?:from|import)\s*\(?\s*(['"])([^'"\n]+)\1/g;

const SCANNABLE_EXTENSIONS = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

/**
 * Everything a consumer ships or runs counts, including its tests, its vitest
 * and vite configs, and its generated `contract.d.ts` and `migration.ts` —
 * those generated files are exactly what the emitter's import root decides,
 * so excluding them would hide the largest part of the work.
 */
export function isScannableFile(relPath) {
  if (!SCANNABLE_EXTENSIONS.test(relPath)) return false;
  if (/(^|\/)(dist|dist-tsc|dist-tsc-prod|node_modules|coverage|build)\//.test(relPath)) {
    return false;
  }
  return true;
}

/** The internal specifiers one line names, in source order, without duplicates. */
export function internalSpecifiersOnLine(line) {
  const found = [];
  for (const [, , specifier] of line.matchAll(MODULE_SPECIFIER)) {
    if (specifier.startsWith(INTERNAL_SCOPE) && !found.includes(specifier)) found.push(specifier);
  }
  return found;
}

/** One record per line naming at least one internal specifier. */
export function findMatchingLines(content) {
  const out = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const specifiers = internalSpecifiersOnLine(lines[i]);
    if (specifiers.length > 0) out.push({ line: i + 1, specifiers, text: lines[i].trim() });
  }
  return out;
}

export function loadConfig(configPath) {
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();
}

export function scanScope(scanDir, scope) {
  const listing = git(scanDir, 'ls-files', '--', scope.path);
  const files = listing.split('\n').filter(Boolean).filter(isScannableFile);

  const records = [];
  for (const relPath of files) {
    let content;
    try {
      content = readFileSync(join(scanDir, relPath), 'utf-8');
    } catch {
      continue;
    }
    for (const match of findMatchingLines(content)) {
      records.push({ file: relPath, ...match });
    }
  }
  return records;
}

/**
 * `@prisma-next/tsconfig` is excluded: it is a TypeScript config consumed via
 * `extends`, never imported, and it has no published counterpart. Every other
 * internal package in a consumer's manifest is one a real application would
 * not have.
 */
const MANIFEST_EXEMPT = new Set(['@prisma-next/tsconfig']);

const MANIFEST_FIELDS = ['dependencies', 'devDependencies'];

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** One record per internal package a consumer manifest in `scope` declares. */
export function scanManifests(scanDir, scope) {
  const listing = git(scanDir, 'ls-files', '--', scope.path);
  const manifests = listing
    .split('\n')
    .filter(Boolean)
    .filter((relPath) => /(^|\/)package\.json$/.test(relPath))
    .filter((relPath) => !/(^|\/)node_modules\//.test(relPath));

  const records = [];
  for (const relPath of manifests) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(join(scanDir, relPath), 'utf-8'));
    } catch (cause) {
      // Skipping would count every internal package this manifest declares as
      // one fewer, so a manifest broken by an edit would read as progress
      // against the ratchet and lower the recorded baseline.
      throw new Error(`${relPath} could not be read as JSON`, { cause });
    }
    if (!isRecord(parsed)) {
      throw new Error(`${relPath} is valid JSON but not a JSON object`);
    }
    for (const field of MANIFEST_FIELDS) {
      const declared = parsed[field];
      if (!isRecord(declared)) continue;
      for (const name of Object.keys(declared)) {
        if (!name.startsWith(INTERNAL_SCOPE)) continue;
        if (MANIFEST_EXEMPT.has(name)) continue;
        records.push({ file: relPath, field, package: name });
      }
    }
  }
  return records;
}

/** The files a scope's records fall in, worst first, for a legible failure. */
function byFile(records) {
  const counts = new Map();
  for (const record of records) counts.set(record.file, (counts.get(record.file) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

/**
 * Compares one measurement against its recorded threshold, printing the
 * reading and, when they differ, what to do about it. Returns true on failure.
 */
function check({ scope, label, thresholdKey, records, unit, remedy }) {
  const count = records.length;
  const threshold = scope[thresholdKey];

  console.log(
    `lint:consumer-internal-imports: scope=${scope.path} ${label}=${count} threshold=${threshold}`,
  );

  if (count > threshold) {
    console.error(
      `lint:consumer-internal-imports: ${count - threshold} new ${unit} in ${scope.path}.`,
    );
    console.error(`  ${remedy}`);
    for (const [file, fileCount] of byFile(records).slice(0, 10)) {
      console.error(`    ${file} (${fileCount})`);
    }
    console.error(`  Find your additions: git diff origin/main -- ${scope.path}`);
    console.error(
      '  List all current sites: node scripts/lint-consumer-internal-imports.mjs --list',
    );
    console.error(
      `  If genuinely unavoidable, raise "${thresholdKey}" to ${count} in scripts/lint-consumer-internal-imports.config.json with justification in review.`,
    );
    return true;
  }

  if (count < threshold) {
    console.error(
      `lint:consumer-internal-imports: scope=${scope.path} ${label} improved (${count} < ${threshold}).`,
    );
    console.error(
      `  Lower "${thresholdKey}" to ${count} in scripts/lint-consumer-internal-imports.config.json to lock in the reduction.`,
    );
    return true;
  }

  return false;
}

const CONSUMER_RULE =
  'A consumer depends on one @prisma/orm-* facade and its extension packs, nothing else.';

function main() {
  const config = loadConfig(CONFIG_PATH);
  const list = process.argv.slice(2).includes('--list');

  let anyFailed = false;

  for (const scope of config.scopes) {
    const imports = scanScope(GIT_ROOT, scope);
    const manifests = scanManifests(GIT_ROOT, scope);

    anyFailed =
      check({
        scope,
        label: 'imports',
        thresholdKey: 'threshold',
        records: imports,
        unit: 'internal import line(s)',
        remedy: CONSUMER_RULE,
      }) || anyFailed;

    anyFailed =
      check({
        scope,
        label: 'manifest',
        thresholdKey: 'manifestThreshold',
        records: manifests,
        unit: 'internal package(s) declared in a consumer manifest',
        remedy: CONSUMER_RULE,
      }) || anyFailed;

    if (list) {
      for (const record of imports) {
        console.log(`  ${record.file}:${record.line}: ${record.specifiers.join(', ')}`);
      }
      for (const record of manifests) {
        console.log(`  ${record.file} ${record.field}: ${record.package}`);
      }
    }
  }

  if (anyFailed) process.exit(1);
}

if (process.argv[1] === import.meta.filename) main();
