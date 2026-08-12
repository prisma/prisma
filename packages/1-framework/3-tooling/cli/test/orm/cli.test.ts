import type { HostProcess } from '@prisma/cli-engine';
import { describe, expect, it } from 'vitest';
import { createOrmCli, runOrmCli, stripConfigFlag } from '../../src/orm/cli';
import { ormCommandFamily } from '../../src/orm/family';

describe('stripConfigFlag', () => {
  it('takes the path from a separated --config and removes both tokens', () => {
    expect(stripConfigFlag(['migration', 'list', '--config', 'custom.ts', '--json'])).toEqual({
      argv: ['migration', 'list', '--json'],
      configPath: 'custom.ts',
    });
  });

  it('takes the path from an attached --config=<path>', () => {
    expect(stripConfigFlag(['--config=/abs/custom.ts', 'format'])).toEqual({
      argv: ['format'],
      configPath: '/abs/custom.ts',
    });
  });

  it('reports no path when the flag is absent', () => {
    expect(stripConfigFlag(['migration', 'list'])).toEqual({
      argv: ['migration', 'list'],
      configPath: undefined,
    });
  });

  it('keeps the last --config when it is given more than once', () => {
    expect(stripConfigFlag(['--config', 'a.ts', '--config', 'b.ts'])).toEqual({
      argv: [],
      configPath: 'b.ts',
    });
  });

  it('leaves a valueless trailing --config for the engine to reject', () => {
    expect(stripConfigFlag(['format', '--config'])).toEqual({
      argv: ['format', '--config'],
      configPath: undefined,
    });
  });

  it('treats everything after a bare -- as positionals', () => {
    expect(stripConfigFlag(['ref', 'set', '--', '--config', 'x.ts'])).toEqual({
      argv: ['ref', 'set', '--', '--config', 'x.ts'],
      configPath: undefined,
    });
  });

  it('leaves an empty --config= for the engine to reject rather than loading an empty path', () => {
    expect(stripConfigFlag(['--config=', 'format'])).toEqual({
      argv: ['--config=', 'format'],
      configPath: undefined,
    });
  });

  it('does not swallow the next flag as the config path', () => {
    expect(stripConfigFlag(['migration', 'list', '--config', '--json'])).toEqual({
      argv: ['migration', 'list', '--config', '--json'],
      configPath: undefined,
    });
  });

  it('still accepts a path that merely contains a dash', () => {
    expect(stripConfigFlag(['--config', 'my-app.config.ts'])).toEqual({
      argv: [],
      configPath: 'my-app.config.ts',
    });
  });
});

describe('the orm command family', () => {
  it('carries the orm config section', () => {
    expect(ormCommandFamily.configSection?.name).toBe('orm');
  });

  it('publishes a docs base the engine can append a code to', () => {
    expect(ormCommandFamily.docsBaseUrl?.endsWith('/')).toBe(true);
  });
});

describe('createOrmCli', () => {
  it('constructs without a collision, unknown group or reserved-flag violation', () => {
    expect(() => createOrmCli()).not.toThrow();
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
