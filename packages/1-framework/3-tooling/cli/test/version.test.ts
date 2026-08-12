import { spawnSync } from 'node:child_process';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';
import packageJson from '../package.json' with { type: 'json' };

const cliPath = join(import.meta.dirname, '../dist/cli.mjs');

describe('prisma-next --version', () => {
  it('--version prints the package.json version', () => {
    const result = spawnSync(process.execPath, [cliPath, '--version'], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(packageJson.version);
  });
});
