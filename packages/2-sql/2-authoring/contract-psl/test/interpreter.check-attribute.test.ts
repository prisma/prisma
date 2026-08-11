import type { SqlStorage } from '@internal/sql-contract/types';
import { check, defineContract, field, model } from '@internal/sql-contract-ts/contract-builder';
import { describe, expect, it, vi } from 'vitest';
import { createTestSqlNamespace } from '../../../1-core/contract/test/test-support';
import { interpretPslDocumentToSqlContract } from '../src/interpreter';
import {
  createBuiltinLikeControlMutationDefaults,
  postgresScalarTypeDescriptors,
  postgresTarget,
  symbolTableInputFromParseArgs,
  testEnumEntityContributions,
} from './fixtures';

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

const sqlFamilyPack = {
  kind: 'family' as const,
  id: 'sql',
  familyId: 'sql' as const,
  version: '0.0.1',
};

const postgresTargetPack = {
  kind: 'target' as const,
  id: 'postgres',
  familyId: 'sql' as const,
  targetId: 'postgres' as const,
  version: '0.0.1',
  defaultNamespaceId: 'public',
};

const orderFields = {
  id: field.column({ codecId: 'pg/int4@1', nativeType: 'int4' }).id(),
  total: field.column({ codecId: 'pg/numeric@1', nativeType: 'numeric' }),
};

function orderTableOf(storage: SqlStorage) {
  return storage.namespaces['public']?.entries.table?.['order'];
}

describe('@@check PSL ↔ TS parity', () => {
  it('the name: form produces a contract byte-identical to the TS equivalent, including storageHash', () => {
    const pslResult = interpret(`
model Order {
  id    Int     @id
  total Decimal

  @@check(expression: "total > 0", name: "order_total_positive")
}
`);
    expect(pslResult.ok, pslResult.ok ? '' : JSON.stringify(pslResult.failure.diagnostics)).toBe(
      true,
    );
    if (!pslResult.ok) return;

    const tsContract = defineContract({
      family: sqlFamilyPack,
      target: postgresTargetPack,
      createNamespace: createTestSqlNamespace,
      models: {
        Order: model('Order', { fields: orderFields }).sql({
          table: 'order',
          checks: [check({ expression: 'total > 0', name: 'order_total_positive' })],
        }),
      },
    });

    const pslStorage = pslResult.value.storage as unknown as SqlStorage;
    const tsStorage = tsContract.storage as unknown as SqlStorage;
    const pslTable = orderTableOf(pslStorage);
    const tsTable = orderTableOf(tsStorage);

    expect(pslTable?.checks?.map((c) => c.name)).toEqual([
      expect.stringMatching(/^order_total_positive_[0-9a-f]{8}$/),
    ]);
    expect(pslTable?.checks).toEqual(tsTable?.checks);
    expect(pslTable).toEqual(tsTable);
    expect(pslStorage.storageHash).toEqual(tsStorage.storageHash);
  });

  it('the map: form produces a contract byte-identical to the TS equivalent, including storageHash', () => {
    const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
    try {
      const pslResult = interpret(`
model LegacyOrder {
  id    Int     @id
  total Decimal

  @@check(expression: "(total > (0)::numeric)", map: "positive_total")
}
`);
      expect(pslResult.ok, pslResult.ok ? '' : JSON.stringify(pslResult.failure.diagnostics)).toBe(
        true,
      );
      if (!pslResult.ok) return;

      const tsContract = defineContract({
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        models: {
          LegacyOrder: model('LegacyOrder', { fields: orderFields }).sql({
            table: 'legacyOrder',
            checks: [check({ expression: '(total > (0)::numeric)', map: 'positive_total' })],
          }),
        },
      });

      const pslStorage = pslResult.value.storage as unknown as SqlStorage;
      const tsStorage = tsContract.storage as unknown as SqlStorage;
      const pslTable = pslStorage.namespaces['public']?.entries.table?.['legacyOrder'];
      const tsTable = tsStorage.namespaces['public']?.entries.table?.['legacyOrder'];

      expect(pslTable?.checks).toEqual([
        { name: 'positive_total', expression: '(total > (0)::numeric)' },
      ]);
      expect(pslTable?.checks).toEqual(tsTable?.checks);
      expect(pslTable).toEqual(tsTable);
      expect(pslStorage.storageHash).toEqual(tsStorage.storageHash);
    } finally {
      emitWarning.mockRestore();
    }
  });

  it('multiple @@check attributes on one model all lower, byte-identical to the TS equivalent', () => {
    const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
    try {
      const pslResult = interpret(`
model Order {
  id    Int     @id
  total Decimal

  @@check(expression: "total > 0", name: "order_total_positive")
  @@check(expression: "(total > (0)::numeric)", map: "positive_total")
}
`);
      expect(pslResult.ok, pslResult.ok ? '' : JSON.stringify(pslResult.failure.diagnostics)).toBe(
        true,
      );
      if (!pslResult.ok) return;

      const tsContract = defineContract({
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        models: {
          Order: model('Order', { fields: orderFields }).sql({
            table: 'order',
            checks: [
              check({ expression: 'total > 0', name: 'order_total_positive' }),
              check({ expression: '(total > (0)::numeric)', map: 'positive_total' }),
            ],
          }),
        },
      });

      const pslStorage = pslResult.value.storage as unknown as SqlStorage;
      const tsStorage = tsContract.storage as unknown as SqlStorage;
      const pslTable = orderTableOf(pslStorage);
      const tsTable = orderTableOf(tsStorage);

      expect(pslTable?.checks).toHaveLength(2);
      expect(pslTable?.checks).toEqual(tsTable?.checks);
      expect(pslTable).toEqual(tsTable);
      expect(pslStorage.storageHash).toEqual(tsStorage.storageHash);
    } finally {
      emitWarning.mockRestore();
    }
  });
});

describe('@@check diagnostics', () => {
  function expectDiagnostic(schema: string, code: string, messagePattern: RegExp): void {
    const result = interpret(schema);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const match = result.failure.diagnostics.find(
      (d) => d.code === code && messagePattern.test(d.message),
    );
    expect(match).toBeDefined();
    expect(match?.span).toBeDefined();
  }

  it('rejects a check with neither name nor map', () => {
    expectDiagnostic(
      `
model Order {
  id    Int     @id
  total Decimal

  @@check(expression: "total > 0")
}
`,
      'PSL_CHECK_REQUIRES_NAME_OR_MAP',
      /requires a `name` or `map` argument/,
    );
  });

  it('rejects a check with both name and map', () => {
    expectDiagnostic(
      `
model Order {
  id    Int     @id
  total Decimal

  @@check(expression: "total > 0", name: "a", map: "b")
}
`,
      'PSL_CHECK_NAME_XOR_MAP',
      /takes at most one of `name` and `map`/,
    );
  });

  it('rejects an empty expression — raised by the shared lowering layer, not PSL', () => {
    expect(() =>
      interpret(`
model Order {
  id    Int     @id
  total Decimal

  @@check(expression: "", name: "order_total_positive")
}
`),
    ).toThrow(expect.objectContaining({ code: 'CONTRACT.ARGUMENT_INVALID' }));
  });
});
