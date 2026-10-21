import type { Contract } from '@internal/contract/types';
import {
  type CodecControlHooks,
  type FieldEvent,
  planFieldEventOperations,
} from '@internal/family-sql/control';
import type { SqlStorage } from '@internal/sql-contract/types';
import { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import { describe, expect, it } from 'vitest';
import { emitted, SECOND, stack } from './fixture-generator';
import { fixtureTree } from './test-helpers';

const serializer = new PostgresContractSerializer();

function contractOf(json: string | undefined): Contract<SqlStorage> {
  return serializer.deserializeContract(JSON.parse(json ?? '{}'));
}

function codecIdsOf(contract: Contract<SqlStorage>): readonly string[] {
  return Object.values(contract.storage.namespaces).flatMap((namespace) =>
    Object.values(namespace.entries.table ?? {}).flatMap((table) =>
      Object.values(table.columns).map((column) => column.codecId),
    ),
  );
}

function fieldEvents(prior: Contract<SqlStorage>, next: Contract<SqlStorage>): readonly string[] {
  const calls: string[] = [];
  const hook: CodecControlHooks = {
    onFieldEvent: (event: FieldEvent, ctx) => {
      calls.push(`${event} ${ctx.tableName}.${ctx.fieldName}`);
      return [];
    },
  };
  planFieldEventOperations({
    priorContract: prior,
    newContract: next,
    codecHooks: new Map([...codecIdsOf(prior), ...codecIdsOf(next)].map((id) => [id, hook])),
    tableRenames: [],
    columnRenames: [],
    dataTypes: stack.dataTypes.lookup,
  });
  return calls;
}

describe('the field events between the snapshot the upgrade script wrote and a re-emit', () => {
  const after = fixtureTree('after');
  const head = JSON.parse(after['migrations/app/refs/head.json'] ?? '{}').hash;
  const upgraded = contractOf(after[`migrations/snapshots/${head}/contract.json`]);

  it('are none when the source is unchanged', async () => {
    expect(fieldEvents(upgraded, contractOf((await emitted(SECOND.psl)).json))).toEqual([]);
  });

  it("are 'altered' for each column whose alias changes its params", async () => {
    const widened = await emitted(SECOND.psl.replace('VarChar(64)', 'VarChar(80)'));
    expect(fieldEvents(upgraded, contractOf(widened.json))).toEqual([
      'altered post.slug',
      'altered post.title',
    ]);
  });
});
