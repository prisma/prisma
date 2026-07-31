import { SqlSchemaVerifierBase } from '@internal/family-sql/ir';
import { describe, expect, it } from 'vitest';
import { PostgresSchemaVerifier } from '../src/core/postgres-schema-verifier';

describe('PostgresSchemaVerifier', () => {
  it('extends SqlSchemaVerifierBase', () => {
    const verifier = new PostgresSchemaVerifier();
    expect(verifier).toBeInstanceOf(SqlSchemaVerifierBase);
  });
});
