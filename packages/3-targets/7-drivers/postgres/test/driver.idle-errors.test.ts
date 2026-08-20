import type { PoolConfig } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const poolInstances: InstanceType<typeof import('pg').Pool>[] = [];

vi.mock('pg', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pg')>();
  class RecordingPool extends actual.Pool {
    constructor(config?: PoolConfig) {
      super(config);
      poolInstances.push(this);
    }
  }
  return { ...actual, Pool: RecordingPool };
});

import { Client, Pool } from 'pg';
import postgresRuntimeDriverDescriptor from '../src/exports/runtime';
import { suppressIdleConnectionErrors } from '../src/idle-connection-errors';

beforeEach(() => {
  poolInstances.length = 0;
});

describe('suppressIdleConnectionErrors', () => {
  it('a Pool with no error listener rethrows an emitted idle-connection error (the failure mode)', () => {
    const pool = new Pool({ connectionString: 'postgres://localhost:5432/db' });
    expect(() => pool.emit('error', new Error('idle client lost connection'))).toThrow(
      'idle client lost connection',
    );
  });

  it('an attached Pool survives an emitted idle-connection error', () => {
    const pool = suppressIdleConnectionErrors(
      new Pool({ connectionString: 'postgres://localhost:5432/db' }),
    );
    expect(() => pool.emit('error', new Error('idle client lost connection'))).not.toThrow();
  });

  it('an attached Client survives an emitted connection error', () => {
    const client = suppressIdleConnectionErrors(
      new Client({ connectionString: 'postgres://localhost:5432/db' }),
    );
    expect(() =>
      client.emit('error', new Error('connection terminated unexpectedly')),
    ).not.toThrow();
  });

  it('returns the same instance it was given', () => {
    const pool = new Pool({ connectionString: 'postgres://localhost:5432/db' });
    expect(suppressIdleConnectionErrors(pool)).toBe(pool);
  });
});

describe('url binding', () => {
  it('the pool created for a url binding survives an emitted idle-connection error', async () => {
    const driver = postgresRuntimeDriverDescriptor.create();
    await driver.connect({ kind: 'url', url: 'postgres://localhost:5432/db' });

    const pool = poolInstances.at(-1);
    expect(pool).toBeDefined();
    expect(() => pool?.emit('error', new Error('idle client lost connection'))).not.toThrow();

    await driver.close();
  });
});
