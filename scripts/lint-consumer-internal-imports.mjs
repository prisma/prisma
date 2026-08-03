#!/usr/bin/env node
/**
 * A consumer project names no internal workspace package.
 *
 * ADR 242 makes an application depend on exactly one `@prisma/orm-*` database
 * package plus whatever extension packs it installs. The `@internal/*`
 * names are this repository's own vocabulary and are not published at all, so
 * a consumer that names one is describing an install no user could reproduce.
 * The repository's own consumers are the standing proof of that, and they can
 * fall short of it in two ways, so each scope is measured twice:
 *
 *   - **imports** — a line naming an `@internal/*` specifier.
 *   - **manifests** — an internal package a consumer's `package.json` names,
 *     as its own `name` or in `dependencies` / `devDependencies`. A consumer
 *     could import nothing internal and still list a dozen internal packages,
 *     and its install would look nothing like a real application's.
 *
 * Either one is a failure. There is no threshold and no allowance: the rule is
 * that the count is zero, and a check that admits a number invites the number
 * to grow.
 *
 * This is not `lint-single-import-root.mjs`. That one forbids a consumer
 * naming *both* roots at once, which loads two copies of every module they
 * share. This one forbids naming the internal root at all.
 *
 * Exit codes:
 *   0 — no scope names an internal package
 *   1 — at least one does
 *
 * The script uses process.cwd() as the git root so tests can supply a
 * temporary fixture repo by setting cwd on the child process.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GIT_ROOT = process.cwd();

const INTERNAL_SCOPE = '@internal/';

/**
 * The trees this check governs: the ones shaped like something a user would
 * write.
 *
 * Most of `test/` is deliberately absent, and that is a statement about what
 * those suites are for rather than an allowance made to them. `test/integration`'s
 * port suites, its fixtures, and the `sql-orm-client` and `sql-builder` suites
 * exist to exercise internal packages directly — those packages are the code
 * under test. Rewriting them onto a database package would replace what they
 * cover with coverage of that package's re-exports, which is a different and
 * much smaller thing. They are not consumers, and this check has nothing to
 * say about them.
 *
 * `test/e2e/framework` stands in for an application and `cli-journeys` drives
 * the CLI the way a user does, so both are in. `cli-journeys` owns no
 * `package.json`; its dependencies come from `test/integration`, which is out
 * of scope for the reason above.
 */
export const CONSUMER_SCOPES = [
  'examples',
  'apps',
  'test/e2e/framework',
  'test/integration/test/cli-journeys',
];

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

function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function trackedFiles(scanDir, scopePath) {
  return git(scanDir, 'ls-files', '--', scopePath).split('\n').filter(Boolean);
}

/** One record per line in `scopePath` that names an internal specifier. */
export function scanScope(scanDir, scopePath) {
  const files = trackedFiles(scanDir, scopePath).filter(isScannableFile);

  const records = [];
  for (const relPath of files) {
    let content;
    try {
      content = readFileSync(join(scanDir, relPath), 'utf-8');
    } catch (cause) {
      // A tracked file this cannot read is a file it cannot clear, and
      // silently not scanning one is indistinguishable from scanning it and
      // finding nothing.
      throw new Error(`${relPath} is tracked but could not be read`, { cause });
    }
    for (const match of findMatchingLines(content)) {
      records.push({ file: relPath, ...match });
    }
  }
  return records;
}

const MANIFEST_FIELDS = ['dependencies', 'devDependencies'];

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * One record per internal package a consumer manifest in `scopePath` names.
 *
 * A project's own `name` counts alongside its dependencies: a project carrying
 * our internal scope is describing itself as part of the framework, which no
 * user's application is.
 */
export function scanManifests(scanDir, scopePath) {
  const manifests = trackedFiles(scanDir, scopePath)
    .filter((relPath) => /(^|\/)package\.json$/.test(relPath))
    .filter((relPath) => !/(^|\/)node_modules\//.test(relPath));

  const records = [];
  for (const relPath of manifests) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(join(scanDir, relPath), 'utf-8'));
    } catch (cause) {
      // Skipping would report a manifest nobody could read as one declaring
      // nothing, so a file broken by an edit would pass the check that exists
      // to read it.
      throw new Error(`${relPath} could not be read as JSON`, { cause });
    }
    if (!isRecord(parsed)) {
      throw new Error(`${relPath} is valid JSON but not a JSON object`);
    }
    if (typeof parsed.name === 'string' && parsed.name.startsWith(INTERNAL_SCOPE)) {
      records.push({ file: relPath, field: 'name', package: parsed.name });
    }
    for (const field of MANIFEST_FIELDS) {
      const declared = parsed[field];
      if (!isRecord(declared)) continue;
      for (const name of Object.keys(declared)) {
        if (name.startsWith(INTERNAL_SCOPE)) records.push({ file: relPath, field, package: name });
      }
    }
  }
  return records;
}

const CONSUMER_RULE =
  'A consumer depends on one @prisma/orm-* database package and its extension packs,\n' +
  'and imports only published names. The @internal/* packages are not\n' +
  'published, so naming one describes an install no user could reproduce (ADR 242).\n' +
  'If the published surface has no name for something a consumer needs, that is a\n' +
  'gap in the surface, not a reason to keep the workspace name.';

function report(scopePath, label, records, render) {
  console.error(`\n  ${scopePath}: ${records.length} ${label}`);
  for (const record of records.slice(0, 20)) console.error(`    ${render(record)}`);
  if (records.length > 20) console.error(`    … and ${records.length - 20} more`);
}

export function main(scopes = CONSUMER_SCOPES) {
  const list = process.argv.slice(2).includes('--list');
  let failed = false;

  for (const scopePath of scopes) {
    const imports = scanScope(GIT_ROOT, scopePath);
    const manifests = scanManifests(GIT_ROOT, scopePath);

    if (imports.length > 0) {
      report(
        scopePath,
        'import line(s) naming an internal package',
        imports,
        (r) => `${r.file}:${r.line}: ${r.specifiers.join(', ')}`,
      );
      failed = true;
    }
    if (manifests.length > 0) {
      report(
        scopePath,
        'internal package(s) named by a manifest',
        manifests,
        (r) => `${r.file} ${r.field}: ${r.package}`,
      );
      failed = true;
    }
    if (list) {
      for (const record of imports) {
        console.log(`  ${record.file}:${record.line}: ${record.specifiers.join(', ')}`);
      }
      for (const record of manifests) {
        console.log(`  ${record.file} ${record.field}: ${record.package}`);
      }
    }
  }

  if (failed) {
    console.error(`\n${CONSUMER_RULE}\n`);
    return 1;
  }
  console.log(`No consumer project under ${scopes.join(', ')} names an @internal/* package.`);
  return 0;
}

if (process.argv[1] === import.meta.filename) process.exit(main());
