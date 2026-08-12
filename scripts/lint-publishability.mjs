#!/usr/bin/env node
/**
 * Publishability is a directory property (ADR 242): every package under
 * `packages/9-public/` is publishable, and no package anywhere else is.
 *
 * Both directions are enforced. A publishable package outside `9-public`
 * would ship an internal module the moment the publish workflow iterates
 * publishable packages; a `private: true` package inside `9-public` would
 * silently drop part of the published surface. Neither failure announces
 * itself at build time, which is why this is a lint.
 *
 * Exits 1 listing every violation; exits 0 otherwise.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(import.meta.url), '../..');

export function findPublishabilityViolations(root = repoRoot) {
  const manifests = execFileSync(
    'git',
    [
      'ls-files',
      'packages/*/package.json',
      'packages/*/*/package.json',
      'packages/*/*/*/package.json',
      'packages/*/*/*/*/package.json',
    ],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
    .split('\n')
    .filter(Boolean);

  const violations = [];
  for (const file of manifests) {
    const manifest = JSON.parse(readFileSync(resolve(root, file), 'utf8'));
    const isPublic = file.startsWith('packages/9-public/');
    const isPrivate = manifest.private === true;
    if (isPublic && isPrivate) {
      violations.push({ file, name: manifest.name, rule: 'private-inside-9-public' });
    }
    if (!isPublic && !isPrivate) {
      violations.push({ file, name: manifest.name, rule: 'publishable-outside-9-public' });
    }
  }
  return violations;
}

function main() {
  const violations = findPublishabilityViolations();
  if (violations.length === 0) {
    console.log(
      'Publishability matches the directory layout: packages/9-public/ and nothing else.',
    );
    return 0;
  }
  for (const v of violations) {
    console.error(`${v.file}: ${v.name} — ${v.rule}`);
  }
  console.error(`\nlint-publishability: ${violations.length} violation(s).`);
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
