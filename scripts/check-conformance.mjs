#!/usr/bin/env node
// Publish-time conformance gate. Three checks over what actually ships,
// complementing `check-publish-deps.mjs` (which reads only declaration
// files):
//
//   1. Import purity over built JavaScript. Every `.js`/`.mjs` file inside
//      each publishable package's packed tarball is parsed with
//      es-module-lexer (static imports, re-exports, dynamic `import()` —
//      not strings or `import.meta.resolve` arguments). Every bare
//      specifier's package root must be declared in the packed manifest's
//      `dependencies`/`peerDependencies`/`optionalDependencies` or be a
//      Node builtin. An `@internal/*` or `@repo/*` import in packed output
//      is always a finding — those names never exist on the registry.
//
//   2. The shipped `orm` config-section validator never throws. Its
//      `validate` is run over a fixed hostile corpus and must return a
//      well-formed SectionValidation for every input. Reached through the
//      built `@prisma/orm-toolchain` dist so the check exercises what
//      ships, not source.
//
//   3. Published-tarball verification. (a) is check 1 on packed tarballs.
//      (b) The `@prisma/orm-toolchain` tarball installs into a clean
//      sandbox at `.conformance/` (npm, `--ignore-scripts`, workspace
//      siblings supplied as version-qualified `file:` overrides) and every
//      packed `bin` entry starts under plain `node <path> --version`.
//      (c) The `@prisma/cli-engine` pin is a single exact version,
//      identical across every packed publishable manifest that declares it
//      and the source `@internal/cli` manifest.
//
// Every check reports a finding when its subject set is empty, so a run
// that checked nothing can never pass. The sandbox is deleted at the START
// of each run, not the end, so failures leave evidence behind.
//
// Usage:
//   node scripts/check-conformance.mjs           — exit 1 on any finding
//   node scripts/check-conformance.mjs --json    — same, with JSON report
//
// Wired into `.github/workflows/publish.yml` immediately after
// `check:publish-deps`. Also runnable locally: `pnpm check:conformance`.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { init as initLexer, parse as parseModule } from 'es-module-lexer';

const ENGINE_PACKAGE = '@prisma/cli-engine';
const TOOLCHAIN_PACKAGE = '@prisma/orm-toolchain';
const TOOLCHAIN_CLI_DIST = 'packages/9-public/@prisma/orm-toolchain/dist/cli.mjs';
const SOURCE_CLI_MANIFEST = 'packages/1-framework/3-tooling/cli/package.json';
const CONFORMANCE_DIR = '.conformance';
const BIN_TIMEOUT_MS = 30_000;

const SHIPPED_DEP_FIELDS = /** @type {const} */ ([
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
]);

const EXACT_VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const NODE_BUILTINS = new Set(builtinModules);

/**
 * The npm package a module specifier belongs to, or `null` when it names
 * none: relative and absolute paths, `#` subpath imports, and Node
 * builtins (bare or `node:`-prefixed). Pure; exported for tests.
 *
 * @param {string} spec
 * @returns {string | null}
 */
export function packageRootOf(spec) {
  if (spec === '' || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('#')) {
    return null;
  }
  if (spec.startsWith('node:')) return null;
  const segments = spec.split('/');
  const root = spec.startsWith('@') ? `${segments[0]}/${segments[1]}` : segments[0];
  if (!root || NODE_BUILTINS.has(root)) return null;
  return root;
}

/**
 * Every bare specifier `source` imports — static imports, re-exports, and
 * dynamic `import()` with a plain-string specifier. A package name that
 * merely appears in a string or as an `import.meta.resolve` argument is
 * not an import and is not reported; that distinction is why this is a
 * lexer and not a regex.
 *
 * @param {string} source
 * @param {string} file tarball-relative path, carried into each result
 * @returns {Promise<Array<{ root: string; specifier: string; file: string }>>}
 */
export async function bareImportSpecifiersIn(source, file) {
  await initLexer;
  const [imports] = parseModule(source, file);
  const found = [];
  for (const record of imports) {
    // `n` is absent for `import.meta` records and for a dynamic import
    // whose specifier is not a plain string — nothing to attribute.
    const specifier = record.n;
    if (specifier === undefined) continue;
    const root = packageRootOf(specifier);
    if (root === null) continue;
    found.push({ root, specifier, file });
  }
  return found;
}

