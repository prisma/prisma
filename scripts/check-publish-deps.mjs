#!/usr/bin/env node
// Publish-time CI gate.
//
// For every publishable package, packs the tarball that `pnpm publish` would
// upload to the registry and runs two checks against the tarball's
// `package.json`:
//
//   1. `workspace:` / `catalog:` leak check. Both are pnpm-internal
//      protocols, meaningless on the registry and install-breaking for
//      downstream npm/pnpm/yarn consumers. `pnpm publish` rewrites them on
//      its own, but `npm publish` and some CI flows do not — this catches
//      the leak before the broken tarball reaches the registry. Covers
//      every dep field.
//
//   2. Exact-pin check on published siblings. Every `@prisma/orm-*` entry
//      in `dependencies`, `peerDependencies`, and `optionalDependencies`
//      (the three fields that ship to consumers) must be a single exact
//      version `X.Y.Z` (with an optional semver pre-release suffix).
//      Carets, tildes, ranges, and wildcards all fail. Combined with the
//      `workspace:<X.Y.Z>` literal-version form in the source manifests,
//      this is what makes a facade install resolve to exactly the
//      combination of platform packages the release validated, rather
//      than to whatever the range happens to admit later.
//
//   3. Private-name check. No `@prisma-next/*` entry may appear in any
//      dependency field, `devDependencies` included. Those are workspace
//      names; nothing publishes under them (ADR 242), so a manifest that
//      declares one points a reader at a package that does not exist.
//      Shells declare them to build and drop them at pack time via
//      `scripts/pack-manifest.mjs`; this is the check that the drop
//      actually happened.
//
// Usage:
//   node scripts/check-publish-deps.mjs           — exit 1 on any violation
//   node scripts/check-publish-deps.mjs --json    — same, with JSON report
//
// Wired into `.github/workflows/publish.yml` immediately before the publish
// step. Also runnable locally: `pnpm check:publish-deps`.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEP_FIELDS = /** @type {const} */ ([
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]);

// The exact-pin check looks only at the three fields that ship to
// consumers. devDependencies aren't installed by consumers so imprecise
// specs there don't affect the type-identity invariant the pin check
// enforces.
const SHIPPED_DEP_FIELDS = /** @type {const} */ ([
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
]);

/** Prefix of the published sibling packages a tarball may depend on. */
const PUBLISHED_PREFIX = '@prisma/orm-';

/** Scope of the workspace-internal packages, which never publish. */
const PRIVATE_SCOPE = '@prisma-next/';

const EXACT_VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * Returns true if `spec` is a published-tarball-poisoning specifier
 * (`workspace:*`, `catalog:foo`, etc.). Both pnpm-internal protocols are
 * meaningless on the registry and break downstream installs.
 *
 * Exported so the unit test in
 * `test/scripts/check-publish-deps.test.mjs` can exercise the rule
 * without packing tarballs.
 */
export function isLeak(spec) {
  return typeof spec === 'string' && (spec.startsWith('workspace:') || spec.startsWith('catalog:'));
}

/**
 * Walks every dependency field on a package.json-shaped object and
 * returns the list of `(field, name, spec)` triples that
 * {@link isLeak} flags. Pure / side-effect-free; exported for tests.
 *
 * @param {Record<string, unknown>} pkgJson
 * @returns {Array<{ field: string; name: string; spec: string }>}
 */
export function findLeaks(pkgJson) {
  const leaks = [];
  for (const field of DEP_FIELDS) {
    const deps = pkgJson[field];
    if (!deps || typeof deps !== 'object') continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (isLeak(spec)) {
        leaks.push({ field, name, spec });
      }
    }
  }
  return leaks;
}

/**
 * Returns true if `spec` is a clean exact-version specifier
 * (`X.Y.Z` or `X.Y.Z-<prerelease>`). Carets, tildes, ranges, and
 * wildcards return false. Anything non-string returns false.
 *
 * Exported for unit tests.
 */
export function isExactPnVersion(spec) {
  return typeof spec === 'string' && EXACT_VERSION_RE.test(spec);
}

/**
 * Walks `dependencies`, `peerDependencies`, and `optionalDependencies`
 * on a package.json-shaped object and returns the list of
 * `(field, name, spec)` triples where a `@prisma/orm-*` entry is
 * not pinned to an exact version. Specs already flagged by
 * {@link isLeak} are skipped — those are reported by the leak rule
 * to avoid double-attribution noise. Pure / side-effect-free.
 *
 * @param {Record<string, unknown>} pkgJson
 * @returns {Array<{ field: string; name: string; spec: string }>}
 */
