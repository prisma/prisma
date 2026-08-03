import { SqlSchemaVerifierBase } from '@internal/family-sql/ir';
import { describe, expect, it } from 'vitest';
import { SqliteSchemaVerifier } from '../src/core/sqlite-schema-verifier';

describe('SqliteSchemaVerifier', () => {
  it('extends SqlSchemaVerifierBase', () => {
    const verifier = new SqliteSchemaVerifier();
    expect(verifier).toBeInstanceOf(SqlSchemaVerifierBase);
  });
});
