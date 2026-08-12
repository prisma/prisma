#!/usr/bin/env node
/**
 * Asserts that the git working tree is clean: no modified tracked files
 * and no untracked files outside `.gitignore`.
 *
 * Intended to run at the end of CI build/test jobs to catch steps that
 * accidentally regenerate tracked artifacts (e.g. a stale `contract.json`)
 * or drop new files in un-gitignored locations.
 *
 * Exits 0 when clean. Exits 1 and prints the offending paths (in
 * `git status --porcelain` format — ` M path`, `?? path`, etc.) otherwise.
 */

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

export function formatDirtyReport(porcelainOutput) {
  if (porcelainOutput.length === 0) return null;
  return [
    'Working tree is not clean after the previous step(s).',
    'A build or test step modified tracked files or created untracked files',
    'that are not in .gitignore. Either commit the regenerated artifacts,',
    'add the new paths to .gitignore, or fix the step that produced them.',
    '',
    porcelainOutput,
  ].join('\n');
}

function main() {
  const output = execFileSync('git', ['status', '--porcelain'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trimEnd();
  const report = formatDirtyReport(output);
  if (report === null) return;
  console.error(report);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