export function findPnPinViolations(pkgJson) {
  const violations = [];
  for (const field of SHIPPED_DEP_FIELDS) {
    const deps = pkgJson[field];
    if (!deps || typeof deps !== 'object') continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (!name.startsWith(PUBLISHED_PREFIX)) continue;
      if (typeof spec !== 'string') continue;
      if (isLeak(spec)) continue; // reported by the leak rule
      if (!isExactPnVersion(spec)) {
        violations.push({ field, name, spec });
      }
    }
  }
  return violations;
}

/**
 * Every `@prisma-next/*` entry in any dependency field. Those are
 * workspace-internal names that no longer publish (ADR 242), so a manifest
 * that declares one names a package a reader cannot install — including in
 * `devDependencies`, which `pnpm pack` copies into the tarball verbatim.
 * Pure / side-effect-free; exported for tests.
 *
 * @param {Record<string, unknown>} pkgJson
 * @returns {Array<{ field: string; name: string; spec: string }>}
 */
export function findPrivateNames(pkgJson) {
  const found = [];
  for (const field of DEP_FIELDS) {
    const deps = pkgJson[field];
    if (!deps || typeof deps !== 'object') continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (name.startsWith(PRIVATE_SCOPE)) found.push({ field, name, spec: String(spec) });
    }
  }
  return found;
}

function readPackedManifest(tgzPath) {
  const out = execFileSync('tar', ['-xzOf', tgzPath, 'package/package.json'], {
    encoding: 'utf-8',
  });
  return JSON.parse(out);
}

