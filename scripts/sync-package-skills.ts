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
 *
 * Several packs of the same package can run at once (test files pack the
 * shells in parallel), so the sync builds the copy in a scratch directory and
 * renames it into place. A copy that already matches is left untouched.
 */

import { randomUUID } from 'node:crypto';
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

export const SKILL_NAME = 'prisma-8';

export interface SkillTreeSync {
  readonly source: string;
  /** `<package>/skills/<skill>`; scratch directories are created beside `skills/`. */
  readonly destination: string;
  readonly packageName: string;
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}

async function filesUnder(dir: string): Promise<readonly string[]> {
  const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)))
    .sort();
}

async function treesMatch(left: string, right: string): Promise<boolean> {
  let leftFiles: readonly string[];
  let rightFiles: readonly string[];
  try {
    [leftFiles, rightFiles] = await Promise.all([filesUnder(left), filesUnder(right)]);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return false;
    throw error;
  }
  if (leftFiles.length !== rightFiles.length) return false;
  if (leftFiles.some((file, index) => file !== rightFiles[index])) return false;
  for (const file of leftFiles) {
    const [a, b] = await Promise.all([
      fs.readFile(path.join(left, file)),
      fs.readFile(path.join(right, file)),
    ]);
    if (!a.equals(b)) return false;
  }
  return true;
}

function scratchPath(destination: string, purpose: string): string {
  const packageDir = path.dirname(path.dirname(destination));
  return path.join(packageDir, `.${path.basename(destination)}-${purpose}-${randomUUID()}`);
}

/** Moves the fresh copy into place; another sync winning the race is not an error. */
async function installTree(staging: string, destination: string): Promise<void> {
  const retired = scratchPath(destination, 'retired');
  try {
    await fs.rename(destination, retired);
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error;
  }
  try {
    await fs.rename(staging, destination);
  } catch (error) {
    const code = errorCode(error);
    if (code !== 'ENOTEMPTY' && code !== 'EEXIST') throw error;
    await fs.rm(staging, { recursive: true, force: true });
  }
  await fs.rm(retired, { recursive: true, force: true });
}

export async function syncSkillTree({
  source,
  destination,
  packageName,
}: SkillTreeSync): Promise<void> {
  const staging = scratchPath(destination, 'staging');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, staging, { recursive: true });

  // The source tree names one canonical package; each copy names its own, so
  // a consumer reading the copy sees the package it resolved it from.
  const skillMd = path.join(staging, 'SKILL.md');
  await fs.writeFile(
    skillMd,
    stampSkillMetadata(await fs.readFile(skillMd, 'utf-8'), 'library', packageName),
  );

  if (await treesMatch(staging, destination)) {
    await fs.rm(staging, { recursive: true, force: true });
    return;
  }
  await installTree(staging, destination);
}

export async function syncPackageSkills(packageName: string): Promise<string> {
  const packageDir = SKILL_ANCHOR_PACKAGES.get(packageName);
  if (packageDir === undefined) {
    const shipping = [...SKILL_ANCHOR_PACKAGES.keys()].join(', ');
    throw new Error(`${packageName} does not ship the ${SKILL_NAME} skill; expected ${shipping}`);
  }

  const source = path.join(rootDir, 'skills', SKILL_NAME);
  const destination = path.join(rootDir, packageDir, 'skills', SKILL_NAME);
  await syncSkillTree({ source, destination, packageName });
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
