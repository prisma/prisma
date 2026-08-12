#!/usr/bin/env node
/**
 * Committed high-water-mark threshold for family/target vocabulary leaking
 * into packages/1-framework.
 *
 * The framework domain is family-blind (no SQL/Mongo/target-specific
 * concepts). Terms like `nativeType` or `postgres` belong to the SQL family
 * and have repeatedly leaked into framework types via review misses.
 *
 * Counts forbidden-term occurrences (identifier-token matching, not a
 * compiler diagnostic) at HEAD, per scope declared in
 * lint-framework-vocabulary.config.json, and compares the count against a
 * `threshold` recorded in that same config:
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
 * False positives are silenced per line, not by raising the threshold. A
 * `framework-vocabulary-ignore: <reason>` comment exempts the line it sits on
 * and the line directly below it, so it works trailing or on its own line:
 *
 *   // framework-vocabulary-ignore: the engine's table block, terminal output
 *   return { kind: 'table', columns: headings, rows };
 *
 * The reason is required — a bare marker does not suppress. The marker line
 * is itself never counted, so the reason text may name forbidden terms.
 * Suppressed lines drop out of the count, which lowers it below the
 * threshold; lower the recorded threshold to match, exactly as for a real
 * removal. This is deliberately not a biome plugin: over half of what the
 * check catches lives in comments and JSDoc, which biome's GritQL cannot
 * match, and biome suppresses plugin diagnostics only via an unaimed
 * `// biome-ignore lint:` that would also mask no-bare-cast and no-bare-throw
 * on the same line.
 *
 * Exit codes:
 *   0 — every scope's count equals its recorded threshold
 *   1 — at least one scope's count differs from its threshold
 *
 * The script uses process.cwd() as the git root (and reads its config
 * relative to that root) so tests can supply a temporary fixture repo by
 * setting cwd on the child process.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GIT_ROOT = process.cwd();
const CONFIG_PATH = join(GIT_ROOT, 'scripts', 'lint-framework-vocabulary.config.json');

export function isScannableFile(relPath) {
  if (!/\.(ts|tsx)$/.test(relPath)) return false;
  if (/\.test\.tsx?$/.test(relPath)) return false;
  if (/\.test-d\.tsx?$/.test(relPath)) return false;
  if (/(^|\/)test\//.test(relPath)) return false;
  if (/(^|\/)dist\//.test(relPath)) return false;
  return true;
}

// Split a line into lowercase identifier tokens: break camelCase/digit→upper humps, split on non-alphanumerics.
export function tokenize(line) {
  return line
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase());
}

export function termTokens(term) {
  return tokenize(term);
}

// A line token matches a term token if equal, or equal with a trailing plural 's'.
function tokenMatches(lineToken, termToken) {
  return lineToken === termToken || lineToken === `${termToken}s`;
}

// Every [start, end) token range where the term's token sequence appears as a
// consecutive subsequence of the line's tokens (end exclusive).
export function termMatchRanges(lineTokens, tt) {
  const ranges = [];
  for (let i = 0; i + tt.length <= lineTokens.length; i++) {
    let ok = true;
    for (let j = 0; j < tt.length; j++) {
      if (!tokenMatches(lineTokens[i + j], tt[j])) {
        ok = false;
        break;
      }
    }
    if (ok) ranges.push([i, i + tt.length]);
  }
  return ranges;
}

// True if the term's token sequence appears as a consecutive subsequence of the line's tokens.
export function lineMatchesTermTokens(lineTokens, tt) {
  return termMatchRanges(lineTokens, tt).length > 0;
}

// Distinct matching lines. Each returned entry is one line (counted once even if several terms match it).
//
// An optional `scope.allow` lists framework-neutral compound terms (e.g. `SymbolTable`).
// A forbidden-term occurrence is shielded — and does not count — when its matched token
// range is fully contained within a single allowed compound's range on the same line. This
// lets `SymbolTable`/`symbol-table` stop matching the bare `table` term while a bare `table`
// elsewhere on the line (or file) still counts. Absent/empty `allow` ⇒ unchanged behaviour.
const IGNORE_MARKER = /framework-vocabulary-ignore:[ \t]*\S/;

export function hasIgnoreMarker(line) {
  return line !== undefined && IGNORE_MARKER.test(line);
}

export function partitionMatchingLines(content, scope) {
  const termSeqs = scope.forbidden.map(termTokens);
  const allowSeqs = (scope.allow ?? []).map(termTokens);
  const counted = [];
  const suppressed = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const lineTokens = tokenize(lines[i]);
    const allowRanges = allowSeqs.flatMap((tt) => termMatchRanges(lineTokens, tt));
    const matched = [];
    for (let k = 0; k < termSeqs.length; k++) {
      const ranges = termMatchRanges(lineTokens, termSeqs[k]);
      const hasUnshielded = ranges.some(
        (r) => !allowRanges.some((a) => a[0] <= r[0] && r[1] <= a[1]),
      );
      if (hasUnshielded) matched.push(scope.forbidden[k]);
    }
    if (matched.length === 0) continue;
    const record = { line: i + 1, terms: matched, text: lines[i].trim() };
    const exempt = hasIgnoreMarker(lines[i]) || hasIgnoreMarker(lines[i - 1]);
    (exempt ? suppressed : counted).push(record);
  }
  return { counted, suppressed };
}

export function findMatchingLines(content, scope) {
  return partitionMatchingLines(content, scope).counted;
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
  const suppressed = [];
  for (const relPath of files) {
    let content;
    try {
      content = readFileSync(join(scanDir, relPath), 'utf-8');
    } catch {
      continue;
    }
    const partitioned = partitionMatchingLines(content, scope);
    for (const match of partitioned.counted) records.push({ file: relPath, ...match });
    for (const match of partitioned.suppressed) suppressed.push({ file: relPath, ...match });
  }
  return { records, suppressed };
}

function main() {
  const config = loadConfig(CONFIG_PATH);
  const list = process.argv.slice(2).includes('--list');

  let anyFailed = false;

  for (const scope of config.scopes) {
    const { records, suppressed } = scanScope(GIT_ROOT, scope);
    const count = records.length;
    const threshold = scope.threshold;

    console.log(
      `lint:framework-vocabulary: scope=${scope.path} count=${count} threshold=${threshold} suppressed=${suppressed.length}`,
    );

    if (list) {
      for (const record of records) {
        console.log(`  ${record.file}:${record.line}: [${record.terms.join(', ')}] ${record.text}`);
      }
      for (const record of suppressed) {
        console.log(
          `  (ignored) ${record.file}:${record.line}: [${record.terms.join(', ')}] ${record.text}`,
        );
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
      console.error(
        `  If genuinely unavoidable, raise "threshold" to ${count} in scripts/lint-framework-vocabulary.config.json with justification in review.`,
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
