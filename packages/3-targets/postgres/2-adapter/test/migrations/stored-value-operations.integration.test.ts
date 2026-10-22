/**
 * `replaceValue` and `removeValue` against a real database: each rewrites the rows that hold the
 * value and leaves the others, its postcheck holds afterwards, and the runner skips it on a
 * second run.
 */
import type { SqlMigrationPlanOperation } from '@internal/family-sql/control';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { RemoveValueCall, ReplaceValueCall } from '@internal/target-postgres/op-factory-call';
import type { PostgresPlanTargetDetails } from '@internal/target-postgres/planner-target-details';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  contract,
  createDriver,
  createMigrationPlan,
  createTestDatabase,
  familyInstance,
  frameworkComponents,
  LEDGER_TEST_SPACE_ID,
  type PostgresControlDriver,
  postgresTargetDescriptor,
  resetDatabase,
  synthEdges,
  testTimeout,
  toPlanContractInfo,
} from './fixtures/runner-fixtures';

type Op = SqlMigrationPlanOperation<PostgresPlanTargetDetails>;

describe('Postgres stored value operations', { concurrent: false }, () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let driver: PostgresControlDriver;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, testTimeout);

  afterAll(async () => {
    await database?.close();
  }, testTimeout);

  beforeEach(async () => {
    driver = await createDriver(database.connectionString);
    await resetDatabase(driver);
    await driver.query('drop schema if exists app cascade');
    await driver.query('create schema app');
    await driver.query(
      'create table app.task (id int primary key, state text, rank int4, labels text[], ranks int4[])',
    );
  }, testTimeout);

  afterEach(async () => {
    await driver?.close();
  }, testTimeout);

  async function postchecksHold(op: Op): Promise<boolean> {
    for (const step of op.postcheck) {
      const result = await driver.query<{ result: boolean }>(step.sql, step.params ?? []);
      if (result.rows[0]?.result !== true) return false;
    }
    return true;
  }

  async function operationsExecuted(op: Op): Promise<number> {
    const plan = createMigrationPlan<PostgresPlanTargetDetails>({
      targetId: 'postgres',
      spaceId: LEDGER_TEST_SPACE_ID,
      origin: null,
      destination: toPlanContractInfo(contract),
      operations: [op],
      providedInvariants: [],
    });
    const result = await postgresTargetDescriptor.createRunner(familyInstance).execute({
      driver,
      perSpaceOptions: [
        {
          space: LEDGER_TEST_SPACE_ID,
          plan,
          migrationEdges: synthEdges(plan),
          driver,
          destinationContract: contract,
          policy: { allowedOperationClasses: ['additive', 'widening', 'destructive'] },
          frameworkComponents,
        },
      ],
    });
    if (!result.ok) throw new Error(`${result.failure.code}: ${result.failure.message}`);
    return result.value.perSpaceResults.reduce(
      (sum, { value }) => sum + value.operationsExecuted,
      0,
    );
  }

  async function runTwice(op: Op): Promise<void> {
    expect(await postchecksHold(op), 'postcheck before').toBe(false);
    expect(await operationsExecuted(op), 'first run').toBe(1);
    expect(await postchecksHold(op), 'postcheck after').toBe(true);
    expect(await operationsExecuted(op), 'second run').toBe(0);
  }

  async function rows(columns: string): Promise<unknown[]> {
    return (await driver.query(`select id, ${columns} from app.task order by id`)).rows;
  }

  it('replaces a text value in the rows that hold it, and leaves the others', {
    timeout: testTimeout,
  }, async () => {
    await driver.query(
      `insert into app.task (id, state) values (1, 'ARCHIVED'), (2, 'ACTIVE'), (3, null), (4, 'ARCHIVED')`,
    );

    await runTwice(
      await new ReplaceValueCall('app', 'task', 'state', 'ARCHIVED', 'RETIRED', false).toOp(),
    );

    expect(await rows('state')).toEqual([
      { id: 1, state: 'RETIRED' },
      { id: 2, state: 'ACTIVE' },
      { id: 3, state: null },
      { id: 4, state: 'RETIRED' },
    ]);
  });

  it('replaces and removes a numeric value', { timeout: testTimeout }, async () => {
    await driver.query('insert into app.task (id, rank) values (1, 1), (2, 2), (3, 3)');

    await runTwice(await new ReplaceValueCall('app', 'task', 'rank', 1, 10, false).toOp());
    await runTwice(await new RemoveValueCall('app', 'task', 'rank', 3, false).toOp());

    expect(await rows('rank')).toEqual([
      { id: 1, rank: 10 },
      { id: 2, rank: 2 },
      { id: 3, rank: null },
    ]);
  });

  it('removes a text value by setting it to NULL', { timeout: testTimeout }, async () => {
    await driver.query(`insert into app.task (id, state) values (1, 'ARCHIVED'), (2, 'ACTIVE')`);

    await runTwice(await new RemoveValueCall('app', 'task', 'state', 'ARCHIVED', false).toOp());

    expect(await rows('state')).toEqual([
      { id: 1, state: null },
      { id: 2, state: 'ACTIVE' },
    ]);
  });

  it('replaces a value with a quote in it', { timeout: testTimeout }, async () => {
    await driver.query(`insert into app.task (id, state) values (1, 'it''s'), (2, 'its')`);

    await runTwice(
      await new ReplaceValueCall('app', 'task', 'state', "it's", 'it"s', false).toOp(),
    );

    expect(await rows('state')).toEqual([
      { id: 1, state: 'it"s' },
      { id: 2, state: 'its' },
    ]);
  });

  it('replaces and removes a value inside the lists of a list column', {
    timeout: testTimeout,
  }, async () => {
    await driver.query(
      `insert into app.task (id, labels, ranks) values
        (1, '{a,b,a}', '{1,2}'), (2, '{b}', '{2}'), (3, null, null), (4, '{}', '{}')`,
    );

    await runTwice(await new ReplaceValueCall('app', 'task', 'labels', 'a', 'z', true).toOp());
    await runTwice(await new RemoveValueCall('app', 'task', 'labels', 'b', true).toOp());
    await runTwice(await new ReplaceValueCall('app', 'task', 'ranks', 2, 20, true).toOp());

    expect(await rows('labels, ranks')).toEqual([
      { id: 1, labels: '{z,z}', ranks: '{1,20}' },
      { id: 2, labels: '{}', ranks: '{20}' },
      { id: 3, labels: null, ranks: null },
      { id: 4, labels: '{}', ranks: '{}' },
    ]);
  });

  it('finds a table of the unbound namespace on the search path', {
    timeout: testTimeout,
  }, async () => {
    await driver.query('create table public.tag (id int primary key, state text)');
    await driver.query(`insert into public.tag (id, state) values (1, 'old'), (2, 'kept')`);

    await runTwice(
      await new ReplaceValueCall(UNBOUND_NAMESPACE_ID, 'tag', 'state', 'old', 'new', false).toOp(),
    );

    expect((await driver.query('select id, state from public.tag order by id')).rows).toEqual([
      { id: 1, state: 'new' },
      { id: 2, state: 'kept' },
    ]);
  });
});
