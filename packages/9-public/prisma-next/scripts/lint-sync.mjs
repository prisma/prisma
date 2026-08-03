#!/usr/bin/env node
/**
 * ADR 211 drift-lint for the `prisma-next` bin shim.
 *
 * The shim is a launcher, not a copy: its only dependency is
 * `@prisma/orm-toolchain`, and its committed bin file delegates to the
 * toolchain's published CLI entrypoint. This lint fails when the shim
 * drifts from that shape — version out of lockstep, extra dependencies,
 * a bin that no longer delegates, or any import surface (`exports`,
 * `main`, `types`) appearing on a package that must stay bin-only.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'pathe';

const TOOLCHAIN = '@prisma/orm-toolchain';
const TOOLCHAIN_BIN_ENTRYPOINT = `${TOOLCHAIN}/bin/prisma-next`;
const LAUNCHER_PATH = './bin/prisma-next.mjs';

export function findShimDrift({ shimPkg, toolchainPkg, launcherSource }) {
  const drift = [];

  if (shimPkg.version !== toolchainPkg.version) {
    drift.push(
      `version out of lockstep: shim ${JSON.stringify(shimPkg.version)}, ` +
        `toolchain ${JSON.stringify(toolchainPkg.version)}`,
    );
  }

  const expectedDeps = { [TOOLCHAIN]: `workspace:${shimPkg.version}` };
  if (JSON.stringify(shimPkg.dependencies) !== JSON.stringify(expectedDeps)) {
    drift.push(
      `dependencies must be exactly ${JSON.stringify(expectedDeps)}, ` +
        `got ${JSON.stringify(shimPkg.dependencies)}`,
    );
  }

  for (const field of ['devDependencies', 'optionalDependencies']) {
    if (Object.hasOwn(shimPkg, field)) {
      drift.push(`"${field}" must not be present; the shim depends only on ${TOOLCHAIN}`);
    }
  }

  const expectedBin = { 'prisma-next': LAUNCHER_PATH };
  if (JSON.stringify(shimPkg.bin) !== JSON.stringify(expectedBin)) {
    drift.push(
      `bin must be exactly ${JSON.stringify(expectedBin)}, got ${JSON.stringify(shimPkg.bin)}`,
    );
  }

  if (!launcherSource.includes(`'${TOOLCHAIN_BIN_ENTRYPOINT}'`)) {
    drift.push(`launcher ${LAUNCHER_PATH} must import '${TOOLCHAIN_BIN_ENTRYPOINT}'`);
  }

  if (!Object.hasOwn(toolchainPkg.exports ?? {}, './bin/prisma-next')) {
    drift.push(`${TOOLCHAIN} no longer exports "./bin/prisma-next"; the launcher cannot resolve`);
  }

  for (const field of ['exports', 'main', 'types']) {
    if (Object.hasOwn(shimPkg, field)) {
      drift.push(`"${field}" must not be present; the shim is bin-only (ADR 211)`);
    }
  }

  if (JSON.stringify(shimPkg.files) !== JSON.stringify(['bin'])) {
    drift.push(`files must be exactly ["bin"], got ${JSON.stringify(shimPkg.files)}`);
  }

  return drift;
}

async function main() {
  const shimDir = resolve(import.meta.dirname, '..');
  const [shimPkg, toolchainPkg, launcherSource] = await Promise.all([
    readFile(resolve(shimDir, 'package.json'), 'utf8').then(JSON.parse),
    readFile(resolve(shimDir, '../@prisma/orm-toolchain/package.json'), 'utf8').then(JSON.parse),
    readFile(resolve(shimDir, 'bin/prisma-next.mjs'), 'utf8'),
  ]);

  const drift = findShimDrift({ shimPkg, toolchainPkg, launcherSource });
  if (drift.length === 0) {
    console.log(`[prisma-next lint-sync] shim delegates to ${TOOLCHAIN} and is in lockstep`);
    return 0;
  }
  console.error('[prisma-next lint-sync] shim drift detected:');
  for (const d of drift) console.error(`- ${d}`);
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(await main());
}
