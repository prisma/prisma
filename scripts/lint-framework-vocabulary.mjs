#!/usr/bin/env node
/**
 * Committed high-water-mark threshold for family/target vocabulary leaking
 * into packages/1-framework.
 *
 * The framework domain is family-blind (no SQL/Mongo/target-specific
 * concepts). Terms like `nativeType` or `postgres` belong to the SQL family
 * and have repeatedly leaked into framework types via review misses.
 *
 * The sites are found by the `no-family-vocabulary` Biome plugin
 * (biome-plugins/no-family-vocabulary.grit), which matches syntax nodes and so
 * never counts comments or JSDoc. This script is only the ratchet: it runs
 * biome over each scope declared in lint-framework-vocabulary.config.json,
 * counts the plugin's diagnostics deduplicated by file and line (two terms on
 * one line, or a term matched by two nested nodes, count once), and compares
 * that count against the `threshold` recorded in the same config:
 *
 *   - count > threshold — new vocabulary was introduced; fail, and tell the
 *     author to remove it.
 *   - count < threshold — the scope improved; fail, and tell the author to
 *     lower the recorded threshold to lock in the reduction.
 *   - count === threshold — pass.
 *
 * There is no git merge-base or temporary worktree involved — the threshold
 * is just a number checked into the config, so the check works from any
 * checkout (shallow, detached, no origin/main) and the count may only ever
 * shrink over time.
 *
 * Exit codes:
 *   0 — every scope's count equals its recorded threshold
 *   1 — at least one scope's count differs from its threshold
 *
 * The script uses process.cwd() as the scan root (and reads its config
 * relative to that root) so tests can supply a temporary fixture repo by
 * setting cwd on the child process.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The real repo root (where the biome binary + config live) — always the
// directory that contains this script's parent, regardless of cwd.
const REAL_REPO_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const BIOME_BIN = join(REAL_REPO_ROOT, 'node_modules', '.bin', 'biome');
const BIOME_CONFIG = join(REAL_REPO_ROOT, 'biome.jsonc');

const SCAN_ROOT = process.cwd();
const CONFIG_PATH = join(SCAN_ROOT, 'scripts', 'lint-framework-vocabulary.config.json');

const MESSAGE_PREFIX = 'no-family-vocabulary: ';

export function filterVocabularyDiags(diagnostics) {
  return diagnostics.filter(
    (d) =>
      d.category === 'plugin' &&
      typeof d.message === 'string' &&
      d.message.startsWith(MESSAGE_PREFIX),
  );
}

// One entry per (file, line): the plugin reports every matching node, so a
// single line yields several diagnostics when it carries several terms or when
// nested nodes both match.
export function dedupeSites(diagnostics) {
  const sites = filterVocabularyDiags(diagnostics).map((d) => {
    const loc = d.location ?? {};
    return `${loc.path ?? ''}:${loc.start?.line ?? 0}`;
  });
  return [...new Set(sites)].sort();
}

export function loadConfig(configPath) {
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

function scanScope(scanDir, scopePath) {
  const result = spawnSync(
    BIOME_BIN,
    ['lint', '--config-path', BIOME_CONFIG, '--reporter=json', scopePath],
    { cwd: scanDir, encoding: 'utf-8', maxBuffer: 400 * 1024 * 1024 },
  );

  if (result.error) {
    throw new Error(`biome spawn failed: ${result.error.message}`);
  }

  const raw = (result.stdout ?? '').trim();
  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `biome JSON parse failed: ${e.message}\nraw output (first 500 chars): ${raw.slice(0, 500)}`,
    );
  }

  return dedupeSites(parsed.diagnostics ?? []);
}

function main() {
  const config = loadConfig(CONFIG_PATH);
  const list = process.argv.slice(2).includes('--list');

  let anyFailed = false;

  for (const scope of config.scopes) {
    const sites = scanScope(SCAN_ROOT, scope.path);
    const count = sites.length;
    const threshold = scope.threshold;

    console.log(
      `lint:framework-vocabulary: scope=${scope.path} count=${count} threshold=${threshold}`,
    );

    if (list) {
      for (const site of sites) {
        console.log(`  ${site}`);
      }
    }

    if (count > threshold) {
      anyFailed = true;
      console.error(
        `lint:framework-vocabulary: ${count - threshold} new family/target-vocabulary line(s) in ${scope.path}.`,
      );
      console.error(
        '  The framework domain is family-blind — move the new SQL/Mongo/target concept out of it.',
      );
      console.error(`  Find your additions: git diff origin/main -- ${scope.path}`);
      console.error('  List all current sites: node scripts/lint-framework-vocabulary.mjs --list');
      console.error('  If a site is genuinely family-blind, suppress it at the line with');
      console.error(
        '  `// biome-ignore lint/plugin/no-family-vocabulary: <why>` and lower the threshold.',
      );
      console.error(
        `  Otherwise raise "threshold" to ${count} in scripts/lint-framework-vocabulary.config.json with justification in review.`,
      );
    } else if (count < threshold) {
      anyFailed = true;
      console.error(
        `lint:framework-vocabulary: scope=${scope.path} improved (count=${count} < threshold=${threshold}).`,
      );
      console.error(
        `  Lower "threshold" to ${count} in scripts/lint-framework-vocabulary.config.json to lock in the reduction.`,
      );
    }
  }

  if (anyFailed) process.exit(1);
}

if (process.argv[1] === import.meta.filename) main();
