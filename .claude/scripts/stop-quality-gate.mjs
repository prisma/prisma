#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';

const hook = JSON.parse(await text(process.stdin));
const cwd = hook.cwd;

const checks = [
  { name: 'tests', args: ['test:packages'] },
  { name: 'e2e', args: ['test:e2e'] },
  { name: 'typecheck', args: ['typecheck'] },
  { name: 'lint', args: ['lint'] },
];

const tmpDir = mkdtempSync(join(tmpdir(), 'quality-gate-'));
const failures = [];

for (const { name, args } of checks) {
  const stderrFile = join(tmpDir, `${name}.stderr`);
  const fd = openSync(stderrFile, 'w');
  try {
    execFileSync('pnpm', args, { cwd, stdio: ['ignore', 'ignore', fd], timeout: 300_000 });
  } catch {
    failures.push({ name, stderrFile });
  } finally {
    closeSync(fd);
  }
}

if (failures.length > 0) {
  const files = failures.map((f) => `- ${f.name}: ${f.stderrFile}`).join('\n');
  console.log(
    JSON.stringify({
      decision: 'block',
      reason: `Quality gate failed: ${failures.map((f) => f.name).join(', ')}. Read the stderr logs and fix the issues before finishing.\n\n${files}`,
    }),
  );
} else {
  rmSync(tmpDir, { recursive: true, force: true });
}
