#!/usr/bin/env node

/**
 * Copies the user-facing `skills/prisma-8/` tree into the packages that ship
 * it, stamping each copy with the package it now belongs to.
 *
 * Usage: node scripts/sync-package-skills.ts [<package-name>...]
 *
 * Run from each shipping package's `prepack`, so the tarball always carries
 * the skill tree that matches the code beside it. The copies are build
 * output: they are gitignored, and `files` carries them into the tarball.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

export const SKILL_NAME = 'prisma-8';

/**
 * Rewrite the `library` frontmatter stamp to the package the copy ships in.
 * The source tree names one canonical package; each copy names its own, so a
 * consumer reading the copy sees the package it resolved it from.
 */
function stampSkillLibrary(skillMd: string, packageName: string): string {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillMd);
  if (frontmatter === null) throw new Error('SKILL.md has no frontmatter block');
  if (!/^library:/m.test(frontmatter[1])) {
    throw new Error('SKILL.md frontmatter has no library key to stamp');
  }
  const stamped = frontmatter[1].replace(/^library:.*$/m, `library: '${packageName}'`);
  return skillMd.replace(frontmatter[1], stamped);
}

export async function syncPackageSkills(packageName: string): Promise<string> {
  const packageDir = SKILL_ANCHOR_PACKAGES.get(packageName);
  if (packageDir === undefined) {
    const shipping = [...SKILL_ANCHOR_PACKAGES.keys()].join(', ');
    throw new Error(`${packageName} does not ship the ${SKILL_NAME} skill; expected ${shipping}`);
  }

  const source = path.join(rootDir, 'skills', SKILL_NAME);
  const destination = path.join(rootDir, packageDir, 'skills', SKILL_NAME);
  await fs.rm(destination, { recursive: true, force: true });
  await fs.cp(source, destination, { recursive: true });

  const skillMd = path.join(destination, 'SKILL.md');
  await fs.writeFile(skillMd, stampSkillLibrary(await fs.readFile(skillMd, 'utf-8'), packageName));

  return destination;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const requested = process.argv.slice(2);
  const targets = requested.length > 0 ? requested : [...SKILL_ANCHOR_PACKAGES.keys()];
  for (const packageName of targets) {
    const destination = await syncPackageSkills(packageName);
    console.log(`Copied skills/${SKILL_NAME} to ${path.relative(rootDir, destination)}`);
  }
}
