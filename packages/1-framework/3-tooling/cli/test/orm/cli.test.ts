import { describe, expect, it } from 'vitest';
import { createOrmCli, stripConfigFlag } from '../../src/orm/cli';
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
