/**
 * Smoke coverage for the shipped bin as a real child process.
 *
 * Everything about command *behaviour* is asserted in-process through the
 * engine harness (`runOnEngine`, the cli-journeys suites, and the engine's own
 * suites under packages/1-framework/3-tooling/cli/test/orm). What only a
 * spawned process can prove is pinned here, once:
 *
 *  - the built bin starts on plain Node (no loader, no tsx),
 *  - argv reaches the engine and a real command runs to settlement,
 *  - a success exits 0 and writes its artifacts,
 *  - a failure settles as a structured envelope on stdout and a nonzero
 *    exit code that surfaces to the shell.
 *
 * The telemetry sender spawn is deliberately not pinned here: it depends on
 * consent state and a reachable backend, and its gating is covered in-process
 * by the engine's telemetry-reporting suite.
 */

import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { timeouts } from '@repo/test-utils';
import { join, resolve } from 'pathe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupIntegrationTestDirectoryFromFixtures } from './utils/cli-test-helpers';

const execFileAsync = promisify(execFile);

const BIN_PATH = resolve(
  import.meta.dirname,
  '../../../packages/1-framework/3-tooling/cli/dist/bin.mjs',
);

interface SpawnedRun {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function spawnBin(argv: readonly string[], cwd: string): Promise<SpawnedRun> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [BIN_PATH, ...argv], { cwd });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    if (typeof failed.code !== 'number') {
      throw error;
    }
    return { exitCode: failed.code, stdout: failed.stdout ?? '', stderr: failed.stderr ?? '' };
  }
}

/** The terminal frame of the bin's json stream — one NDJSON object per line. */
function settledFrame(stdout: string): unknown {
  const lines = stdout.split('\n').filter((line) => line.trim() !== '');
  const last = lines.at(-1);
  expect(last, `no json frames on stdout:\n${stdout}`).toBeDefined();
  return JSON.parse(last ?? '');
}

describe('shipped bin (process smoke)', () => {
  let setup: ReturnType<typeof setupIntegrationTestDirectoryFromFixtures>;

  beforeEach(() => {
    setup = setupIntegrationTestDirectoryFromFixtures('emit-command');
  });

  afterEach(() => {
    setup.cleanup();
  });

  it(
    'starts on plain Node, settles a real command, and exits 0 with artifacts written',
    async () => {
      const run = await spawnBin(
        ['orm', 'contract', 'emit', '--config', 'prisma.config.ts'],
        setup.testDir,
      );

      expect(run.exitCode, `stderr:\n${run.stderr}`).toBe(0);
      expect(existsSync(join(setup.outputDir, 'contract.json'))).toBe(true);
      expect(existsSync(join(setup.outputDir, 'contract.d.ts'))).toBe(true);

      const contractJson = JSON.parse(
        readFileSync(join(setup.outputDir, 'contract.json'), 'utf-8'),
      );
      expect(contractJson).toMatchObject({ targetFamily: 'sql', target: 'postgres' });
    },
    timeouts.spinUpDbServer,
  );

  it(
    'surfaces a structured failure as a settled envelope and a nonzero shell exit code',
    async () => {
      const run = await spawnBin(
        ['orm', 'contract', 'emit', '--config', 'missing.config.ts', '--json'],
        setup.testDir,
      );

      expect(run.exitCode).toBe(2);
      expect(settledFrame(run.stdout)).toMatchObject({
        kind: 'result',
        envelope: {
          ok: false,
          commandId: 'orm.contract.emit',
          error: { code: 'CONFIG.FILE_NOT_FOUND' },
        },
      });
    },
    timeouts.spinUpDbServer,
  );
});
