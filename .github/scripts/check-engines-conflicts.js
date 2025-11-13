#!/usr/bin/env node
/**
 * Determine if merge conflicts are limited to Prisma engines dependency bumps.
 *
 * The script inspects the stage-2 (ours) and stage-3 (theirs) versions that Git
 * exposes during a merge conflict. We only analyse `package.json` files to
 * ensure that the conflicting dependency changes are restricted to the known
 * Prisma engines packages. Lockfiles are treated as supporting files – if every
 * conflicting file is either a `package.json` or `pnpm-lock.yaml`, and every
 * package.json conflict only touches engines packages, we consider the conflict
 * auto-resolvable.
 *
 * Output: JSON printed to stdout, shaped as:
 * {
 *   autoResolvable: boolean,
 *   files: Array<{
 *     path: string,
 *     kind: 'packageJson' | 'pnpmLock' | 'other',
 *     diffPackages: string[],
 *     nonEngineChanges: string[]
 *   }>
 * }
 */

const { spawnSync } = require('child_process');

const relevantPackages = [
  '@prisma/engines',
  '@prisma/engines-version',
  '@prisma/prisma-schema-wasm',
  '@prisma/query-engine-wasm',
  '@prisma/query-compiler-wasm',
  '@prisma/schema-engine-wasm',
];

const dependencySections = [
  ['dependencies'],
  ['devDependencies'],
  ['optionalDependencies'],
  ['peerDependencies'],
  ['resolutions'],
  ['pnpm', 'overrides'],
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function getGitStageContent(stage, filepath) {
  const result = spawnSync('git', ['show', `:${stage}:${filepath}`], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout;
}

function parseJson(content, filepath, stage) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON for ${filepath} (stage ${stage}): ${error.message}`,
    );
  }
}

function getSection(obj, path) {
  let current = obj;
  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return {};
    }
    current = current[key];
  }

  if (!current || typeof current !== 'object') {
    return {};
  }

  return current;
}

function diffDependencies(ours, theirs) {
  const diffPackages = new Set();
  const nonEngineChanges = new Set();

  for (const path of dependencySections) {
    const oursSection = getSection(ours, path);
    const theirsSection = getSection(theirs, path);
    const keys = new Set([
      ...Object.keys(oursSection || {}),
      ...Object.keys(theirsSection || {}),
    ]);

    for (const key of keys) {
      const oursValue = oursSection?.[key];
      const theirsValue = theirsSection?.[key];

      if (oursValue === theirsValue) {
        continue;
      }

      if (relevantPackages.includes(key)) {
        diffPackages.add(key);
      } else {
        nonEngineChanges.add(key);
      }
    }
  }

  return {
    diffPackages: Array.from(diffPackages),
    nonEngineChanges: Array.from(nonEngineChanges),
  };
}

function analysePackageJson(filepath) {
  const oursContent = getGitStageContent('2', filepath);
  const theirsContent = getGitStageContent('3', filepath);

  if (oursContent === null || theirsContent === null) {
    return {
      path: filepath,
      kind: 'packageJson',
      diffPackages: [],
      nonEngineChanges: ['missing-stage-content'],
    };
  }

  const ours = parseJson(oursContent, filepath, 2);
  const theirs = parseJson(theirsContent, filepath, 3);
  const { diffPackages, nonEngineChanges } = diffDependencies(ours, theirs);

  return {
    path: filepath,
    kind: 'packageJson',
    diffPackages,
    nonEngineChanges,
  };
}

function analyseFile(filepath) {
  if (filepath.endsWith('package.json')) {
    return analysePackageJson(filepath);
  }

  if (filepath.endsWith('pnpm-lock.yaml')) {
    return {
      path: filepath,
      kind: 'pnpmLock',
      diffPackages: [],
      nonEngineChanges: [],
    };
  }

  return {
    path: filepath,
    kind: 'other',
    diffPackages: [],
    nonEngineChanges: ['unsupported-file-type'],
  };
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    fail('No files provided for conflict analysis.');
    console.log(JSON.stringify({ autoResolvable: false, files: [] }));
    return;
  }

  const analysis = [];
  let autoResolvable = true;
  let hasRelevantDiff = false;

  for (const file of files) {
    const result = analyseFile(file);
    analysis.push(result);

    const supportsAuto =
      result.kind === 'packageJson' || result.kind === 'pnpmLock';
    const hasNonEngineChanges =
      result.nonEngineChanges && result.nonEngineChanges.length > 0;

    if (result.kind === 'packageJson' && result.diffPackages.length > 0) {
      hasRelevantDiff = true;
    }

    if (!supportsAuto || hasNonEngineChanges) {
      autoResolvable = false;
    }
  }

  if (autoResolvable && !hasRelevantDiff) {
    autoResolvable = false;
  }

  const payload = {
    autoResolvable,
    files: analysis,
  };

  process.stdout.write(JSON.stringify(payload));
}

main().catch((error) => {
  fail(error.message);
  process.stdout.write(JSON.stringify({ autoResolvable: false, files: [] }));
});
