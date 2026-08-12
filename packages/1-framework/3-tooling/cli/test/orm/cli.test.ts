import type { HostProcess, LoadedConfig } from '@prisma/cli-engine';
import { createTestCli } from '@prisma/cli-engine/testing';
import { describe, expect, it } from 'vitest';
import { BIN_COMMANDS, BIN_GROUPS, createOrmCli, runOrmCli } from '../../src/orm/cli';
import { ormCommandFamily } from '../../src/orm/family';

function recordingLoader(): {
  readonly asked: string[];
  readonly loadConfig: (configPath?: string) => Promise<LoadedConfig>;
} {
  const asked: string[] = [];
  return {
    asked,
    loadConfig: (configPath) => {
      asked.push(configPath ?? '(none)');
      return Promise.resolve({
        path: configPath ?? 'prisma-next.config.ts',
        sections: {},
        diagnostics: [],
      });
    },
  };
}

function harness(loadConfig: (configPath?: string) => Promise<LoadedConfig>) {
  return createTestCli({
    commandFamilies: [ormCommandFamily],
    commands: BIN_COMMANDS,
    groups: BIN_GROUPS,
    loadConfig,
  });
}

describe('the --config flag', () => {
  it('hands the separated path to the loader', async () => {
    const loader = recordingLoader();

    await harness(loader.loadConfig).run(['migration', 'list', '--config', 'custom.ts']);

    expect(loader.asked).toEqual(['custom.ts']);
  });

  it('hands the attached --config=<path> to the loader', async () => {
    const loader = recordingLoader();

    await harness(loader.loadConfig).run(['migration', 'list', '--config=/abs/custom.ts']);

    expect(loader.asked).toEqual(['/abs/custom.ts']);
  });

  it('asks for the default file when no path is given', async () => {
    const loader = recordingLoader();

    await harness(loader.loadConfig).run(['migration', 'list']);

    expect(loader.asked).toEqual(['(none)']);
  });
});

describe('the orm command family', () => {
  it('carries the orm config section', () => {
    expect(ormCommandFamily.configSection?.name).toBe('orm');
  });

  it('publishes a docs base the engine can append a code to', () => {
    expect(ormCommandFamily.docsBaseUrl?.endsWith('/')).toBe(true);
  });

  it('retires the two removed verbs and the four removed status flags, naming the binary as {bin}', () => {
    expect(
      ormCommandFamily.redirects.map(({ from, flag, replacement }) => ({
        from,
        flag,
        replacement,
      })),
    ).toEqual([
      {
        from: 'migration apply',
        flag: undefined,
        replacement: '{bin} migrate --to <contract>',
      },
      { from: 'migration ref', flag: undefined, replacement: '{bin} ref set|list|delete' },
      { from: 'migration status', flag: 'graph', replacement: '{bin} migration graph' },
      { from: 'migration status', flag: 'all', replacement: '{bin} migration log --db <url>' },
      { from: 'migration status', flag: 'limit', replacement: '{bin} migration log --db <url>' },
      {
        from: 'migration status',
        flag: 'ref',
        replacement: '{bin} migration status --to <contract>',
      },
    ]);
  });
});

describe('createOrmCli', () => {
  it('constructs without a collision, unknown group or reserved-flag violation', () => {
    expect(() => createOrmCli()).not.toThrow();
  });
});

describe('a retired invocation', () => {
  it('is answered with its replacement rather than a spelling suggestion', async () => {
    const loader = recordingLoader();

    const run = await harness(loader.loadConfig).run(['migration', 'apply', '--json']);

    expect(run.exitCode).toBe(2);
    expect(run.json.at(-1)).toMatchObject({
      kind: 'result',
      envelope: {
        ok: false,
        error: {
          code: 'CLI.COMMAND_MOVED',
          summary: '`migration apply` has been replaced',
          why: 'Applying a migration is a move to a target contract, not a verb of its own.',
          nextActions: [
            {
              kind: 'run-command',
              label: 'Use the replacement',
              command: 'prisma-test migrate --to <contract>',
            },
          ],
        },
      },
    });
    expect(JSON.stringify(run.json)).not.toContain('Did you mean');
  });

  it('answers a retired status flag with the command that replaced it', async () => {
    const loader = recordingLoader();

    const run = await harness(loader.loadConfig).run(['migration', 'status', '--graph', '--json']);

    expect(run.exitCode).not.toBe(0);
    expect(run.json.at(-1)).toMatchObject({
      kind: 'result',
      envelope: {
        ok: false,
        error: { code: 'CLI.COMMAND_MOVED' },
        nextActions: [
          {
            kind: 'run-command',
            label: 'Use the replacement',
            command: 'prisma-test migration graph',
          },
        ],
      },
    });
  });
});

/**
 * A host process whose working directory has been unlinked: `process.cwd()`
 * throws ENOENT, which is the shape of every startup failure that happens
 * before the engine has a run to settle.
 */
function processWithUnreadableCwd(stderr: string[]): HostProcess {
  return {
    argv: ['node', 'prisma-next', 'migration', 'list'],
    env: {},
    cwd: () => {
      throw new Error('ENOENT: uv_cwd');
    },
    stdout: { write: () => true },
    stderr: { write: (text: string) => stderr.push(text) },
    stdin: { [Symbol.asyncIterator]: () => [][Symbol.iterator]() as never },
    on: () => undefined,
    off: () => undefined,
    exit: () => {
      throw new Error('exit must not be called');
    },
  };
}

describe('runOrmCli', () => {
  it('reports a startup failure as a structured line instead of a raw stack trace', async () => {
    const stderr: string[] = [];

    const code = await runOrmCli(processWithUnreadableCwd(stderr));

    expect(code).toBe(1);
    expect(stderr.join('')).toContain('[CLI.UNEXPECTED]');
    expect(stderr.join('')).toContain('ENOENT: uv_cwd');
  });

  it('does not let the failure escape as a rejection', async () => {
    await expect(runOrmCli(processWithUnreadableCwd([]))).resolves.toBeTypeOf('number');
  });
});
