import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const CLI_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/cli.mjs');

describe('removed verb redirects', () => {
  it('removed `apply` subverb under `migration` redirects to `migrate --to`', async () => {
    try {
      await execFileAsync('node', [CLI_PATH, 'migration', 'apply'], {
        timeout: 5000,
      });
      expect.unreachable('should have exited with non-zero');
    } catch (error) {
      const err = error as { code?: number; stderr?: string };
      expect(err.code).toBe(2);
      expect(err.stderr).toContain('prisma-next migrate --to <contract>');
    }
  });

  it('removed `apply` subverb with flags still redirects to `migrate --to`', async () => {
    try {
      await execFileAsync('node', [CLI_PATH, 'migration', 'apply', '--to', 'production'], {
        timeout: 5000,
      });
      expect.unreachable('should have exited with non-zero');
    } catch (error) {
      const err = error as { code?: number; stderr?: string };
      expect(err.code).toBe(2);
      expect(err.stderr).toContain('prisma-next migrate --to <contract>');
    }
  });

  it('removed `ref set` under `migration` redirects to top-level `ref set`', async () => {
    try {
      await execFileAsync('node', [CLI_PATH, 'migration', 'ref', 'set', 'prod', 'abc'], {
        timeout: 5000,
      });
      expect.unreachable('should have exited with non-zero');
    } catch (error) {
      const err = error as { code?: number; stderr?: string };
      expect(err.code).toBe(2);
      expect(err.stderr).toContain('prisma-next ref set|list|delete');
    }
  });

  it('removed `ref` namespace under `migration` redirects to top-level `ref`', async () => {
    try {
      await execFileAsync('node', [CLI_PATH, 'migration', 'ref'], {
        timeout: 5000,
      });
      expect.unreachable('should have exited with non-zero');
    } catch (error) {
      const err = error as { code?: number; stderr?: string };
      expect(err.code).toBe(2);
      expect(err.stderr).toContain('prisma-next ref set|list|delete');
    }
  });

  it('rejects removed `--graph` flag on `migration list`', async () => {
    try {
      await execFileAsync('node', [CLI_PATH, 'migration', 'list', '--graph'], {
        timeout: 5000,
      });
      expect.unreachable('should have exited with non-zero');
    } catch (error) {
      const err = error as { code?: number; stderr?: string };
      expect(err.code).toBe(1);
      expect(err.stderr).toMatch(/unknown option.*--graph/i);
    }
  });

  it('removed `--graph` flag on `migration status` redirects to `migration graph`', async () => {
    try {
      await execFileAsync('node', [CLI_PATH, 'migration', 'status', '--graph'], {
        timeout: 5000,
      });
      expect.unreachable('should have exited with non-zero');
    } catch (error) {
      const err = error as { code?: number; stderr?: string };
      expect(err.code).toBe(2);
      expect(err.stderr).toContain('migration graph');
    }
  });

  it('removed `--all` flag on `migration status` redirects to `migration log`', async () => {
    try {
      await execFileAsync('node', [CLI_PATH, 'migration', 'status', '--all'], {
        timeout: 5000,
      });
      expect.unreachable('should have exited with non-zero');
    } catch (error) {
      const err = error as { code?: number; stderr?: string };
      expect(err.code).toBe(2);
      expect(err.stderr).toContain('migration log');
    }
  });

  it('removed `--ref` flag on `migration status` redirects to `--to`', async () => {
    try {
      await execFileAsync('node', [CLI_PATH, 'migration', 'status', '--ref', 'prod'], {
        timeout: 5000,
      });
      expect.unreachable('should have exited with non-zero');
    } catch (error) {
      const err = error as { code?: number; stderr?: string };
      expect(err.code).toBe(2);
      expect(err.stderr).toContain('--to');
    }
  });
});
