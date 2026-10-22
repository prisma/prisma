import type { SqlControlFamilyInstance } from '@internal/family-sql/control';
import { createMigrationPlan } from '@internal/family-sql/control';
import type { SqlControlDriverInstance } from '@internal/sql-contract/types';
import { describe, expect, it } from 'vitest';
import type { MysqlPlanTargetDetails } from '../../src/core/migrations/planner-target-details';
import { createMysqlMigrationRunner } from '../../src/core/migrations/runner';

const HASH = 'sha256:destination';

function recorder(options: { readonly failExecute?: boolean } = {}) {
  const events: string[] = [];
  const postchecksSeen = new Map<string, number>();
  const driver = {
    familyId: 'sql',
    targetId: 'mysql',
    async query(sql: string) {
      const name = sql.startsWith('SELECT GET_LOCK')
        ? 'GET_LOCK'
        : sql.startsWith('SELECT RELEASE_LOCK')
          ? 'RELEASE_LOCK'
          : sql;
      events.push(name);
      if (name === 'GET_LOCK') return { rows: [{ acquired: '1' }] };
      if (sql.startsWith('POST')) {
        const seen = (postchecksSeen.get(sql) ?? 0) + 1;
        postchecksSeen.set(sql, seen);
        return { rows: [{ result: seen === 1 ? '0' : '1' }] };
      }
      if (sql.startsWith('EXEC') && options.failExecute) throw new Error('DDL failed');
      return { rows: [{ result: '1' }] };
    },
    async close() {},
  } as unknown as SqlControlDriverInstance<'mysql'>;
  const family = {
    bootstrapControlTableQueries: () => [],
    async readMarker() {
      events.push('readMarker');
      return null;
    },
    async introspect() {
      events.push('introspect');
      return {};
    },
    verifySchema() {
      events.push('verifySchema');
      return { ok: true };
    },
    async initMarker({ space }: { space: string }) {
      events.push(`initMarker ${space}`);
    },
    async writeLedgerEntry({ space }: { space: string }) {
      events.push(`writeLedgerEntry ${space}`);
    },
  } as unknown as SqlControlFamilyInstance;
  return { events, driver, family };
}

function planFor(space: string) {
  return createMigrationPlan<MysqlPlanTargetDetails>({
    targetId: 'mysql',
    spaceId: space,
    origin: null,
    destination: { storageHash: HASH },
    operations: [
      {
        id: `table.${space}`,
        label: `Create table ${space}`,
        operationClass: 'additive',
        target: { id: 'mysql', details: { objectType: 'table' as const, name: space } },
        precheck: [{ description: 'absent', sql: `PRE ${space}` }],
        execute: [{ description: 'create', sql: `EXEC ${space}` }],
        postcheck: [{ description: 'present', sql: `POST ${space}` }],
      },
    ],
    providedInvariants: [],
  });
}

function run(recorded: ReturnType<typeof recorder>, spaces: readonly string[]) {
  return createMysqlMigrationRunner(recorded.family).execute({
    driver: recorded.driver,
    perSpaceOptions: spaces.map((space) => ({
      space,
      plan: planFor(space),
      driver: recorded.driver,
      destinationContract: { storage: { storageHash: HASH } } as never,
      policy: { allowedOperationClasses: ['additive'] },
      frameworkComponents: [],
      migrationEdges: [
        {
          from: 'sha256:empty',
          to: HASH,
          dirName: `m-${space}`,
          migrationHash: 'sha256:m',
          operationCount: 1,
        } as never,
      ],
    })),
  });
}

describe('the MySQL migration runner', () => {
  it('applies, verifies and marks each space in turn, holding the marker lock throughout', async () => {
    const recorded = recorder();
    const result = await run(recorded, ['ext', 'app']);
    expect({ ok: result.ok, events: recorded.events }).toEqual({
      ok: true,
      events: [
        'GET_LOCK',
        'readMarker',
        'POST ext',
        'PRE ext',
        'EXEC ext',
        'POST ext',
        'introspect',
        'verifySchema',
        'START TRANSACTION',
        'initMarker ext',
        'writeLedgerEntry ext',
        'COMMIT',
        'readMarker',
        'POST app',
        'PRE app',
        'EXEC app',
        'POST app',
        'introspect',
        'verifySchema',
        'START TRANSACTION',
        'initMarker app',
        'writeLedgerEntry app',
        'COMMIT',
        'RELEASE_LOCK',
      ],
    });
  });

  it('stops at a failed space, names it, says the spaces before it stay applied, and releases the lock', async () => {
    const recorded = recorder({ failExecute: true });
    const result = await run(recorded, ['ext']);
    expect({
      failure: result.ok
        ? undefined
        : {
            code: result.failure.code,
            failingSpace: result.failure.meta.failingSpace,
            databaseUnchanged: result.failure.meta.databaseUnchanged,
          },
      last: recorded.events.slice(-2),
      marked: recorded.events.some((event) => event.startsWith('initMarker')),
    }).toEqual({
      failure: {
        code: 'MIGRATION.EXECUTION_FAILED',
        failingSpace: 'ext',
        databaseUnchanged: true,
      },
      last: ['EXEC ext', 'RELEASE_LOCK'],
      marked: false,
    });
  });
});
