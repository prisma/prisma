import { describe, expect, it } from 'vitest';
import { createTestSqlNamespace } from '../../../1-core/contract/test/test-support';
import { interpretPslDocumentToSqlContract } from '../src/interpreter';
import {
  createBuiltinLikeControlMutationDefaults,
  postgresScalarTypeDescriptors,
  postgresTarget,
  symbolTableInputFromParseArgs,
  testEnumEntityContributions,
} from './fixtures';
import { sqlStorageFromSuccessfulSqlInterpretation } from './interpret-sql-contract-storage';
import { unboundTables } from './unbound-tables';

describe('index naming at PSL lowering', () => {
  const builtinControlMutationDefaults = createBuiltinLikeControlMutationDefaults();

  function interpret(schema: string) {
    const document = symbolTableInputFromParseArgs({ schema, sourceId: 'schema.prisma' });
    return interpretPslDocumentToSqlContract({
      ...document,
      target: postgresTarget,
      scalarColumnDescriptors: postgresScalarTypeDescriptors,
      authoringContributions: { entityTypes: testEnumEntityContributions, type: {}, field: {} },
      composedExtensionContracts: new Map(),
      controlMutationDefaults: builtinControlMutationDefaults,
      createNamespace: createTestSqlNamespace,
      capabilities: { sql: { scalarList: true } },
    });
  }

  it('unnamed @@index lowers managed with the default prefix and a content-hash wire name', () => {
    const result = interpret(`model Doc {
  id Int @id
  body String
  @@index([body])
}`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const storage = sqlStorageFromSuccessfulSqlInterpretation(result.value);
    expect(unboundTables(storage)['doc']!.indexes).toEqual([
      {
        name: 'doc_body_idx_f3377346',
        prefix: 'doc_body_idx',
        columns: ['body'],
        unique: false,
      },
    ]);
  });

  it('@@index with map: lowers exact — the mapped name verbatim, no prefix, no hash', () => {
    const result = interpret(`model Doc {
  id Int @id
  body String
  @@index([body], map: "doc_body_lookup")
}`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const storage = sqlStorageFromSuccessfulSqlInterpretation(result.value);
    expect(unboundTables(storage)['doc']!.indexes).toEqual([
      {
        name: 'doc_body_lookup',
        columns: ['body'],
        unique: false,
      },
    ]);
  });
});
