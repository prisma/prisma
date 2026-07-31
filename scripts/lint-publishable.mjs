#!/usr/bin/env node
/**
 * Publishability is a directory property (ADR 242).
 *
 * `packages/9-public/` holds the public npm surface and nothing else may
 * publish. This lint checks both directions, because each failure mode is
 * silent in the opposite way:
 *
 * - A package outside `packages/9-public/` without `"private": true` is a
 *   package the registry would carry under a name we do not intend to
 *   support. Nothing else notices: it builds, it tests, and the first
 *   evidence is an npm entry that is then breaking to remove.
 * - A package inside `packages/9-public/` with `"private": true` drops out
 *   of the release. The publish still succeeds, so the only evidence is an
 *   install that cannot resolve a name the rest of the surface points at.
 *
 * Scope is the whole workspace, not just `packages/`: `apps/`, `examples/`
 * and `test/` hold packages too, and they are equally publishable by
 * accident.
 *
 * Exits 1 listing every offender; exits 0 otherwise.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PUBLIC_DIR } from './list-publishable-packages.mjs';

const EXCLUDED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'dist-tsc',
  'dist-tsc-prod',
  'coverage',
  '.tmp-output',
  '.next',
  '.turbo',
  '.git',
  'src-gen',
  'build',
]);

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function* walkPackages(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  if (entries.includes('package.json')) yield dir;
  for (const entry of entries) {
    if (EXCLUDED_DIRECTORIES.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walkPackages(full);
  }
}

/**
 * Every workspace package whose `private` flag disagrees with where it sits,
 * as `{ dir, kind }` where `kind` is `'publishable-outside'` or
 * `'private-inside'`. The repository root manifest is the workspace itself,
 * not a package, and is skipped.
 *
 * Takes `baseDir` so a test can run the check against a tree it built itself.
 */
export function findPublishabilityViolations(baseDir) {
  const violations = [];
  for (const dir of walkPackages(baseDir)) {
    if (dir === baseDir) continue;
    const rel = relative(baseDir, dir);
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    } catch {
      continue;
    }
    if (typeof manifest.name !== 'string') continue;
    const inPublicDir = rel === PUBLIC_DIR || rel.startsWith(`${PUBLIC_DIR}/`);
    const isPrivate = manifest.private === true;
    if (!inPublicDir && !isPrivate) {
      violations.push({ dir: rel, name: manifest.name, kind: 'publishable-outside' });
    } else if (inPublicDir && isPrivate) {
      violations.push({ dir: rel, name: manifest.name, kind: 'private-inside' });
    }
  }
  violations.sort((a, b) => a.dir.localeCompare(b.dir));
  return violations;
}

export function main(baseDir = repoRoot) {
  const violations = findPublishabilityViolations(baseDir);
  if (violations.length === 0) {
    console.log(`Publishability matches the directory: only ${PUBLIC_DIR}/ publishes.`);
    return 0;
  }

  const outside = violations.filter((v) => v.kind === 'publishable-outside');
  const inside = violations.filter((v) => v.kind === 'private-inside');

  if (outside.length > 0) {
    console.error(`${outside.length} package(s) outside ${PUBLIC_DIR}/ would publish:`);
    for (const v of outside) console.error(`  ${v.name}  (${v.dir})`);
    console.error(
      `\nAdd "private": true. A package that belongs on npm moves under ${PUBLIC_DIR}/,\n` +
        'as a shell entrypoint of an existing published package rather than a name of\n' +
        'its own (ADR 242) unless the published surface is deliberately growing.',
    );
  }
  if (inside.length > 0) {
    if (outside.length > 0) console.error('');
    console.error(`${inside.length} package(s) inside ${PUBLIC_DIR}/ are private:`);
    for (const v of inside) console.error(`  ${v.name}  (${v.dir})`);
    console.error(
      `\nEverything under ${PUBLIC_DIR}/ is part of the published surface. Remove\n` +
        '"private": true, or move the package out of the directory.',
    );
  }
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv[2]));
}
