import { describe, expect, it } from 'vitest';
import { createSqliteControlClient } from '../../src/exports/control';

describe('createSqliteControlClient', () => {
  it('returns a ControlClient with expected operations', () => {
    const client = createSqliteControlClient();

    expect(typeof client.dbInit).toBe('function');
    expect(typeof client.dbUpdate).toBe('function');
    expect(typeof client.dbVerify).toBe('function');
    expect(typeof client.connect).toBe('function');
  });

  it('accepts a connection option without throwing', () => {
    expect(() => createSqliteControlClient({ connection: 'path/to/db.sqlite' })).not.toThrow();
  });

  it('accepts no options without throwing', () => {
    expect(() => createSqliteControlClient()).not.toThrow();
  });
});
