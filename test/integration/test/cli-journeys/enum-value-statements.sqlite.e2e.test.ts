/**
 * Enum value statements on SQLite.
 *
 * The SQLite twin of `enum-value-statements.e2e.test.ts`. SQLite has no list columns, so `Task` has only the optional `status`, typed by `Status`, whose `ARCHIVED` member stores `archived`.
 *
 * S1 renames the value to `RETIRED`, which stores `retired`, with `--rename Status.ARCHIVED:Status.RETIRED` through `migration plan` and `migrate`. S2 deletes the value through `db update`: refused until `--delete Status.ARCHIVED` answers, then the rows that held it hold NULL.
 *
 * S3 has a required `status`: with no row holding the value, `--delete` removes it; while rows hold it, `--delete` fails at apply with `MIGRATION.PRECHECK_FAILED` saying how to keep them and changes nothing, and `--rename` applies.
 *
 * Every journey ends with `db verify --schema-only` clean and a further plan empty, and the `migration.ts` written is run again and reproduces its `ops.json` and `migration.json` byte for byte.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';
import { withTempDir, writeProjectManifest } from '../utils/cli-test-helpers';
import {
  engineError,
  getMigrationDirs,
  type JourneyContext,
  latestMigrationDirName,
  parseJsonOutput,
  planMigrationAndSelfEmit,
  runContractEmit,
  runDbUpdate,
  runDbVerify,
  runMigrate,
  runMigrationPlan,
  selfEmitMigration,
  sqlitePslConfigFixture,
  timeouts,
} from '../utils/journey-test-helpers';

function contractWith(members: string): string {
  return `// use prisma-8

enum Status {
  @@type("sqlite/text@1")
  ACTIVE = "active"
${members}}

model Task {
  id     Int     @id
  status Status?
  @@map("task")
}
`;
}

const FROM_PSL = contractWith('  ARCHIVED = "archived"\n');
const RENAMED_PSL = contractWith('  RETIRED = "retired"\n');
const REMOVED_PSL = contractWith('');
const required = (psl: string) => psl.replace('status Status?', 'status Status ');

type SqliteJourney = JourneyContext & { readonly dbPath: string };

function setupSqliteJourney(createTempDir: () => string, psl = FROM_PSL): SqliteJourney {
  const testDir = createTempDir();
  const dbPath = join(testDir, 'journey.db');
  const configPath = join(testDir, 'prisma.config.ts');
  const config = readFileSync(sqlitePslConfigFixture, 'utf-8').replace('{{DB_PATH}}', () => dbPath);
  writeFileSync(configPath, config, 'utf-8');
  writeFileSync(join(testDir, 'contract.prisma'), psl, 'utf-8');
  writeProjectManifest(testDir);
  return { testDir, configPath, outputDir: testDir, dbPath };
}

function withDatabase<T>(dbPath: string, run: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(dbPath);
  try {
    return run(db);
  } finally {
    db.close();
  }
}

function seedRows(dbPath: string): void {
  withDatabase(dbPath, (db) => {
    db.exec(`INSERT INTO "task" (id, status) VALUES (1, 'archived'), (2, 'active'), (3, NULL)`);
  });
}

function tasks(dbPath: string): readonly unknown[] {
  return withDatabase(dbPath, (db) =>
    db
      .prepare('SELECT id, status FROM "task" ORDER BY id')
      .all()
      .map((row) => ({ ...row })),
  );
}

async function emit(ctx: JourneyContext, psl: string, label: string): Promise<void> {
  writeFileSync(join(ctx.testDir, 'contract.prisma'), psl, 'utf-8');
  const emitted = await runContractEmit(ctx);
  expect(emitted.exitCode, `${label}: emit: ${emitted.stderr}`).toBe(0);
}

function packageFiles(ctx: JourneyContext, dirName: string) {
  const dir = join(ctx.testDir, 'migrations', 'app', dirName);
  return {
    ops: readFileSync(join(dir, 'ops.json'), 'utf-8'),
    migration: readFileSync(join(dir, 'migration.json'), 'utf-8'),
    source: readFileSync(join(dir, 'migration.ts'), 'utf-8'),
  };
}

async function expectVerified(ctx: JourneyContext, label: string): Promise<void> {
  const verify = await runDbVerify(ctx, ['--schema-only']);
  expect(verify.exitCode, `${label}: db verify --schema-only: ${verify.stderr}`).toBe(0);
}

withTempDir(({ createTempDir }) => {
  describe('S1 (SQLite): rename an enum value with migration plan', () => {
    it(
      'rewrites the rows that hold the old value, and the migration reproduces itself',
      async () => {
        const ctx = setupSqliteJourney(createTempDir);
        await emit(ctx, FROM_PSL, 'S1.01');
        const initial = await planMigrationAndSelfEmit(ctx, ['--name', 'initial']);
        expect(initial.exitCode, `S1.02: plan initial: ${initial.stderr}`).toBe(0);
        const applyInitial = await runMigrate(ctx);
        expect(applyInitial.exitCode, `S1.02: migrate initial: ${applyInitial.stderr}`).toBe(0);
        seedRows(ctx.dbPath);
        const origin = latestMigrationDirName(ctx);
        await emit(ctx, RENAMED_PSL, 'S1.03');

        const plan = await runMigrationPlan(ctx, [
          '--name',
          'retire',
          '--from',
          origin,
          '--rename',
          'Status.ARCHIVED:Status.RETIRED',
          '--json',
        ]);
        expect(plan.exitCode, `S1.04: plan: ${plan.stderr}`).toBe(0);
        const planned = parseJsonOutput<{
          operations: readonly { label: string }[];
          appliedStatements: readonly { description: string; operationIndexes: number[] }[];
        }>(plan);
        expect(planned.operations.map(({ label }) => label)[0]).toBe(
          'Replace value "archived" with "retired" in column "status" of "task"',
        );
        expect(planned.appliedStatements).toMatchObject([
          {
            description: 'rename enum value "Status.ARCHIVED" to "Status.RETIRED"',
            operationIndexes: [0],
          },
        ]);
        const dirName = latestMigrationDirName(ctx);
        const written = packageFiles(ctx, dirName);
        const reEmit = await selfEmitMigration(ctx, ['--dir', `migrations/app/${dirName}`]);
        expect(reEmit.exitCode, `S1.05: re-run migration.ts: ${reEmit.stderr}`).toBe(0);
        expect(packageFiles(ctx, dirName)).toEqual(written);
        const migrate = await runMigrate(ctx);
        expect(migrate.exitCode, `S1.06: migrate: ${migrate.stderr}`).toBe(0);

        expect(tasks(ctx.dbPath)).toEqual([
          { id: 1, status: 'retired' },
          { id: 2, status: 'active' },
          { id: 3, status: null },
        ]);
        await expectVerified(ctx, 'S1.07');
        const count = getMigrationDirs(ctx).length;
        const fresh = await runMigrationPlan(ctx, ['--from', dirName, '--json']);
        expect(fresh.exitCode, `S1.08: plan with no change: ${fresh.stderr}`).toBe(0);
        expect(parseJsonOutput<{ noOp: boolean }>(fresh).noOp, 'S1.08: plan is empty').toBe(true);
        expect(getMigrationDirs(ctx), 'S1.08: nothing written').toHaveLength(count);
      },
      timeouts.spinUpPpgDev,
    );
  });

  describe('S2 (SQLite): delete an enum value with db update', () => {
    it(
      'is refused until --delete names the value, then sets the rows that hold it to NULL',
      async () => {
        const ctx = setupSqliteJourney(createTempDir);
        await emit(ctx, FROM_PSL, 'S2.01');
        const create = await runDbUpdate(ctx, ['--json']);
        expect(create.exitCode, `S2.02: db update creates the table: ${create.stderr}`).toBe(0);
        seedRows(ctx.dbPath);
        await emit(ctx, REMOVED_PSL, 'S2.03');

        const refused = await runDbUpdate(ctx, ['--no-interactive', '--json']);
        expect(engineError(refused)?.code, 'S2.04: nobody to answer').toBe('CLI.CONSENT_REQUIRED');
        expect(
          JSON.stringify(engineError(refused)?.nextActions ?? []),
          'S2.04: one flag for the value',
        ).toContain('--delete Status.ARCHIVED');

        const update = await runDbUpdate(ctx, [
          '--delete',
          'Status.ARCHIVED',
          '--no-interactive',
          '--json',
        ]);
        expect(update.exitCode, `S2.05: db update: ${JSON.stringify(engineError(update))}`).toBe(0);

        expect(tasks(ctx.dbPath)).toEqual([
          { id: 1, status: null },
          { id: 2, status: 'active' },
          { id: 3, status: null },
        ]);
        await expectVerified(ctx, 'S2.06');
        const dryRun = await runDbUpdate(ctx, ['--dry-run', '--json']);
        expect(dryRun.exitCode, `S2.07: db update --dry-run: ${dryRun.stderr}`).toBe(0);
        expect(
          parseJsonOutput<{ plan: { operations: readonly unknown[] } }>(dryRun).plan.operations,
          'S2.07: nothing left to plan',
        ).toEqual([]);
      },
      timeouts.spinUpPpgDev,
    );
  });

  describe('S3 (SQLite): delete an enum value a required column types', () => {
    it(
      'removes it when no row holds it; while rows do, fails at apply and changes nothing, and a rename applies',
      async () => {
        const empty = setupSqliteJourney(createTempDir, required(FROM_PSL));
        await emit(empty, required(FROM_PSL), 'S3.01');
        expect((await runDbUpdate(empty, ['--json'])).exitCode, 'S3.02: create').toBe(0);
        await emit(empty, required(REMOVED_PSL), 'S3.03');
        const removed = await runDbUpdate(empty, [
          '--delete',
          'Status.ARCHIVED',
          '--no-interactive',
          '--json',
        ]);
        expect(removed.exitCode, `S3.04: ${JSON.stringify(engineError(removed))}`).toBe(0);
        await expectVerified(empty, 'S3.05');

        const held = setupSqliteJourney(createTempDir, required(FROM_PSL));
        await emit(held, required(FROM_PSL), 'S3.06');
        expect((await runDbUpdate(held, ['--json'])).exitCode, 'S3.07: create').toBe(0);
        withDatabase(held.dbPath, (db) => {
          db.exec(`INSERT INTO "task" (id, status) VALUES (1, 'archived'), (2, 'active')`);
        });
        await emit(held, required(REMOVED_PSL), 'S3.08');
        const failed = await runDbUpdate(held, [
          '--delete',
          'Status.ARCHIVED',
          '--no-interactive',
          '--json',
        ]);
        expect(engineError(failed)?.code, 'S3.09').toBe('MIGRATION.PRECHECK_FAILED');
        expect(engineError(failed)?.summary).toContain(
          `ensure column "status" of "task" takes NULL, or no row holds "archived" in it: to keep those rows, answer with --rename 'Status.ARCHIVED:Status.<new name>'`,
        );
        expect(tasks(held.dbPath), 'S3.09: nothing changed').toEqual([
          { id: 1, status: 'archived' },
          { id: 2, status: 'active' },
        ]);
        await emit(held, required(RENAMED_PSL), 'S3.10');
        const renamed = await runDbUpdate(held, [
          '--rename',
          'Status.ARCHIVED:Status.RETIRED',
          '--no-interactive',
          '--json',
        ]);
        expect(renamed.exitCode, `S3.11: ${JSON.stringify(engineError(renamed))}`).toBe(0);
        expect(tasks(held.dbPath)).toEqual([
          { id: 1, status: 'retired' },
          { id: 2, status: 'active' },
        ]);
        await expectVerified(held, 'S3.12');
      },
      timeouts.spinUpPpgDev,
    );
  });
});
