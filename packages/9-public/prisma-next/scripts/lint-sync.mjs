#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'pathe';

const scriptDir = import.meta.dirname;
const shimPkgPath = resolve(scriptDir, '../package.json');
const cliPkgPath = resolve(scriptDir, '../../../1-framework/3-tooling/cli/package.json');

const SYNCED_FIELDS = ['version', 'bin', 'dependencies'];
const FORBIDDEN_SHIM_FIELDS = ['exports', 'main', 'types'];

const [shimPkg, cliPkg] = await Promise.all([readJson(shimPkgPath), readJson(cliPkgPath)]);

async function readJson(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.hasOwn(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

function diffEntries(cliValue, shimValue) {
  const cliObj = cliValue && typeof cliValue === 'object' ? cliValue : {};
  const shimObj = shimValue && typeof shimValue === 'object' ? shimValue : {};
  const allKeys = new Set([...Object.keys(cliObj), ...Object.keys(shimObj)]);
  const issues = [];
  for (const key of [...allKeys].sort()) {
    const inCli = Object.hasOwn(cliObj, key);
    const inShim = Object.hasOwn(shimObj, key);
    if (inCli && !inShim) {
      issues.push(`  + missing in shim: ${JSON.stringify(key)} = ${JSON.stringify(cliObj[key])}`);
    } else if (!inCli && inShim) {
      issues.push(`  - extra in shim:   ${JSON.stringify(key)} = ${JSON.stringify(shimObj[key])}`);
    } else if (!deepEqual(cliObj[key], shimObj[key])) {
      issues.push(
        `  ~ diverges:        ${JSON.stringify(key)}\n` +
          `      cli : ${JSON.stringify(cliObj[key])}\n` +
          `      shim: ${JSON.stringify(shimObj[key])}`,
      );
    }
  }
  return issues;
}

const drifts = [];

for (const field of FORBIDDEN_SHIM_FIELDS) {
  if (Object.hasOwn(shimPkg, field)) {
    drifts.push({
      field,
      summary:
        `  shim declares "${field}" but must not (shim is bin-only).\n` +
        `  remove the "${field}" field from the shim's package.json.`,
    });
  }
}

for (const field of SYNCED_FIELDS) {
  const cliValue = cliPkg[field];
  const shimValue = shimPkg[field];
  if (deepEqual(cliValue, shimValue)) continue;

  if (
    field === 'version' ||
    cliValue === undefined ||
    shimValue === undefined ||
    typeof cliValue !== 'object' ||
    typeof shimValue !== 'object'
  ) {
    drifts.push({
      field,
      summary: `  cli : ${JSON.stringify(cliValue)}\n` + `  shim: ${JSON.stringify(shimValue)}`,
    });
    continue;
  }

  drifts.push({ field, summary: diffEntries(cliValue, shimValue).join('\n') });
}

if (drifts.length === 0) {
  console.log('[prisma-next lint-sync] package.json in sync with @prisma-next/cli');
  process.exit(0);
}

console.error('[prisma-next lint-sync] package.json drift detected.');
console.error(
  'Update packages/9-public/prisma-next/package.json to match ' +
    '@prisma-next/cli for the following fields:\n',
);
for (const { field, summary } of drifts) {
  console.error(`- ${field}:`);
  console.error(summary);
  console.error('');
}
process.exit(1);
