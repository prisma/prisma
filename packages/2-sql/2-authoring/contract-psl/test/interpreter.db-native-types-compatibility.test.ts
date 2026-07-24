import { describe, expect, it } from 'vitest';
import { createTestSqlNamespace } from '../../../1-core/contract/test/test-support';
import { interpretPslDocumentToSqlContract } from '../src/interpreter';
import {
  createBuiltinLikeControlMutationDefaults,
  documentScopedTypes,
  postgresNativeScalarTypeDescriptors,
  postgresScalarAuthoringTypes,
  postgresTarget,
  symbolTableInputFromParseArgs,
} from './fixtures';

const baseInput = {
  target: postgresTarget,
  scalarColumnDescriptors: postgresNativeScalarTypeDescriptors,
  authoringContributions: { type: postgresScalarAuthoringTypes },
  composedExtensionContracts: new Map(),
  createNamespace: createTestSqlNamespace,
  capabilities: { sql: { scalarList: true } },
  controlMutationDefaults: createBuiltinLikeControlMutationDefaults(),
} as const;

describe('legacy db native type compatibility', () => {
  it('preserves storage descriptors while repository consumers migrate to type constructors', () => {
    const document = symbolTableInputFromParseArgs({
      schema: `types {
  Id          = String   @db.Uuid
  Slug        = String   @db.VarChar(191)
  Amount      = Decimal  @db.Numeric(10, 2)
  OccurredAt  = DateTime @db.Timestamp(3)
  PublishedAt = DateTime @db.Timestamptz
  PublishDay  = DateTime @db.Date
}

model Event {
  id          Id @id
  slug        Slug
  amount      Amount
  occurredAt  OccurredAt
  publishedAt PublishedAt
  publishDay  PublishDay
}
`,
      sourceId: 'schema.prisma',
    });

    const result = interpretPslDocumentToSqlContract({ ...baseInput, ...document });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(documentScopedTypes(result.value)).toEqual({
      Id: {
        kind: 'codec-instance',
        codecId: 'pg/uuid@1',
        nativeType: 'uuid',
        typeParams: {},
      },
      Slug: {
        kind: 'codec-instance',
        codecId: 'sql/varchar@1',
        nativeType: 'character varying',
        typeParams: { length: 191 },
      },
      Amount: {
        kind: 'codec-instance',
        codecId: 'pg/numeric@1',
        nativeType: 'numeric',
        typeParams: { precision: 10, scale: 2 },
      },
      OccurredAt: {
        kind: 'codec-instance',
        codecId: 'pg/timestamp@1',
        nativeType: 'timestamp',
        typeParams: { precision: 3 },
      },
      PublishedAt: {
        kind: 'codec-instance',
        codecId: 'pg/timestamptz@1',
        nativeType: 'timestamptz',
        typeParams: {},
      },
      PublishDay: {
        kind: 'codec-instance',
        codecId: 'pg/date@1',
        nativeType: 'date',
        typeParams: {},
      },
    });
  });

  it('diagnoses invalid legacy native type arguments', () => {
    const document = symbolTableInputFromParseArgs({
      schema: `types {
  WrongBase = Int     @db.VarChar(10)
  TooLong   = String  @db.Char(1, 2)
  BadScale  = Decimal @db.Numeric(10, -1)
  UuidArgs  = String  @db.Uuid(4)
  Duplicate = String  @db.VarChar(10) @db.Char(2)
  Unknown   = String  @db.Unknown
}

model Event {
  id Int @id
}
`,
      sourceId: 'schema.prisma',
    });

    const result = interpretPslDocumentToSqlContract({ ...baseInput, ...document });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
          message:
            'Named type "WrongBase" uses @db.VarChar on unsupported base type "Int". Expected "String".',
        }),
        expect.objectContaining({
          code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
          message: 'Named type "TooLong" @db.Char accepts zero or one positional integer argument.',
        }),
        expect.objectContaining({
          code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
          message: 'Named type "BadScale" @db.Numeric requires a non-negative integer scale.',
        }),
        expect.objectContaining({
          code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
          message: 'Named type "UuidArgs" @db.Uuid does not accept arguments.',
        }),
        expect.objectContaining({
          code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
          message: 'Named type "Duplicate" can declare at most one @db.* attribute',
        }),
        expect.objectContaining({
          code: 'PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE',
          message: 'Named type "Unknown" uses unsupported attribute "@db.Unknown"',
        }),
      ]),
    );
  });
});
