import {
  ColumnRef,
  ProjectionItem,
  SelectAst,
  TableSource,
} from '@internal/sql-relational-core/ast';
import type { SqlExecutionPlan, SqlQueryPlan } from '@internal/sql-relational-core/plan';
import { describe, expect, it, vi } from 'vitest';
import { executeQueryPlan } from '../src/execute-query-plan';

describe('execute query plan', () => {
  it('forwards SQL query plans to runtime.execute', () => {
    const execute = vi.fn();
    const executor = { execute };
    const plan: SqlQueryPlan<{ id: number }> = {
      ast: SelectAst.from(TableSource.named('users')).withProjection([
        ProjectionItem.of('id', ColumnRef.of('users', 'id')),
      ]),
      params: [],
      meta: {
        target: 'postgres',
        targetFamily: 'sql',
        storageHash: 'storage-hash',
        lane: 'orm-client',
      },
    };

    executeQueryPlan(executor, plan);

    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]?.[0]).toBe(plan);
  });

  it('also forwards already-lowered execution plans', () => {
    const execute = vi.fn();
    const executor = { execute };
    const plan: SqlExecutionPlan<{ id: number }> = {
      sql: 'select 1',
      params: [],
      ast: SelectAst.from(TableSource.named('stub')),
      meta: {
        target: 'postgres',
        targetFamily: 'sql',
        storageHash: 'storage-hash',
        lane: 'orm-client',
      },
    };

    executeQueryPlan(executor, plan);

    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]?.[0]).toBe(plan);
  });
});
