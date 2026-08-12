import type { StorageColumn } from '@internal/sql-contract/types';
import { describe, expect, it } from 'vitest';
import { renderDefaultLiteral } from '../../src/core/migrations/planner-ddl-builders';

function arrayColumn(nativeType: string): StorageColumn {
  return {
    nativeType,
    codecId: 'pg/text@1',
    nullable: false,
    many: true,
  } as StorageColumn;
}

describe('renderDefaultLiteral array columns', () => {
  it('renders an empty array default as the empty array literal', () => {
    expect(renderDefaultLiteral([], arrayColumn('text[]'))).toBe("'{}'");
  });

  it('renders a string array default as an ARRAY[...] expression', () => {
    expect(renderDefaultLiteral(['a', 'b'], arrayColumn('text[]'))).toBe("ARRAY['a', 'b']");
  });

  it('renders Date array elements as ISO timestamp literals, not JSON blobs', () => {
    const d = new Date('2026-01-02T03:04:05.000Z');
    expect(renderDefaultLiteral([d], arrayColumn('timestamptz[]'))).toBe(
      "ARRAY['2026-01-02T03:04:05.000Z']",
    );
  });

  it('renders a null literal default on a many column as NULL', () => {
    expect(renderDefaultLiteral(null, arrayColumn('text[]'))).toBe('NULL');
  });
});
