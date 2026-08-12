#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Thin launcher: run the TypeScript entrypoint through tsx so the playground
// needs no build step (mirrors apps/telemetry-backend's tsx-run convention).
const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, '../src/cli.ts');
const tsxBin = resolve(here, '../node_modules/.bin/tsx');

const child = spawn(tsxBin, [entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code) => process.exit(code ?? 0));
