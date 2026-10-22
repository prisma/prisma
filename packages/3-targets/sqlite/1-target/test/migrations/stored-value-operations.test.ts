import type { JsonValue } from '@internal/contract/types';
import type { SqlMigrationPlanOperation } from '@internal/family-sql/control';
import { describe, expect, it } from 'vitest';
import { RemoveValueCall, ReplaceValueCall } from '../../src/core/migrations/op-factory-call';
import { removeValue, replaceValue } from '../../src/core/migrations/operations/stored-values';
import type { SqlitePlanTargetDetails } from '../../src/core/migrations/planner-target-details';
import { SqliteMigration } from '../../src/core/migrations/sqlite-migration';
import type { Contract } from '../fixtures/sqlite-contract.d';
import contractJson from '../fixtures/sqlite-contract.json' with { type: 'json' };

type Op = SqlMigrationPlanOperation<SqlitePlanTargetDetails>;

const target = {
  id: 'sqlite',
  details: { schema: 'main', objectType: 'column', name: 'state', table: 'task' },
};

describe('replaceValue', () => {
  it('changes the value in the rows that hold it, and checks afterwards that none does', () => {
    expect(replaceValue('task', 'state', 'ARCHIVED', 'RETIRED')).toEqual({
      id: 'replaceValue.task.state.ARCHIVED',
      label: 'Replace value "ARCHIVED" with "RETIRED" in column "state" of "task"',
      operationClass: 'widening',
      target,
      precheck: [],
      execute: [
        {
          description: 'replace value "ARCHIVED" with "RETIRED" in column "state"',
          sql: 'UPDATE "task" SET "state" = ?2 WHERE "state" = ?1',
          params: ['ARCHIVED', 'RETIRED'],
        },
      ],
      postcheck: [
        {
          description: 'verify no row of "task" holds value "ARCHIVED" in column "state"',
          sql: 'SELECT NOT EXISTS (SELECT 1 FROM "task" WHERE "state" = ?1) AS result',
          params: ['ARCHIVED'],
        },
      ],
    });
  });

  it('passes a value with a quote in it as a parameter, never in the SQL text', () => {
    const op = replaceValue('task', 'state', "it's", 'it"s');

    expect([...op.execute, ...op.postcheck].map((step) => step.sql).join('\n')).not.toMatch(
      /it's|it"s/,
    );
    expect(op.execute[0]?.params).toEqual(["it's", 'it"s']);
  });
});

describe('removeValue', () => {
  it('sets the value to NULL in the rows that hold it', () => {
    expect(removeValue('task', 'state', 3)).toEqual({
      id: 'removeValue.task.state.3',
      label: 'Remove value 3 from column "state" of "task"',
      operationClass: 'destructive',
      target,
      precheck: [],
      execute: [
        {
          description: 'remove value 3 from column "state"',
          sql: 'UPDATE "task" SET "state" = NULL WHERE "state" = ?1',
          params: [3],
        },
      ],
      postcheck: [
        {
          description: 'verify no row of "task" holds value 3 in column "state"',
          sql: 'SELECT NOT EXISTS (SELECT 1 FROM "task" WHERE "state" = ?1) AS result',
          params: [3],
        },
      ],
    });
  });
});

describe('stored value calls', () => {
  const replace = new ReplaceValueCall('task', 'state', 'ARCHIVED', 'RETIRED');
  const remove = new RemoveValueCall('task', 'state', 3);

  it('are named after their facade methods and classed by their effect', () => {
    expect(replace).toMatchObject({
      factoryName: 'replaceValue',
      operationClass: 'widening',
      label: 'Replace value "ARCHIVED" with "RETIRED" in column "state" of "task"',
    });
    expect(remove).toMatchObject({
      factoryName: 'removeValue',
      operationClass: 'destructive',
      label: 'Remove value 3 from column "state" of "task"',
    });
  });

  it('lower to the operations their factories build', async () => {
    expect(await replace.toOp()).toEqual(replaceValue('task', 'state', 'ARCHIVED', 'RETIRED'));
    expect(await remove.toOp()).toEqual(removeValue('task', 'state', 3));
  });

  it('render the facade call, with no import', () => {
    expect(replace.renderTypeScript()).toBe(
      'this.replaceValue({ table: "task", column: "state", from: "ARCHIVED", to: "RETIRED" })',
    );
    expect(remove.renderTypeScript()).toBe(
      'this.removeValue({ table: "task", column: "state", value: 3 })',
    );
    expect(replace.importRequirements()).toEqual([]);
    expect(remove.importRequirements()).toEqual([]);
  });
});

class ExposedMigration extends SqliteMigration<Contract, Contract> {
  override readonly endContractJson = contractJson;
  override get operations() {
    return [];
  }

  callReplaceValue(options: {
    readonly table: string;
    readonly column: string;
    readonly from: JsonValue;
    readonly to: JsonValue;
  }): Promise<Op> {
    return this.replaceValue(options);
  }

  callRemoveValue(options: {
    readonly table: string;
    readonly column: string;
    readonly value: JsonValue;
  }): Promise<Op> {
    return this.removeValue(options);
  }
}

describe('SqliteMigration replaceValue and removeValue', () => {
  it('give the operations their calls give, with no control stack', async () => {
    expect(
      await new ExposedMigration().callReplaceValue({
        table: 'task',
        column: 'state',
        from: 'a',
        to: 'b',
      }),
    ).toEqual(await new ReplaceValueCall('task', 'state', 'a', 'b').toOp());
    expect(
      await new ExposedMigration().callRemoveValue({ table: 'task', column: 'state', value: 'a' }),
    ).toEqual(await new RemoveValueCall('task', 'state', 'a').toOp());
  });
});
