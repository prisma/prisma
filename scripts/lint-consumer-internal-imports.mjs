#!/usr/bin/env node
/**
 * Committed high-water-mark threshold for internal workspace imports in the
 * consumer trees.
 *
 * ADR 242 makes an application depend on exactly one `@prisma/orm-*` facade
 * plus whatever extension packs it installs. The repository's own consumers —
 * `examples/`, `apps/`, `test/` — are the standing proof of that: every
 * `@prisma-next/*` specifier one of them still names is a place where the
 * published surface is not yet what a real user gets. The target is zero.
 *
 * Counts lines naming an internal specifier (textual scan, not a compiler
 * diagnostic) at HEAD, per scope declared in
 * lint-consumer-internal-imports.config.json, and compares the count against a
 * `threshold` recorded in that same config:
 *
 *   - count > threshold — an internal import was added; fail, and name the
 *     files it was added to.
 *   - count < threshold — the scope improved; fail, and tell the author to
 *     lower the recorded threshold to lock in the reduction.
 *   - count === threshold — pass.
 *
 * There is no git merge-base or temporary worktree involved — the threshold is
 * just a number checked into the config, so the check works from any checkout
 * (shallow, detached, no origin/main) and the count may only ever shrink.
 *
 * This is not `lint-single-import-root.mjs`. That one forbids a consumer
 * naming *both* roots at once, which loads two copies of every module they
 * share; it is a correctness check and fails hard with no threshold. This one
 * forbids naming the internal root at all, and ratchets down to zero.
 *
 * Exit codes:
 *   0 — every scope's count equals its recorded threshold
 *   1 — at least one scope's count differs from its threshold
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

/** The files a scope's records fall in, worst first, for a legible failure. */
function byFile(records) {
  const counts = new Map();
  for (const record of records) counts.set(record.file, (counts.get(record.file) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

function main() {
  const config = loadConfig(CONFIG_PATH);
  const list = process.argv.slice(2).includes('--list');

  let anyFailed = false;

  for (const scope of config.scopes) {
    const records = scanScope(GIT_ROOT, scope);
    const count = records.length;
    const threshold = scope.threshold;

    console.log(
      `lint:consumer-internal-imports: scope=${scope.path} count=${count} threshold=${threshold}`,
    );

    if (list) {
      for (const record of records) {
        console.log(`  ${record.file}:${record.line}: ${record.specifiers.join(', ')}`);
      }
    }

    if (count > threshold) {
      anyFailed = true;
      console.error(
        `lint:consumer-internal-imports: ${count - threshold} new internal import line(s) in ${scope.path}.`,
      );
      console.error(
        '  A consumer depends on one @prisma/orm-* facade and its extension packs, nothing else.',
      );
      for (const [file, fileCount] of byFile(records).slice(0, 10)) {
        console.error(`    ${file} (${fileCount})`);
      }
      console.error(`  Find your additions: git diff origin/main -- ${scope.path}`);
      console.error(
        '  List all current sites: node scripts/lint-consumer-internal-imports.mjs --list',
      );
      console.error(
        `  If genuinely unavoidable, raise "threshold" to ${count} in scripts/lint-consumer-internal-imports.config.json with justification in review.`,
      );
    } else if (count < threshold) {
      anyFailed = true;
      console.error(
        `lint:consumer-internal-imports: scope=${scope.path} improved (count=${count} < threshold=${threshold}).`,
      );
      console.error(
        `  Lower "threshold" to ${count} in scripts/lint-consumer-internal-imports.config.json to lock in the reduction.`,
      );
    }
  }

  if (anyFailed) process.exit(1);
}

if (process.argv[1] === import.meta.filename) main();
