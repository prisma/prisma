import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { describe, expect, it } from 'vitest';
import { RemoveValueCall, ReplaceValueCall } from '../../src/core/migrations/op-factory-call';
import { removeValue, replaceValue } from '../../src/core/migrations/operations/stored-values';

const target = {
  id: 'postgres',
  details: { schema: 'app', objectType: 'column', name: 'state', table: 'task' },
};

describe('replaceValue', () => {
  it('changes the value in a scalar column, and checks afterwards that no row holds the old one', () => {
    expect(replaceValue('app', 'task', 'state', 'ARCHIVED', 'RETIRED', false)).toEqual({
      id: 'replaceValue.task.state.ARCHIVED',
      label: 'Replace value "ARCHIVED" with "RETIRED" in column "state" of "task"',
      operationClass: 'widening',
      target,
      precheck: [],
      execute: [
        {
          description: 'replace value "ARCHIVED" with "RETIRED" in column "state"',
          sql: 'UPDATE "app"."task" SET "state" = $2 WHERE "state" = $1',
          params: ['ARCHIVED', 'RETIRED'],
        },
      ],
      postcheck: [
        {
          description: 'verify no row of "task" holds value "ARCHIVED" in column "state"',
          sql: 'SELECT NOT EXISTS (SELECT 1 FROM "app"."task" WHERE "state" = $1) AS result',
          params: ['ARCHIVED'],
        },
      ],
    });
  });

  it('changes the value inside every list of a list column', () => {
    const op = replaceValue('app', 'task', 'labels', 1, 2, true);

    expect(op).toMatchObject({
      id: 'replaceValue.task.labels.1',
      label: 'Replace value 1 with 2 in column "labels" of "task"',
      execute: [
        {
          sql: 'UPDATE "app"."task" SET "labels" = array_replace("labels", $1, $2) WHERE $1 = ANY("labels")',
          params: [1, 2],
        },
      ],
      postcheck: [
        {
          description: 'verify no list in column "labels" of "task" holds value 1',
          sql: 'SELECT NOT EXISTS (SELECT 1 FROM "app"."task" WHERE $1 = ANY("labels")) AS result',
          params: [1],
        },
      ],
    });
  });

  it('leaves a table of the unbound namespace unqualified', () => {
    const op = replaceValue(UNBOUND_NAMESPACE_ID, 'task', 'state', 'a', 'b', false);

    expect(op.execute[0]?.sql).toBe('UPDATE "task" SET "state" = $2 WHERE "state" = $1');
  });

  it('passes a value with a quote in it as a parameter, never in the SQL text', () => {
    const op = replaceValue('app', 'task', 'state', "it's", 'it"s', false);

    expect([...op.execute, ...op.postcheck].map((step) => step.sql).join('\n')).not.toMatch(
      /it's|it"s/,
    );
    expect(op.execute[0]?.params).toEqual(["it's", 'it"s']);
  });
});

describe('removeValue', () => {
  it('sets the value to NULL in a scalar column', () => {
    expect(removeValue('app', 'task', 'state', 'ARCHIVED', false)).toEqual({
      id: 'removeValue.task.state.ARCHIVED',
      label: 'Remove value "ARCHIVED" from column "state" of "task"',
      operationClass: 'destructive',
      target,
      precheck: [],
      execute: [
        {
          description: 'remove value "ARCHIVED" from column "state"',
          sql: 'UPDATE "app"."task" SET "state" = NULL WHERE "state" = $1',
          params: ['ARCHIVED'],
        },
      ],
      postcheck: [
        {
          description: 'verify no row of "task" holds value "ARCHIVED" in column "state"',
          sql: 'SELECT NOT EXISTS (SELECT 1 FROM "app"."task" WHERE "state" = $1) AS result',
          params: ['ARCHIVED'],
        },
      ],
    });
  });

  it('takes the value out of every list of a list column', () => {
    expect(removeValue('app', 'task', 'labels', 'x', true).execute).toEqual([
      {
        description: 'remove value "x" from column "labels"',
        sql: 'UPDATE "app"."task" SET "labels" = array_remove("labels", $1) WHERE $1 = ANY("labels")',
        params: ['x'],
      },
    ]);
  });
});

describe('stored value calls', () => {
  const replace = new ReplaceValueCall('app', 'task', 'state', 'ARCHIVED', 'RETIRED', false);
  const remove = new RemoveValueCall('app', 'task', 'labels', 'x', true);

  it('are named after their facade methods and classed by their effect', () => {
    expect(replace).toMatchObject({
      factoryName: 'replaceValue',
      operationClass: 'widening',
      label: 'Replace value "ARCHIVED" with "RETIRED" in column "state" of "task"',
    });
    expect(remove).toMatchObject({
      factoryName: 'removeValue',
      operationClass: 'destructive',
      label: 'Remove value "x" from column "labels" of "task"',
    });
  });

  it('lower to the operations their factories build', async () => {
    expect(await replace.toOp()).toEqual(
      replaceValue('app', 'task', 'state', 'ARCHIVED', 'RETIRED', false),
    );
    expect(await remove.toOp()).toEqual(removeValue('app', 'task', 'labels', 'x', true));
  });

  it('render the facade call, leaving out an unbound schema and a scalar column', () => {
    expect(replace.renderTypeScript()).toBe(
      'this.replaceValue({ schema: "app", table: "task", column: "state", from: "ARCHIVED", to: "RETIRED" })',
    );
    expect(remove.renderTypeScript()).toBe(
      'this.removeValue({ schema: "app", table: "task", column: "labels", value: "x", many: true })',
    );
    expect(
      new RemoveValueCall(UNBOUND_NAMESPACE_ID, 'task', 'rank', 3, false).renderTypeScript(),
    ).toBe('this.removeValue({ table: "task", column: "rank", value: 3 })');
  });

  it('need no import, since each renders as a method of the migration', () => {
    expect(replace.importRequirements()).toEqual([]);
    expect(remove.importRequirements()).toEqual([]);
  });
});
