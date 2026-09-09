#!/usr/bin/env node

/**
 * Copies the user-facing `skills/prisma-orm-*` trees into the packages that
 * ship them, stamping each copy with the package it now belongs to.
 *
 * Usage: node scripts/sync-package-skills.ts [<package-name>...]
 *
 * Run from each shipping package's `prepack`, so the tarball always carries
 * the skill trees that match the code beside it. The copies are build
 * output: they are gitignored, and `files` carries them into the tarball.
 *
 * This assumes a single writer per package, which holds for every real pack:
 * a publish packs each package once, into its own directory. Only the tarball
 * test suites pack one package concurrently, and they serialise those packs
 * themselves (see `packShell` in `packages/0-config/tsdown/shell-testkit.ts`).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stampSkillMetadata } from './set-version-utils.ts';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * The packages the skill ships in: the three targets an application depends
 * on directly. Shipping from the direct dependencies is what lets a consumer's
 * `prisma skills sync` resolve the skill by package name instead of searching
 * `node_modules` for skill files.
 */
export const SKILL_ANCHOR_PACKAGES: ReadonlyMap<string, string> = new Map([
  ['@prisma/orm-postgres', 'packages/9-public/@prisma/orm-postgres'],
  ['@prisma/orm-sqlite', 'packages/9-public/@prisma/orm-sqlite'],
  ['@prisma/orm-mongo', 'packages/9-public/@prisma/orm-mongo'],
]);

export const SKILL_NAMES = ['prisma-orm-core-concepts', 'prisma-orm-migrations'] as const;

export async function syncPackageSkills(packageName: string): Promise<readonly string[]> {
  const packageDir = SKILL_ANCHOR_PACKAGES.get(packageName);
  if (packageDir === undefined) {
    const shipping = [...SKILL_ANCHOR_PACKAGES.keys()].join(', ');
    throw new Error(
      `Unknown skill-anchor package "${packageName}"; the skills ship only from ${shipping}`,
    );
  }

  const skillsDir = path.join(rootDir, packageDir, 'skills');
  const destinations: string[] = [];
  for (const skillName of SKILL_NAMES) {
    const source = path.join(rootDir, 'skills', skillName);
    const destination = path.join(skillsDir, skillName);
    await fs.rm(destination, { recursive: true, force: true });
    await fs.cp(source, destination, { recursive: true });

    // The source tree names one canonical package; each copy names its own,
    // so a consumer reading the copy sees the package it resolved it from.
    const skillMd = path.join(destination, 'SKILL.md');
    await fs.writeFile(
      skillMd,
      stampSkillMetadata(await fs.readFile(skillMd, 'utf-8'), 'library', packageName),
    );
    destinations.push(destination);
  }

  return destinations;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const requested = process.argv.slice(2);
  const targets = requested.length > 0 ? requested : [...SKILL_ANCHOR_PACKAGES.keys()];
  for (const packageName of targets) {
    for (const destination of await syncPackageSkills(packageName)) {
      console.log(`Copied ${path.relative(rootDir, destination)}`);
    }
  }
}
