import { isPgPool } from '@internal/postgres/runtime';
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

function duckPool(): Pool {
  return {
    connect() {},
    query() {},
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  } as unknown as Pool;
}

describe('isPgPool via @internal/postgres/runtime', () => {
  it('is true for a duck-typed pool that is not an instance of any local Pool class', () => {
    expect(isPgPool(duckPool())).toBe(true);
  });
});
