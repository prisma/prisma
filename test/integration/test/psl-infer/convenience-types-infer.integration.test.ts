/**
 * `contract infer` writes each date and time column as the convenience type whose default path reads it, with only the arguments that differ from the defaults. The inferred schema emits, verifies clean against the database it was read from, and plans no migration.
 */
import postgresAdapter from '@internal/adapter-postgres/control';
import postgresControlDriver from '@internal/driver-postgres/control';
import sql, { INIT_ADDITIVE_POLICY } from '@internal/family-sql/control';
import { APP_SPACE_ID, createControlStack } from '@internal/framework-components/control';
import { printPsl } from '@internal/psl-printer';
import postgres from '@internal/target-postgres/control';
import { createDevDatabase, type DevDatabase, timeouts, withClient } from '@repo/test-utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authorSqlContractFromPsl,
  postgresFrameworkComponents,
} from '../scalar-lists/psl-list-authoring';

const controlStack = createControlStack({
  family: sql,
  target: postgres,
  adapter: postgresAdapter,
  driver: postgresControlDriver,
  extensions: [],
});
const familyInstance = sql.create(controlStack);

const EVENT_TABLE = `CREATE TABLE event (
  id       int4 PRIMARY KEY,
  at       timestamptz,
  paid_at  timestamptz(3),
  legacy   timestamp(3),
  day      date,
  opens    time(0),
  local_at timetz,
  span     interval
)`;

function fieldLines(printed: string): readonly string[] {
  return printed
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => /^(at|paidAt|legacy|day|opens|localAt|span) /.test(line));
}

describe('contract infer over date and time columns', { concurrent: false }, () => {
  let database: DevDatabase | undefined;

  beforeAll(async () => {
    database = await createDevDatabase();
  }, timeouts.spinUpPpgDev);

  afterAll(async () => {
    if (database) await database.close();
  }, timeouts.spinUpPpgDev);

  it(
    'writes the convenience types, which emit, verify clean and plan no migration',
    async () => {
      if (!database) throw new Error('database not initialised');
      await withClient(database.connectionString, async (client) => {
        await client.query(EVENT_TABLE);
      });
      const driver = await postgresControlDriver.create(database.connectionString);
      try {
        const schema = await familyInstance.introspect({ driver });
        const inferred = printPsl(await familyInstance.inferPslContract(schema), {
          pslBlockDescriptors: controlStack.authoringContributions.pslBlockDescriptors,
        });
        expect(fieldLines(inferred)).toEqual([
          'at DateTime(precision: 6)?',
          'paidAt DateTime? @map("paid_at")',
          'legacy DateTime(column: timestamp)?',
          'day Date?',
          'opens Time(precision: 0)?',
          'localAt Time(column: timetz)? @map("local_at")',
          'span Duration?',
        ]);

        const emitted = await authorSqlContractFromPsl(
          inferred.replace(/^\/\/ use prisma-8\n/, ''),
        );
        expect(emitted.diagnostics).toEqual([]);
        const contract = emitted.contract;
        if (!contract) throw new Error('the inferred schema produced no contract');

        const verified = familyInstance.verifySchema({
          contract,
          schema: await familyInstance.introspect({ driver, contract }),
          strict: true,
          frameworkComponents: postgresFrameworkComponents,
        });
        expect(verified.schema.issues).toEqual([]);

        const planned = postgres.createPlanner(postgresAdapter.create(controlStack)).plan({
          contract,
          schema: await familyInstance.introspect({ driver, contract }),
          policy: INIT_ADDITIVE_POLICY,
          fromContract: null,
          origin: null,
          statements: [],
          frameworkComponents: postgresFrameworkComponents,
          spaceId: APP_SPACE_ID,
          snapshotsImportPath: '../../snapshots',
        });
        expect(planned.kind === 'success' ? planned.plan.operations : planned).toEqual([]);
      } finally {
        await driver.close();
      }
    },
    timeouts.spinUpPpgDev,
  );
});
