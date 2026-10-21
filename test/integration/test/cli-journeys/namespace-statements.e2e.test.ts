/**
 * Namespace statements on Postgres.
 *
 * `--rename billing:finance` renames schema `billing` with `ALTER SCHEMA … RENAME TO`, so its tables keep their rows. A namespace the destination no longer declares is asked about one model at a time, and `--delete billing` answers every one of those questions; the plan drops the tables, then the schema.
 *
 * N1 renames the namespace with `migration plan`, re-runs the written `migration.ts`, which reproduces `ops.json` byte for byte, and migrates. N2 deletes the namespace with `db update --delete billing`. N3 plans the same delete with `migration plan` and re-runs its `migration.ts`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import {
  type JourneyContext,
  latestMigrationDirName,
  parseJsonOutput,
  planMigrationAndSelfEmit,
  runContractEmit,
  runDbUpdate,
  runMigrate,
  runMigrationPlan,
  selfEmitMigration,
  setupJourney,
  sql,
  swapPslContract,
  timeouts,
  useDevDatabase,
} from '../utils/journey-test-helpers';

interface PlannedOperation {
  readonly label: string;
  readonly operationClass: string;
}

interface AppliedStatementReport {
  readonly description: string;
  readonly operationIndexes: readonly number[];
}

async function emitContract(
  ctx: JourneyContext,
  variant:
    | 'contract-namespace-statements-from'
    | 'contract-namespace-statements-renamed'
    | 'contract-namespace-statements-removed',
  label: string,
): Promise<void> {
  swapPslContract(ctx, variant);
  const emit = await runContractEmit(ctx);
  expect(emit.exitCode, `${label}: emit ${variant}: ${emit.stderr}`).toBe(0);
}

async function seedRows(connectionString: string): Promise<void> {
  await sql(
    connectionString,
    `INSERT INTO "billing"."Invoice" (id, number) VALUES (1, 'A-1'), (2, 'A-2');
     INSERT INTO "billing"."Receipt" (id) VALUES (10)`,
  );
}

async function schemas(connectionString: string): Promise<readonly string[]> {
  const rows = await sql(
    connectionString,
    `SELECT nspname FROM pg_namespace WHERE nspname IN ('billing', 'finance') ORDER BY nspname`,
  );
  return rows.rows.map((row) => String(row['nspname']));
}

function packageFiles(ctx: JourneyContext, dirName: string) {
  const dir = join(ctx.testDir, 'migrations', 'app', dirName);
  return {
    ops: readFileSync(join(dir, 'ops.json'), 'utf-8'),
    migration: readFileSync(join(dir, 'migration.json'), 'utf-8'),
    source: readFileSync(join(dir, 'migration.ts'), 'utf-8'),
  };
}

async function planned(
  ctx: JourneyContext,
  origin: string,
  name: string,
  statements: readonly string[],
  label: string,
) {
  const plan = await runMigrationPlan(ctx, [
    '--name',
    name,
    '--from',
    origin,
    ...statements,
    '--json',
  ]);
  expect(plan.exitCode, `${label}: plan: ${plan.stderr}`).toBe(0);
  return parseJsonOutput<{
    operations: readonly PlannedOperation[];
    appliedStatements: readonly AppliedStatementReport[];
  }>(plan);
}

async function expectReEmitted(ctx: JourneyContext, dirName: string, label: string) {
  const written = packageFiles(ctx, dirName);
  const reEmit = await selfEmitMigration(ctx, ['--dir', `migrations/app/${dirName}`]);
  expect(reEmit.exitCode, `${label}: re-run migration.ts: ${reEmit.stderr}`).toBe(0);
  const reEmitted = packageFiles(ctx, dirName);
  expect(reEmitted.ops, `${label}: ops.json is byte-identical after re-emit`).toBe(written.ops);
  expect(reEmitted.migration, `${label}: migration.json is byte-identical`).toBe(written.migration);
  return written.source;
}

withTempDir(({ createTempDir }) => {
  describe('N1: rename a namespace with migration plan --rename', () => {
    const db = useDevDatabase();

    it(
      'renames the schema, re-emits byte for byte, and keeps the rows under the new name',
      async () => {
        const ctx = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
          contractMode: 'psl',
        });
        await emitContract(ctx, 'contract-namespace-statements-from', 'N1.01');
        const initial = await planMigrationAndSelfEmit(ctx, ['--name', 'initial']);
        expect(initial.exitCode, `N1.02: plan initial: ${initial.stderr}`).toBe(0);
        expect((await runMigrate(ctx)).exitCode, 'N1.03: migrate initial').toBe(0);
        await seedRows(db.connectionString);
        const origin = latestMigrationDirName(ctx);
        await emitContract(ctx, 'contract-namespace-statements-renamed', 'N1.04');

        const plan = await planned(
          ctx,
          origin,
          'rename-billing',
          ['--rename', 'billing:finance'],
          'N1.05',
        );
        expect(plan.operations, 'N1.05: only the schema rename').toEqual([
          expect.objectContaining({ label: 'Rename schema "billing" to "finance"' }),
        ]);
        expect(plan.appliedStatements).toEqual([
          expect.objectContaining({
            description: 'rename namespace "billing" to "finance"',
            operationIndexes: [0],
          }),
        ]);

        const source = await expectReEmitted(ctx, latestMigrationDirName(ctx), 'N1.06');
        expect(source, 'N1.06: migration.ts holds the facade call').toContain(
          "this.renameSchema({ schema: 'billing', to: 'finance' })",
        );

        const apply = await runMigrate(ctx);
        expect(apply.exitCode, `N1.07: migrate: ${apply.stderr}`).toBe(0);
        expect(await schemas(db.connectionString), 'N1.07: the schema has its new name').toEqual([
          'finance',
        ]);
        expect(
          (await sql(db.connectionString, 'SELECT id, number FROM "finance"."Invoice" ORDER BY id'))
            .rows,
          'N1.07: the rows are there under the new name',
        ).toEqual([
          { id: 1, number: 'A-1' },
          { id: 2, number: 'A-2' },
        ]);
      },
      timeouts.spinUpPpgDev,
    );
  });

  describe('N2: delete a namespace with db update --delete', () => {
    const db = useDevDatabase();

    it(
      'asks about each model, and with --delete billing drops the tables and the schema',
      async () => {
        const ctx = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
          contractMode: 'psl',
        });
        await emitContract(ctx, 'contract-namespace-statements-from', 'N2.01');
        const create = await runDbUpdate(ctx, ['--json']);
        expect(create.exitCode, `N2.02: db update creates the tables: ${create.stderr}`).toBe(0);
        await seedRows(db.connectionString);
        await emitContract(ctx, 'contract-namespace-statements-removed', 'N2.03');

        const refused = await runDbUpdate(ctx, ['--no-interactive', '--json']);
        expect(refused.exitCode, 'N2.04: refused without --delete').not.toBe(0);
        expect(refused.stdout + refused.stderr, 'N2.04: asks about each model').toContain(
          'billing.Invoice',
        );
        expect(await schemas(db.connectionString), 'N2.04: nothing dropped').toEqual(['billing']);

        const update = await runDbUpdate(ctx, [
          '--delete',
          'billing',
          '--no-interactive',
          '--json',
        ]);
        expect(update.exitCode, `N2.05: db update --delete billing: ${update.stderr}`).toBe(0);
        const updated = parseJsonOutput<{
          plan: { operations: readonly PlannedOperation[] };
          appliedStatements: readonly AppliedStatementReport[];
        }>(update);
        expect(updated.plan.operations.map(({ label }) => label)).toEqual([
          'Drop table "Invoice"',
          'Drop table "Receipt"',
          'Drop schema "billing"',
        ]);
        expect(updated.appliedStatements.map(({ description }) => description)).toEqual([
          'delete model "billing.Invoice"',
          'delete model "billing.Receipt"',
        ]);
        expect(await schemas(db.connectionString), 'N2.06: the schema is gone').toEqual([]);
      },
      timeouts.spinUpPpgDev,
    );
  });

  describe('N3: delete a namespace with migration plan --delete', () => {
    const db = useDevDatabase();

    it(
      'plans the drops and the schema drop, and re-emits byte for byte',
      async () => {
        const ctx = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
          contractMode: 'psl',
        });
        await emitContract(ctx, 'contract-namespace-statements-from', 'N3.01');
        const initial = await planMigrationAndSelfEmit(ctx, ['--name', 'initial']);
        expect(initial.exitCode, `N3.02: plan initial: ${initial.stderr}`).toBe(0);
        const origin = latestMigrationDirName(ctx);
        await emitContract(ctx, 'contract-namespace-statements-removed', 'N3.03');

        const plan = await planned(ctx, origin, 'drop-billing', ['--delete', 'billing'], 'N3.04');
        expect(plan.operations.map(({ label }) => label)).toEqual([
          'Drop table "Invoice"',
          'Drop table "Receipt"',
          'Drop schema "billing"',
        ]);
        const source = await expectReEmitted(ctx, latestMigrationDirName(ctx), 'N3.05');
        expect(source, 'N3.05: migration.ts holds the facade call').toContain(
          "this.dropSchema({ schema: 'billing' })",
        );
      },
      timeouts.spinUpPpgDev,
    );
  });
});
