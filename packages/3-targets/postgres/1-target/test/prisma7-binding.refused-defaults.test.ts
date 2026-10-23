import { describe, expect, it } from 'vitest';
import { prisma7PostgresBinding } from '../src/core/prisma7-binding';

const column = (dataType: string, typeParams?: Record<string, unknown>) => ({
  codecId: 'test@1',
  dataType,
  ...(typeParams === undefined ? {} : { typeParams }),
});

describe('the default the Postgres binding writes for values a codec refuses', () => {
  it('is a quoted literal cast to the column type, for one value', () => {
    expect(
      prisma7PostgresBinding.refusedLiteralDefault(
        '2024-01-02T03:04:05.123456',
        column('pg/timestamp', { precision: 6 }),
      ),
    ).toBe("'2024-01-02T03:04:05.123456'::timestamp(6)");
  });

  it('is an array of quoted literals cast to an array of the column type, for a list', () => {
    expect(
      prisma7PostgresBinding.refusedLiteralDefault(
        ['2024-01-02T03:04:05.123456Z', null],
        column('pg/timestamptz'),
      ),
    ).toBe("ARRAY['2024-01-02T03:04:05.123456Z', NULL]::timestamptz[]");
  });

  it('escapes a quote in the value', () => {
    expect(prisma7PostgresBinding.refusedLiteralDefault("it's", column('pg/text'))).toBe(
      "'it''s'::text",
    );
  });
});
