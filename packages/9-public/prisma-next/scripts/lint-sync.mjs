#!/usr/bin/env node
// The shim's invariants (ADR 211, as amended by ADR 242).
//
// The shim used to carry a verbatim copy of `@prisma-next/cli`'s dist, and
// this lint asserted its manifest mirrored the CLI's so the copy's imports
// resolved. The CLI is private now and the shim launches
// `@prisma/orm-toolchain`'s published copy instead, so the mirror it has to
// hold is a different and much smaller one:
//
//   - it depends on the toolchain and on nothing else, at the exact
//     lockstep version — a second dependency would be a second thing the
//     shim could disagree with the toolchain about;
//   - it offers the same commands the toolchain does, so installing the
//     shim and installing the toolchain put the same names on `PATH`;
//   - the specifier its launcher imports is a real entrypoint of the
//     toolchain, because nothing else checks that a published bin resolves;
//   - it declares no `exports`, `main`, or `types`. The shim is an install
//     vehicle for the command, never an import target: `import 'prisma-next'`
//     is a hard resolution failure and stays one.

import { readFile } from 'node:fs/promises';
import { resolve } from 'pathe';

const scriptDir = import.meta.dirname;
const shimDir = resolve(scriptDir, '..');
const toolchainDir = resolve(shimDir, '../@prisma/orm-toolchain');

/** The one package the shim may depend on: the published home of the CLI. */
const TOOLCHAIN = '@prisma/orm-toolchain';

/** What the shim's bin file must import, and what the toolchain must export. */
const LAUNCHER_SPECIFIER = `${TOOLCHAIN}/bin/prisma-next`;

const FORBIDDEN_SHIM_FIELDS = ['exports', 'main', 'types'];

const [shimPkg, toolchainPkg] = await Promise.all([
  readJson(resolve(shimDir, 'package.json')),
  readJson(resolve(toolchainDir, 'package.json')),
]);

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

const drifts = [];

function report(field, summary) {
  drifts.push({ field, summary });
}

for (const field of FORBIDDEN_SHIM_FIELDS) {
  if (Object.hasOwn(shimPkg, field)) {
    report(
      field,
      `  shim declares "${field}" but must not (shim is bin-only).\n` +
        `  remove the "${field}" field from the shim's package.json.`,
    );
  }
}

if (shimPkg.version !== toolchainPkg.version) {
  report(
    'version',
    `  toolchain: ${JSON.stringify(toolchainPkg.version)}\n` +
      `  shim     : ${JSON.stringify(shimPkg.version)}`,
  );
}

const expectedDeps = { [TOOLCHAIN]: `workspace:${toolchainPkg.version}` };
const actualDeps = shimPkg.dependencies ?? {};
for (const [name, spec] of Object.entries(expectedDeps)) {
  if (actualDeps[name] !== spec) {
    report(
      'dependencies',
      `  expected ${JSON.stringify(name)} = ${JSON.stringify(spec)}, got ${JSON.stringify(actualDeps[name])}`,
    );
  }
}
for (const name of Object.keys(actualDeps)) {
  if (!Object.hasOwn(expectedDeps, name)) {
    report(
      'dependencies',
      `  extra dependency ${JSON.stringify(name)}: the shim launches ${TOOLCHAIN} and\n` +
        '  needs nothing else at run time.',
    );
  }
}

for (const name of Object.keys(shimPkg.devDependencies ?? {})) {
  report(
    'devDependencies',
    `  ${JSON.stringify(name)} would ship in the published manifest naming a package\n` +
      '  that is not on the registry. The shim builds from a template string; it\n' +
      '  needs no workspace package to do it.',
  );
}

const shimBins = Object.keys(shimPkg.bin ?? {}).sort();
const toolchainBins = Object.keys(toolchainPkg.bin ?? {}).sort();
if (shimBins.join(',') !== toolchainBins.join(',')) {
  report(
    'bin',
    `  toolchain: ${JSON.stringify(toolchainBins)}\n` + `  shim     : ${JSON.stringify(shimBins)}`,
  );
}

const toolchainExports = toolchainPkg.exports ?? {};
if (!Object.hasOwn(toolchainExports, './bin/prisma-next')) {
  report(
    'launcher',
    `  ${TOOLCHAIN} does not export "./bin/prisma-next", so the shim's command\n` +
      '  would fail at run time for everyone who installs it.',
  );
}

const binFile = shimPkg.bin?.['prisma-next'];
if (typeof binFile === 'string') {
  let source = '';
  try {
    source = await readFile(resolve(shimDir, binFile), 'utf8');
  } catch {
    // The dist is a build output; nothing to check before the first build.
    source = '';
  }
  if (source !== '' && !source.includes(LAUNCHER_SPECIFIER)) {
    report(
      'launcher',
      `  ${binFile} does not import ${JSON.stringify(LAUNCHER_SPECIFIER)}.\n` +
        '  Rebuild the shim (scripts/build.mjs writes it).',
    );
  }
}

if (drifts.length === 0) {
  console.log(`[prisma-next lint-sync] shim launches ${TOOLCHAIN} and declares nothing else`);
  process.exit(0);
}

console.error('[prisma-next lint-sync] shim invariants violated.');
console.error(
  `Update packages/9-public/prisma-next/package.json against ${TOOLCHAIN} ` +
    'for the following:\n',
);
for (const { field, summary } of drifts) {
  console.error(`- ${field}:`);
  console.error(summary);
  console.error('');
}
process.exit(1);
