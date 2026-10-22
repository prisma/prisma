import { INIT_ADDITIVE_POLICY } from '@internal/family-sql/control';
import { APP_SPACE_ID } from '@internal/framework-components/control';
import { SqlConnectionError } from '@internal/sql-errors';
import type { PostgresPlanTargetDetails } from '@internal/target-postgres/planner-target-details';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  contract,
  createDriver,
  createMigrationPlan,
  createTestDatabase,
  familyInstance,
  frameworkComponents,
  type PostgresControlDriver,
  postgresTargetDescriptor,
  resetDatabase,
  synthEdges,
  testTimeout,
  toPlanContractInfo,
} from './fixtures/runner-fixtures';

const LOST_STEP_SQL = 'create table "user" (id int primary key)';

describe('PostgresMigrationRunner - a session the server ends during a step', {
  concurrent: false,
}, () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let driver: PostgresControlDriver | undefined;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, testTimeout);

  afterAll(async () => {
    await database?.close();
  }, testTimeout);

  beforeEach(async () => {
    driver = await createDriver(database.connectionString);
    await resetDatabase(driver);
  }, testTimeout);

  afterEach(async () => {
    await driver?.close();
    driver = undefined;
  }, testTimeout);

  it('fails with EXECUTION_FAILED naming the operation and the SQLSTATE', {
    timeout: testTimeout,
  }, async () => {
    const control = driver!;
    const query = control.query.bind(control);
    vi.spyOn(control, 'query').mockImplementation((sql, params) =>
      sql === LOST_STEP_SQL
        ? Promise.reject(
            new SqlConnectionError('terminating connection due to administrator command', {
              sqlState: '57P01',
              transient: true,
            }),
          )
        : query(sql, params),
    );
    const plan = createMigrationPlan<PostgresPlanTargetDetails>({
      targetId: 'postgres',
      spaceId: APP_SPACE_ID,
      origin: null,
      destination: toPlanContractInfo(contract),
      operations: [
        {
          id: 'table.user',
          label: 'Create user table',
          summary: 'Creates the user table',
          operationClass: 'additive',
          target: {
            id: 'postgres',
            details: { schema: 'public', objectType: 'table', name: 'user' },
          },
          precheck: [],
          execute: [{ description: 'create user table', sql: LOST_STEP_SQL }],
          postcheck: [],
        },
      ],
      providedInvariants: [],
    });

    const result = await postgresTargetDescriptor.createRunner(familyInstance).execute({
      driver: control,
      perSpaceOptions: [
        {
          space: APP_SPACE_ID,
          plan,
          migrationEdges: synthEdges(plan),
          driver: control,
          destinationContract: contract,
          policy: INIT_ADDITIVE_POLICY,
          frameworkComponents,
        },
      ],
    });

    const failure = result.assertNotOk();
    expect(failure.code).toBe('MIGRATION.EXECUTION_FAILED');
    expect(failure.meta).toMatchObject({
      operationId: 'table.user',
      stepDescription: 'create user table',
      sql: LOST_STEP_SQL,
      sqlState: '57P01',
      connectionLost: true,
      transient: true,
    });
  });
});
