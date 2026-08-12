import { describe, expect, it } from 'vitest';
import { createMongoControlClient } from '../../src/exports/control';

describe('createMongoControlClient', () => {
  it('returns a ControlClient with expected operations', () => {
    const client = createMongoControlClient();

    expect(typeof client.dbInit).toBe('function');
    expect(typeof client.dbUpdate).toBe('function');
    expect(typeof client.dbVerify).toBe('function');
    expect(typeof client.connect).toBe('function');
  });

  it('accepts a connection option without throwing', () => {
    expect(() =>
      createMongoControlClient({ connection: 'mongodb://localhost:27017/testdb' }),
    ).not.toThrow();
  });

  it('accepts no options without throwing', () => {
    expect(() => createMongoControlClient()).not.toThrow();
  });
});
