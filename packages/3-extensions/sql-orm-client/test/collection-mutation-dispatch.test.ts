import {
  LiteralExpr,
  ProjectionItem,
  SelectAst,
  TableSource,
} from '@internal/sql-relational-core/ast';
import type { SqlQueryPlan } from '@internal/sql-relational-core/plan';
import { describe, expect, it } from 'vitest';
import {
  dispatchMutationRows,
  dispatchSplitMutationRows,
  executeMutationReturningSingleRow,
} from '../src/collection-mutation-dispatch';
import { buildTestContextFromContract, createMockRuntime, getTestContract } from './helpers';

// These helpers own the no-include mutation read-back: execute the
// `RETURNING` plan, map storage rows to model fields, and strip hidden
// columns. The include read-back is reloaded through the read path
// (`reloadMutationRowsByIdentities`) and is exercised end-to-end in the
// `mutation-include-readback` integration suite, not here.

function makeCompiled(sqlText = 'select 1'): SqlQueryPlan<Record<string, unknown>> {
  return {
    ast: SelectAst.from(TableSource.named('users')).withProjection([
      ProjectionItem.of('_sql', LiteralExpr.of(sqlText)),
    ]),
    params: [],
    meta: {
      target: 'postgres',
      targetFamily: 'sql',
      storageHash: 'test',
      lane: 'orm-client',
    },
  };
}

describe('collection-mutation-dispatch', () => {
  it('dispatchMutationRows() maps rows and strips hidden fields', async () => {
    const contract = getTestContract();
    const context = buildTestContextFromContract(contract);
    const runtime = createMockRuntime();
    runtime.setNextResults([[{ id: 1, name: 'Alice', email: 'alice@example.com' }]]);

    const rows = await dispatchMutationRows<Record<string, unknown>>({
      context,
      runtime,
      compiled: makeCompiled('insert into users ... returning *'),
      tableName: 'users',
      namespaceId: 'public',
      modelName: 'User',
      includes: [],
      selectedFields: undefined,
      hiddenColumns: ['email'],
      mapRow: (mapped) => mapped,
    }).toArray();

    expect(rows).toEqual([{ id: 1, name: 'Alice' }]);
  });

  it('executeMutationReturningSingleRow() returns null when no rows are returned', async () => {
    const contract = getTestContract();
    const context = buildTestContextFromContract(contract);
    const runtime = createMockRuntime();
    runtime.setNextResults([[]]);

    const result = await executeMutationReturningSingleRow<Record<string, unknown>>({
      context,
      runtime,
      compiled: makeCompiled('delete from users returning *'),
      tableName: 'users',
      namespaceId: 'public',
      modelName: 'User',
      includes: [],
      selectedFields: undefined,
      hiddenColumns: ['email'],
      mapRow: (mapped) => mapped,
      operation: 'delete',
      onMissingRowMessage: 'missing row',
    });

    expect(result).toBeNull();
  });

  it('executeMutationReturningSingleRow() strips hidden fields', async () => {
    const contract = getTestContract();
    const context = buildTestContextFromContract(contract);
    const runtime = createMockRuntime();
    runtime.setNextResults([[{ id: 1, name: 'Alice', email: 'alice@example.com' }]]);

    const result = await executeMutationReturningSingleRow<Record<string, unknown>>({
      context,
      runtime,
      compiled: makeCompiled('update users set ... returning *'),
      tableName: 'users',
      namespaceId: 'public',
      modelName: 'User',
      includes: [],
      selectedFields: undefined,
      hiddenColumns: ['email'],
      mapRow: (mapped) => mapped,
      operation: 'update',
      onMissingRowMessage: 'missing row',
    });

    expect(result).toEqual({ id: 1, name: 'Alice' });
  });

  describe('dispatchSplitMutationRows()', () => {
    it('maps rows from multiple plans', async () => {
      const contract = getTestContract();
      const context = buildTestContextFromContract(contract);
      const runtime = createMockRuntime();
      runtime.setNextResults([
        [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
        [{ id: 2, name: 'Bob', email: 'bob@example.com' }],
      ]);

      const rows = await dispatchSplitMutationRows<Record<string, unknown>>({
        context,
        runtime,
        plans: [makeCompiled('insert batch 1'), makeCompiled('insert batch 2')],
        tableName: 'users',
        namespaceId: 'public',
        modelName: 'User',
        includes: [],
        selectedFields: undefined,
        hiddenColumns: [],
        mapRow: (mapped) => mapped,
      }).toArray();

      expect(rows).toEqual([
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
      ]);
      expect(runtime.executions).toHaveLength(2);
    });

    it('strips hidden fields', async () => {
      const contract = getTestContract();
      const context = buildTestContextFromContract(contract);
      const runtime = createMockRuntime();
      runtime.setNextResults([[{ id: 1, name: 'Alice', email: 'alice@example.com' }]]);

      const rows = await dispatchSplitMutationRows<Record<string, unknown>>({
        context,
        runtime,
        plans: [makeCompiled('insert ...')],
        tableName: 'users',
        namespaceId: 'public',
        modelName: 'User',
        includes: [],
        selectedFields: undefined,
        hiddenColumns: ['email'],
        mapRow: (mapped) => mapped,
      }).toArray();

      expect(rows).toEqual([{ id: 1, name: 'Alice' }]);
    });

    it('yields nothing when all plans return empty', async () => {
      const contract = getTestContract();
      const context = buildTestContextFromContract(contract);
      const runtime = createMockRuntime();
      runtime.setNextResults([[], []]);

      const rows = await dispatchSplitMutationRows<Record<string, unknown>>({
        context,
        runtime,
        plans: [makeCompiled('insert batch 1'), makeCompiled('insert batch 2')],
        tableName: 'users',
        namespaceId: 'public',
        modelName: 'User',
        includes: [],
        selectedFields: undefined,
        hiddenColumns: [],
        mapRow: (mapped) => mapped,
      }).toArray();

      expect(rows).toEqual([]);
      expect(runtime.executions).toHaveLength(2);
    });
  });
});