/**
 * Classifies a packed package's bare imports against its packed manifest.
 * One violation per distinct specifier:
 *   - `internal`   — the import names `@internal/*` or `@repo/*`, which
 *                    never exist on the registry, declared or not.
 *   - `undeclared` — the package root is in no consumer-installed dep
 *                    field (devDependencies do not count).
 *
 * Pure / side-effect-free; exported for tests.
 *
 * @param {object} args
 * @param {Record<string, unknown>} args.manifest packed package.json
 * @param {Array<{ root: string; specifier: string; file: string }>} args.imports
 * @returns {Array<{ kind: 'internal' | 'undeclared'; root: string; specifier: string; file: string }>}
 */
export function findImportPurityViolations({ manifest, imports }) {
  const declared = new Set(
    SHIPPED_DEP_FIELDS.flatMap((field) => {
      const deps = manifest[field];
      return deps && typeof deps === 'object' ? Object.keys(deps) : [];
    }),
  );
  const violations = [];
  const seen = new Set();
  for (const { root, specifier, file } of imports) {
    if (seen.has(specifier)) continue;
    if (root.startsWith('@internal/') || root.startsWith('@repo/')) {
      seen.add(specifier);
      violations.push({ kind: 'internal', root, specifier, file });
      continue;
    }
    if (!declared.has(root)) {
      seen.add(specifier);
      violations.push({ kind: 'undeclared', root, specifier, file });
    }
  }
  return violations;
}

function selfReferencing() {
  const object = { name: 'loop' };
  object.self = object;
  return object;
}

function throwingProxy(trap) {
  const explode = () => {
    throw new Error(`the ${trap} trap throws`);
  };
  return new Proxy({ contract: 'x' }, trap === 'get' ? { get: explode } : { ownKeys: explode });
}

function throwingGetter() {
  return Object.defineProperty({}, 'contract', {
    enumerable: true,
    get() {
      throw new Error('the getter throws');
    },
  });
}

/**
 * The fixed hostile corpus every shipped validator must survive. Each
 * value is built per use because some cases are stateful or
 * self-referencing. Mirrors the corpus the sibling prisma-cli conformance
 * checker runs, so the two repos hold the same bar.
 */
export const HOSTILE_INPUTS = /** @type {const} */ ([
  { label: 'undefined', make: () => undefined },
  { label: 'null', make: () => null },
  { label: 'false', make: () => false },
  { label: 'zero', make: () => 0 },
  { label: 'a negative zero', make: () => -0 },
  { label: 'the empty string', make: () => '' },
  { label: 'a bigint', make: () => 10n },
  { label: 'a symbol', make: () => Symbol('hostile') },
  { label: 'NaN', make: () => Number.NaN },
  { label: 'an empty array', make: () => [] },
  { label: 'a populated array', make: () => [1, 'two', null] },
  { label: 'a function', make: () => () => 'not config' },
  { label: 'an empty object', make: () => ({}) },
  { label: 'a frozen object', make: () => Object.freeze({ contract: 'x' }) },
  {
    label: 'a null prototype object',
    make: () => Object.assign(Object.create(null), { contract: 'x' }),
  },
  {
    label: 'deeply nested objects',
    make: () => ({ a: { b: { c: { d: { e: { f: { g: 'deep' } } } } } } }),
  },
  { label: 'a self-referencing object', make: selfReferencing },
  {
    label: 'known fields with wrong types',
    make: () => ({ family: 42, contract: [], db: 'yes', migrations: 0, target: {} }),
  },
  { label: 'a proxy whose get trap throws', make: () => throwingProxy('get') },
  { label: 'a proxy whose ownKeys trap throws', make: () => throwingProxy('ownKeys') },
  { label: 'a getter that throws', make: throwingGetter },
]);

/**
 * `{ ok: true, value, diagnostics: [] }` or `{ ok: false, diagnostics }`.
 * Exported for tests.
 */
export function isSectionValidation(returned) {
  if (typeof returned !== 'object' || returned === null) return false;
  if (!Array.isArray(returned.diagnostics)) return false;
  if (returned.ok === false) return true;
  return returned.ok === true && 'value' in returned;
}