function listPublishablePackageDirs() {
  const out = execFileSync('node', ['scripts/list-publishable-packages.mjs'], {
    encoding: 'utf-8',
  });
  return out
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.replace(/^\.\//, ''));
}

/**
 * Packs every workspace package into `destDir`. Returns 0 on success and
 * a non-zero exit code on failure so the caller can release any temp
 * resources (notably the tmpdir used as `destDir`) before exiting.
 *
 * @param {string} destDir
 * @returns {number}
 */
export function packAll(destDir) {
  // Pack every workspace package in one shot. We over-pack (private
  // packages get tarballs too) but that's cheap and lets us avoid the
  // per-package invocation overhead. The gate filters down to publishables
  // when reading.
  const result = spawnSync(
    'pnpm',
    ['-r', '--workspace-concurrency=8', 'pack', '--pack-destination', destDir],
    {
      stdio: ['ignore', 'ignore', 'inherit'],
    },
  );
  if (result.status !== 0) {
    process.stderr.write(`\npnpm -r pack failed with exit code ${result.status}\n`);
    return result.status ?? 1;
  }
  return 0;
}

function tarballNameFor(pkgName, version) {
  // Mirrors pnpm pack's default naming: `<name>-<version>.tgz` with the
  // package's `/` rewritten to `-` and the leading scope `@` dropped.
  // (e.g. `@prisma-next/foo@1.2.3` → `prisma-next-foo-1.2.3.tgz`).
  return `${pkgName.replace(/^@/, '').replace(/\//g, '-')}-${version}.tgz`;
}

const DEFAULT_IO = {
  packAll,
  listPublishablePackageDirs,
  readPackedManifest,
  readPackageJson: (dir) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8')),
  readdirSync,
  mkdtemp: () => mkdtempSync(join(tmpdir(), 'pn-publish-check-')),
  rm: (path) => rmSync(path, { recursive: true, force: true }),
  stdoutWrite: (s) => process.stdout.write(s),
  stderrWrite: (s) => process.stderr.write(s),
};

/**
 * Runs the publish-deps gate. Pure with respect to its `io` seam — the
 * default uses `pnpm pack`, the workspace fs, and `process.{stdout,stderr}`,
 * but tests can stub each leg to exercise the failure-path cleanup
 * without packing real tarballs.
 *
 * Always returns a numeric exit code; the caller is responsible for the
 * single `process.exit(...)` so finally-blocks (here, tmpdir cleanup)
 * always run.
 *
 * @param {object} [options]
 * @param {string[]} [options.argv]
 * @param {Partial<typeof DEFAULT_IO>} [options.io]
 * @returns {number}
 */
export function runCheck({ argv = process.argv.slice(2), io = {} } = {}) {
  const {
    packAll: pack,
    listPublishablePackageDirs: listDirs,
    readPackedManifest: readPacked,
    readPackageJson,
    readdirSync: readDir,
    mkdtemp,
    rm,
    stdoutWrite,
    stderrWrite,
  } = { ...DEFAULT_IO, ...io };
  const args = new Set(argv);
  const json = args.has('--json');

  const dirs = listDirs();
  const dest = mkdtemp();

  try {
    stderrWrite(
      `Packing ${dirs.length} publishable packages (and any private workspace siblings) → ${dest}\n`,
    );
    const packExitCode = pack(dest);
    if (packExitCode !== 0) {
      return packExitCode;
    }

    const tarballs = new Set(readDir(dest).filter((f) => f.endsWith('.tgz')));
    /**
     * @type {Array<{
     *   pkg: string;
     *   tarball: string;
     *   leaks: ReturnType<typeof findLeaks>;
     *   pnPinViolations: ReturnType<typeof findPnPinViolations>;
     *   privateNames: ReturnType<typeof findPrivateNames>;
     * }>}
     */
    const offenders = [];

    for (const dir of dirs) {
      const sourcePkg = readPackageJson(dir);
      const tarballName = tarballNameFor(sourcePkg.name, sourcePkg.version);
      if (!tarballs.has(tarballName)) {
        stderrWrite(`warn: tarball not found for ${sourcePkg.name} (${tarballName})\n`);
        continue;
      }
      const packed = readPacked(join(dest, tarballName));
      const leaks = findLeaks(packed);
      const pnPinViolations = findPnPinViolations(packed);
      const privateNames = findPrivateNames(packed);
      if (leaks.length > 0 || pnPinViolations.length > 0 || privateNames.length > 0) {
        offenders.push({
          pkg: sourcePkg.name,
          tarball: tarballName,
          leaks,
          pnPinViolations,
          privateNames,
        });
      }
    }

    if (json) {
      stdoutWrite(`${JSON.stringify({ ok: offenders.length === 0, offenders }, null, 2)}\n`);
    } else if (offenders.length === 0) {
      stderrWrite(
        '\nOK — no workspace:/catalog: leaks, no @prisma/orm-* pin violations, and no private\n' +
          `@prisma-next/* names in ${dirs.length} publishable packages.\n`,
      );
    } else {
      stderrWrite(
        `\nFAIL — ${offenders.length} publishable package(s) have publish-time violations:\n`,
      );
      for (const o of offenders) {
        stderrWrite(`\n  ${o.pkg}\n`);
        for (const l of o.leaks) {
          stderrWrite(`    [leak]     ${l.field}.${l.name} = ${l.spec}\n`);
        }
        for (const v of o.pnPinViolations) {
          stderrWrite(`    [pin]      ${v.field}.${v.name} = ${v.spec}\n`);
        }
        for (const p of o.privateNames) {
          stderrWrite(`    [private]  ${p.field}.${p.name} = ${p.spec}\n`);
        }
      }
      stderrWrite(
        '\n  [leak] specs are pnpm-internal (workspace:/catalog:) and break consumer installs.\n' +
          '         Publish via `pnpm publish` (which rewrites them) rather than `npm publish`,\n' +
          '         or convert the dependency to a real version range.\n' +
          '  [pin]  every @prisma/orm-* entry in dependencies/peer/optional must be a single\n' +
          '         exact version `X.Y.Z` (a pre-release suffix is permitted). Carets, tildes,\n' +
          '         ranges, and wildcards are rejected so consumer installs see the exact\n' +
          '         platform graph this release validated against.\n' +
          '  [private] @prisma-next/* names do not publish (ADR 242), so a manifest that\n' +
          '         declares one points at a package nobody can install. Shells declare them\n' +
          '         to build and drop them at pack time — add the `prepack`/`postpack` hooks\n' +
          '         from scripts/pack-manifest.mjs, or remove the dependency.\n',
      );
    }

    return offenders.length === 0 ? 0 : 1;
  } finally {
    rm(dest);
  }
}

export function main() {
  return runCheck();
}

// Only run `main` when invoked directly. Importing the module from a unit
// test (or any other tool) gets you the pure helpers (`findLeaks`,
// `isLeak`) without packing every workspace tarball.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main());
}
