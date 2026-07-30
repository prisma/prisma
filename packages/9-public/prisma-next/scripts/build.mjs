#!/usr/bin/env node
import { chmod, cp, rm, stat } from 'node:fs/promises';
import { resolve } from 'pathe';

const scriptDir = import.meta.dirname;
const cliDist = resolve(scriptDir, '../../../1-framework/3-tooling/cli/dist');
const shimDist = resolve(scriptDir, '../dist');

try {
  const s = await stat(cliDist);
  if (!s.isDirectory()) {
    throw new Error(`${cliDist} is not a directory`);
  }
} catch (err) {
  console.error(
    `[prisma-next build] CLI dist not found at ${cliDist}.\n` +
      'Run `pnpm -F @prisma-next/cli build` first, or let pnpm schedule the build via the ' +
      '`@prisma-next/cli` devDependency.',
  );
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

await rm(shimDist, { recursive: true, force: true });
await cp(cliDist, shimDist, { recursive: true });

// chmod the two executable entry points. cp preserves mode bits on most
// filesystems, but we re-apply 0o755 explicitly to defend against filesystems
// (e.g. some CI sandboxes, Windows-backed FAT/NTFS) that drop the execute bit.
await chmod(resolve(shimDist, 'cli.js'), 0o755);
await chmod(resolve(shimDist, 'cli.mjs'), 0o755);

console.log(`[prisma-next build] Copied ${cliDist} → ${shimDist}`);