/**
 * Runs a config section's `validate` over {@link HOSTILE_INPUTS} and
 * returns one violation per hostile input the validator throws on
 * (`threw`) or answers with something that is not a SectionValidation
 * (`malformed`). Pure aside from calling the validator; exported for
 * tests.
 *
 * @param {{ name: string; validate: (value: unknown) => unknown }} section
 * @returns {Array<{ kind: 'threw' | 'malformed'; label: string; message: string }>}
 */
export function findValidatorViolations(section) {
  const violations = [];
  for (const hostile of HOSTILE_INPUTS) {
    let returned;
    try {
      returned = section.validate(hostile.make());
    } catch (error) {
      violations.push({
        kind: 'threw',
        label: hostile.label,
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    if (!isSectionValidation(returned)) {
      violations.push({
        kind: 'malformed',
        label: hostile.label,
        message: 'the return value is not a SectionValidation',
      });
    }
  }
  return violations;
}

/**
 * The npm `overrides` map that makes a packed tarball installable when its
 * dependency graph names unpublished workspace siblings: every packed
 * workspace package reachable from `rootName` through
 * dependencies/peer/optional gets a version-qualified key
 * (`name@declared-spec`) mapped to its absolute `file:` tarball path.
 * Cycles between siblings are tolerated. Pure; exported for tests.
 *
 * @param {object} args
 * @param {string} args.rootName
 * @param {Map<string, { tarballPath: string; manifest: Record<string, unknown> }>} args.packedByName
 * @returns {Record<string, string>}
 */
export function computeOverrides({ rootName, packedByName }) {
  const overrides = {};
  const visited = new Set();
  const visit = (name) => {
    if (visited.has(name)) return;
    visited.add(name);
    const entry = packedByName.get(name);
    if (!entry) return;
    for (const field of SHIPPED_DEP_FIELDS) {
      const deps = entry.manifest[field];
      if (!deps || typeof deps !== 'object') continue;
      for (const [depName, spec] of Object.entries(deps)) {
        const sibling = packedByName.get(depName);
        if (!sibling) continue;
        overrides[`${depName}@${spec}`] = `file:${sibling.tarballPath}`;
        visit(depName);
      }
    }
  };
  visit(rootName);
  return overrides;
}

/**
 * Checks that the `@prisma/cli-engine` pin is a single exact version,
 * identical across every packed publishable manifest that declares it and
 * the source `@internal/cli` manifest. Reports `no-subjects` when no
 * packed manifest declares the engine at all — a vacuous agreement is not
 * a pass. Pure; exported for tests.
 *
 * @param {object} args
 * @param {Array<{ pkg: string; spec: string }>} args.packedPins
 * @param {{ pkg: string; spec: string | undefined }} args.sourcePin
 * @returns {Array<{ kind: 'no-subjects' | 'not-exact' | 'disagreement'; message: string }>}
 */
export function findEnginePinViolations({ packedPins, sourcePin }) {
  if (packedPins.length === 0) {
    return [
      {
        kind: 'no-subjects',
        message: `no packed publishable manifest declares ${ENGINE_PACKAGE}, so there is nothing to agree with ${sourcePin.pkg}`,
      },
    ];
  }
  const all = [...packedPins];
  if (typeof sourcePin.spec === 'string') {
    all.push({ pkg: sourcePin.pkg, spec: sourcePin.spec });
  } else {
    all.push({
      pkg: sourcePin.pkg,
      spec: `(missing — ${sourcePin.pkg} no longer declares ${ENGINE_PACKAGE})`,
    });
  }

  const violations = [];
  for (const { pkg, spec } of all) {
    if (!EXACT_VERSION_RE.test(spec)) {
      violations.push({
        kind: 'not-exact',
        message: `${pkg} pins ${ENGINE_PACKAGE} as "${spec}", which is not a single exact version`,
      });
    }
  }
  const distinct = new Set(all.map((p) => p.spec));
  if (distinct.size > 1) {
    violations.push({
      kind: 'disagreement',
      message: `${ENGINE_PACKAGE} pins disagree: ${all.map((p) => `${p.pkg} pins ${p.spec}`).join(', ')}`,
    });
  }
  return violations;
}

const JS_FILE_RE = /\.m?js$/;

function readPackedManifest(tgzPath) {
  const out = execFileSync('tar', ['-xzOf', tgzPath, 'package/package.json'], {
    encoding: 'utf-8',
  });
  return JSON.parse(out);
}

function readPackedJsSources(tgzPath) {
  const entries = execFileSync('tar', ['-tzf', tgzPath], { encoding: 'utf-8' })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => JS_FILE_RE.test(line));
  const out = new Map();
  if (entries.length === 0) return out;
  const scratch = `${tgzPath}.unpacked`;
  mkdirSync(scratch, { recursive: true });
  execFileSync('tar', ['-xzf', tgzPath, '-C', scratch, ...entries]);
  for (const entry of entries) {
    out.set(entry.replace(/^package\//, ''), readFileSync(join(scratch, entry), 'utf-8'));
  }
  return out;
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

function packAll(destDir) {
  const result = spawnSync(
    'pnpm',
    ['-r', '--workspace-concurrency=8', 'pack', '--pack-destination', destDir],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  if (result.status !== 0) {
    process.stderr.write(`\npnpm -r pack failed with exit code ${result.status}\n`);
    return result.status ?? 1;
  }
  return 0;
}

// Deleted at the START of each run so a failed run leaves its sandbox and
// tarballs behind as evidence.
function prepareConformanceDir() {
  const root = resolve(CONFORMANCE_DIR);
  rmSync(root, { recursive: true, force: true });
  const tarballDir = join(root, 'tarballs');
  const sandboxDir = join(root, 'sandbox');
  mkdirSync(tarballDir, { recursive: true });
  mkdirSync(sandboxDir, { recursive: true });
  return { tarballDir, sandboxDir };
}

async function loadOrmConfigSection() {
  const mod = await import(pathToFileURL(resolve(TOOLCHAIN_CLI_DIST)).href);
  if (!mod.ormConfigSection) {
    throw new Error(`${TOOLCHAIN_CLI_DIST} does not export ormConfigSection — build first?`);
  }
  return mod.ormConfigSection;
}

function readSourceCliEnginePin() {
  const manifest = JSON.parse(readFileSync(SOURCE_CLI_MANIFEST, 'utf-8'));
  return manifest.dependencies?.[ENGINE_PACKAGE];
}

async function installSandbox({ sandboxDir, rootName, rootTarball, overrides }) {
  writeFileSync(
    join(sandboxDir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'prisma-conformance-sandbox',
        private: true,
        dependencies: { [rootName]: `file:${rootTarball}` },
        overrides,
      },
      null,
      2,
    )}\n`,
  );
  const result = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts'], {
    cwd: sandboxDir,
    encoding: 'utf-8',
    // Corepack's npm shim walks up to the repo root, sees pnpm in
    // packageManager, and refuses to run npm without this.
    env: { ...process.env, COREPACK_ENABLE_STRICT: '0' },
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

async function runBin({ sandboxDir, pkgName, relPath, timeoutMs }) {
  const binPath = join(sandboxDir, 'node_modules', pkgName, relPath);
  const result = spawnSync('node', [binPath, '--version'], {
    encoding: 'utf-8',
    timeout: timeoutMs,
    env: { ...process.env, COREPACK_ENABLE_STRICT: '0' },
  });
  return {
    exitCode: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    timedOut: result.error?.code === 'ETIMEDOUT',
  };
}

function tarballNameFor(pkgName, version) {
  return `${pkgName.replace(/^@/, '').replace(/\//g, '-')}-${version}.tgz`;
}

const DEFAULT_IO = {
  listPublishablePackageDirs,
  readPackageJson: (dir) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8')),
  prepareConformanceDir,
  packAll,
  readdirSync,
  readPackedManifest,
  readPackedJsSources,
  loadOrmConfigSection,
  readSourceCliEnginePin,
  installSandbox,
  runBin,
  stdoutWrite: (s) => process.stdout.write(s),
  stderrWrite: (s) => process.stderr.write(s),
};

/**
 * Runs the conformance gate. Pure with respect to its `io` seam — the
 * default packs with pnpm, installs with npm into `.conformance/`, and
 * imports the built toolchain dist, but tests stub each leg with plain
 * values. Always returns a numeric exit code; the caller owns the single
 * `process.exit(...)`.
 *
 * @param {object} [options]
 * @param {string[]} [options.argv]
 * @param {Partial<typeof DEFAULT_IO>} [options.io]
 * @returns {Promise<number>}
 */
export async function runCheck({ argv = process.argv.slice(2), io = {} } = {}) {
  const {
    listPublishablePackageDirs: listDirs,
    readPackageJson,
    prepareConformanceDir: prepareDirs,
    packAll: pack,
    readdirSync: readDir,
    readPackedManifest: readPacked,
    readPackedJsSources: readJsSources,
    loadOrmConfigSection: loadSection,
    readSourceCliEnginePin: readSourcePin,
    installSandbox: install,
    runBin: startBin,
    stdoutWrite,
    stderrWrite,
  } = { ...DEFAULT_IO, ...io };
  const json = new Set(argv).has('--json');

  /** @type {Array<{ check: string; kind: string; subject: string; summary: string; detail?: string; file?: string }>} */
  const findings = [];

  const dirs = listDirs();
  if (dirs.length === 0) {
    findings.push({
      check: 'import-purity',
      kind: 'no-subjects',
      subject: '(none)',
      summary: 'no publishable packages were found, so nothing was checked',
    });
    return report({ findings, json, stdoutWrite, stderrWrite });
  }

  const { tarballDir, sandboxDir } = prepareDirs();
  stderrWrite(`Packing ${dirs.length} publishable packages → ${tarballDir}\n`);
  const packExitCode = pack(tarballDir);
  if (packExitCode !== 0) return packExitCode;

  const tarballs = new Set(readDir(tarballDir).filter((f) => f.endsWith('.tgz')));
  /** @type {Map<string, { tarballPath: string; manifest: Record<string, unknown> }>} */
  const packedByName = new Map();
  let totalJsFiles = 0;

  for (const dir of dirs) {
    const sourcePkg = readPackageJson(dir);
    const tarballName = tarballNameFor(sourcePkg.name, sourcePkg.version);
    if (!tarballs.has(tarballName)) {
      findings.push({
        check: 'import-purity',
        kind: 'no-output',
        subject: sourcePkg.name,
        summary: `tarball not found for ${sourcePkg.name} (${tarballName})`,
      });
      continue;
    }
    const tarballPath = join(tarballDir, tarballName);
    const manifest = readPacked(tarballPath);
    packedByName.set(sourcePkg.name, { tarballPath, manifest });

    const sources = readJsSources(tarballPath);
    totalJsFiles += sources.size;
    const imports = [];
    for (const [file, source] of sources) {
      imports.push(...(await bareImportSpecifiersIn(source, file)));
    }
    for (const violation of findImportPurityViolations({ manifest, imports })) {
      findings.push({
        check: 'import-purity',
        kind: violation.kind,
        subject: sourcePkg.name,
        file: violation.file,
        summary:
          violation.kind === 'internal'
            ? `packed output imports ${violation.specifier}, a workspace-private name that never exists on the registry`
            : `packed output imports ${violation.specifier}, which the packed manifest does not declare in dependencies/peerDependencies/optionalDependencies`,
      });
    }
  }

  if (totalJsFiles === 0) {
    findings.push({
      check: 'import-purity',
      kind: 'no-output',
      subject: '(all packages)',
      summary: 'no packed tarball contained any JavaScript, so nothing was checked — build first',
    });
  }

  try {
    const section = await loadSection();
    if (!section || typeof section.validate !== 'function') {
      findings.push({
        check: 'validator-no-throw',
        kind: 'no-subjects',
        subject: 'ormConfigSection',
        summary: 'the loaded config section has no validate function, so nothing was checked',
      });
    } else {
      for (const violation of findValidatorViolations(section)) {
        findings.push({
          check: 'validator-no-throw',
          kind: violation.kind,
          subject: section.name ?? 'ormConfigSection',
          summary:
            violation.kind === 'threw'
              ? `validate threw on ${violation.label}`
              : `validate returned a malformed SectionValidation for ${violation.label}`,
          detail: violation.message,
        });
      }
    }
  } catch (error) {
    findings.push({
      check: 'validator-no-throw',
      kind: 'load-failed',
      subject: 'ormConfigSection',
      summary: 'the built orm config section could not be loaded, so nothing was checked',
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const toolchain = packedByName.get(TOOLCHAIN_PACKAGE);
  if (!toolchain) {
    findings.push({
      check: 'tarball',
      kind: 'no-subjects',
      subject: TOOLCHAIN_PACKAGE,
      summary: `${TOOLCHAIN_PACKAGE} was not among the packed publishable packages, so no install was checked`,
    });
  } else {
    const overrides = computeOverrides({ rootName: TOOLCHAIN_PACKAGE, packedByName });
    const installed = await install({
      sandboxDir,
      rootName: TOOLCHAIN_PACKAGE,
      rootTarball: toolchain.tarballPath,
      overrides,
    });
    if (!installed.ok) {
      findings.push({
        check: 'tarball',
        kind: 'install-failed',
        subject: TOOLCHAIN_PACKAGE,
        summary: 'the packed tarball did not install into a clean sandbox',
        detail: installed.output,
      });
    } else {
      const bins = Object.entries(toolchain.manifest.bin ?? {});
      if (bins.length === 0) {
        findings.push({
          check: 'tarball',
          kind: 'no-subjects',
          subject: TOOLCHAIN_PACKAGE,
          summary: 'the packed manifest has no bin entries, so no executable was started',
        });
      }
      for (const [binName, relPath] of bins) {
        const run = await startBin({
          sandboxDir,
          pkgName: TOOLCHAIN_PACKAGE,
          binName,
          relPath,
          timeoutMs: BIN_TIMEOUT_MS,
        });
        if (run.timedOut) {
          findings.push({
            check: 'tarball',
            kind: 'bin-failed',
            subject: TOOLCHAIN_PACKAGE,
            summary: `bin ${binName} timed out instead of exiting`,
            detail: run.stderr,
          });
        } else if (run.exitCode !== 0) {
          findings.push({
            check: 'tarball',
            kind: 'bin-failed',
            subject: TOOLCHAIN_PACKAGE,
            summary: `bin ${binName} exited ${run.exitCode} under plain node`,
            detail: `stdout:\n${run.stdout}\nstderr:\n${run.stderr}`,
          });
        }
      }
    }
  }

  const packedPins = [];
  for (const [name, { manifest }] of packedByName) {
    for (const field of SHIPPED_DEP_FIELDS) {
      const spec = manifest[field]?.[ENGINE_PACKAGE];
      if (typeof spec === 'string') packedPins.push({ pkg: name, spec });
    }
  }
  const sourcePin = { pkg: '@internal/cli', spec: readSourcePin() };
  for (const violation of findEnginePinViolations({ packedPins, sourcePin })) {
    findings.push({
      check: 'engine-pin',
      kind: violation.kind,
      subject: ENGINE_PACKAGE,
      summary: violation.message,
    });
  }

  return report({ findings, json, stdoutWrite, stderrWrite });
}

function report({ findings, json, stdoutWrite, stderrWrite }) {
  if (json) {
    stdoutWrite(`${JSON.stringify({ ok: findings.length === 0, findings }, null, 2)}\n`);
  } else if (findings.length === 0) {
    stderrWrite(
      '\nOK — packed output imports only declared packages, the shipped orm validator\n' +
        `     survives the hostile corpus, the ${TOOLCHAIN_PACKAGE} tarball installs\n` +
        `     clean and its bins start, and every ${ENGINE_PACKAGE} pin agrees.\n`,
    );
  } else {
    stderrWrite(`\nFAIL — ${findings.length} conformance finding(s):\n`);
    for (const f of findings) {
      stderrWrite(`\n  [${f.check}/${f.kind}] ${f.subject}${f.file ? ` (${f.file})` : ''}\n`);
      stderrWrite(`    ${f.summary}\n`);
      if (f.detail) {
        stderrWrite(
          `${f.detail
            .split('\n')
            .map((line) => `    ${line}`)
            .join('\n')}\n`,
        );
      }
    }
  }
  return findings.length === 0 ? 0 : 1;
}

export async function main() {
  return runCheck();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(await main());
}
