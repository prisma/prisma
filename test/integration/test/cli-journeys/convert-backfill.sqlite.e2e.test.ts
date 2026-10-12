/**
 * `--convert`, `--backfill` and the temporary value on SQLite, end to end on a table with rows:
 * `migration plan` writes the rebuild or the data transform, the user fills its slot, runs the
 * `migration.ts`, and `db migrate` applies it. A new required field in a key, or whose values come
 * from a value set, gets no temporary value: the rebuild applies to an empty table and fails on
 * `NOT NULL` when the table has rows. `cli.backfill-enum.sqlite.e2e.test.ts` fills such a field
 * through `--backfill` and reads it back through the ORM.
 */

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join, resolve } from 'pathe';
import { describe, expect, it } from 'vitest';
import { withTempDir, writeProjectManifest } from '../utils/cli-test-helpers';
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
  sqlitePslConfigFixture,
  timeouts,
} from '../utils/journey-test-helpers';

const BASE = `// use prisma-8

model User {
  id       Int     @id
  age      String
  nickname String?
}
`;

type SqliteJourney = JourneyContext & { readonly dbPath: string };

function setup(createTempDir: () => string): SqliteJourney {
  const testDir = createTempDir();
  const dbPath = join(testDir, 'journey.db');
  const configPath = join(testDir, 'prisma.config.ts');
  const config = readFileSync(sqlitePslConfigFixture, 'utf-8').replace('{{DB_PATH}}', () => dbPath);
  writeFileSync(configPath, config, 'utf-8');
  writeFileSync(join(testDir, 'contract.prisma'), BASE, 'utf-8');
  writeProjectManifest(testDir);
  return { testDir, configPath, outputDir: testDir, dbPath };
}

function query(dbPath: string, sql: string): readonly Record<string, unknown>[] {
  const db = new DatabaseSync(dbPath);
  try {
    return db.prepare(sql).all();
  } finally {
    db.close();
  }
}

function exec(dbPath: string, sql: string): void {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(sql);
  } finally {
    db.close();
  }
}

async function emit(ctx: JourneyContext, psl: string): Promise<void> {
  writeFileSync(join(ctx.testDir, 'contract.prisma'), psl, 'utf-8');
  const emitted = await runContractEmit(ctx);
  expect(emitted.exitCode, `emit: ${emitted.stderr}`).toBe(0);
}

/** The base table, applied, with no rows. */
async function applied(createTempDir: () => string): Promise<SqliteJourney> {
  const ctx = setup(createTempDir);
  expect((await runContractEmit(ctx)).exitCode, 'emit base').toBe(0);
  const plan0 = await planMigrationAndSelfEmit(ctx, ['--name', 'initial']);
  expect(plan0.exitCode, `plan initial: ${plan0.stderr}`).toBe(0);
  const apply0 = await runMigrate(ctx);
  expect(apply0.exitCode, `apply initial: ${apply0.stderr}`).toBe(0);
  return ctx;
}

/** The base table, applied, with two rows. */
async function seeded(createTempDir: () => string): Promise<SqliteJourney> {
  const ctx = await applied(createTempDir);
  exec(ctx.dbPath, `INSERT INTO "User" (id, age, nickname) VALUES (1, '10', 'al'), (2, '7', NULL)`);
  return ctx;
}

const WITH_ROLE = `${BASE.replace('  nickname String?\n', '  nickname String?\n  role     Role\n')}
enum Role {
  @@type("sqlite/text@1")
  Admin = "admin"
  Member = "member"
}
`;

const WITH_CODE = BASE.replace(
  '  nickname String?\n',
  '  nickname String?\n  code     String @unique\n',
);

/** Plans the emitted contract from the latest migration, with no statement, and self-emits it. */
async function plannedPlain(ctx: SqliteJourney, name: string): Promise<string> {
  const planned = await planMigrationAndSelfEmit(ctx, [
    '--name',
    name,
    '--from',
    latestMigrationDirName(ctx),
  ]);
  expect(planned.exitCode, `plan: ${planned.stderr}`).toBe(0);
  return plannedDir(ctx, name.replaceAll('-', '_'));
}

function plannedDir(ctx: JourneyContext, token: string): string {
  const migrationsDir = join(ctx.testDir, 'migrations', 'app');
  const [dirName] = readdirSync(migrationsDir).filter((dir) => dir.includes(token));
  expect(dirName, `planned migration ${token}`).toBeDefined();
  return join(migrationsDir, dirName ?? '');
}

async function fillAndApply(
  ctx: JourneyContext,
  migrationDir: string,
  fill: (scaffold: string) => string,
): Promise<void> {
  const migrationTs = join(migrationDir, 'migration.ts');
  const filled = fill(readFileSync(migrationTs, 'utf-8'));
  expect(filled).not.toContain('placeholder(');
  writeFileSync(migrationTs, filled);
  const emitted = await selfEmitMigration(ctx, ['--dir', migrationDir, '--config', ctx.configPath]);
  expect(emitted.exitCode, `self-emit: ${emitted.stdout}\n${emitted.stderr}`).toBe(0);
  const applied = await runMigrate(ctx);
  expect(applied.exitCode, `apply: ${applied.stdout}\n${applied.stderr}`).toBe(0);
}

withTempDir(({ createTempDir }) => {
  describe('SQLite: --convert, --backfill and the temporary value on a table with rows', () => {
    it(
      'refuses db update --backfill without creating a database that does not exist',
      async () => {
        const ctx = setup(createTempDir);
        const missingDirectory = join(ctx.testDir, 'missing', 'journey.db');
        const elsewhere = { ...ctx, dbPath: missingDirectory };
        writeFileSync(
          ctx.configPath,
          readFileSync(ctx.configPath, 'utf-8').replace(ctx.dbPath, () => missingDirectory),
        );
        await emit(ctx, BASE.replace('age      String', 'age      Int'));
        const missingFile = setup(createTempDir);
        await emit(missingFile, BASE.replace('age      String', 'age      Int'));

        for (const journey of [elsewhere, missingFile]) {
          const refused = await runDbUpdate(journey, ['--backfill', 'User.age', '--json']);
          expect(parseJsonOutput(refused)).toMatchObject({
            code: 'MIGRATION.STATEMENT_NEEDS_MIGRATION_FILE',
          });
          expect(existsSync(journey.dbPath), journey.dbPath).toBe(false);
        }
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'converts a type change through the slot of the rebuild',
      async () => {
        const ctx = await seeded(createTempDir);
        await emit(ctx, BASE.replace('age      String', 'age      Int'));
        const from = ['--name', 'age-to-int', '--from', latestMigrationDirName(ctx)];

        const asked = await runMigrationPlan(ctx, [...from, '--json']);
        expect(asked.exitCode, 'a lossy type change is a question').toBe(2);
        expect(JSON.stringify(parseJsonOutput(asked))).toContain('--convert User.age');

        const planned = await runMigrationPlan(ctx, [...from, '--convert', 'User.age', '--json']);
        expect(planned.exitCode, `plan: ${planned.stderr}`).toBe(0);
        expect(parseJsonOutput(planned)).toMatchObject({ pendingPlaceholders: true });

        const slot = /placeholder\((['"])User\.age:using\1\)/;
        await fillAndApply(ctx, plannedDir(ctx, 'age_to_int'), (scaffold) => {
          expect(scaffold).toMatch(slot);
          return scaffold.replace(slot, `'CAST("age" AS INTEGER)'`);
        });

        expect(
          query(ctx.dbPath, `SELECT id, age, typeof(age) AS stored FROM "User" ORDER BY id`),
        ).toEqual([
          { id: 1, age: 10, stored: 'integer' },
          { id: 2, age: 7, stored: 'integer' },
        ]);
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'follows the advice of a --delete type change that cannot cast a value to a converted migration',
      async () => {
        const ctx = await seeded(createTempDir);
        exec(ctx.dbPath, `UPDATE "User" SET age = 'ten' WHERE id = 1`);
        await emit(ctx, BASE.replace('age      String', 'age      Int'));
        const deleted = await planMigrationAndSelfEmit(ctx, [
          '--name',
          'age-to-int',
          '--from',
          latestMigrationDirName(ctx),
          '--delete',
          'User.age',
        ]);
        expect(deleted.exitCode, `plan: ${deleted.stderr}`).toBe(0);

        const failed = await runMigrate(ctx, ['--json']);
        expect(failed.exitCode, 'the cast meets a value it cannot convert').not.toBe(0);
        const error = parseJsonOutput<{
          readonly why: string;
          readonly nextActions: readonly { readonly label: string }[];
        }>(failed);
        expect(error.why).toBe(
          `The value 'ten' of column "age" on "User" is still stored as text, which INTEGER cannot hold.`,
        );
        const advice = error.nextActions.map(({ label }) => label).join('\n');
        const followed =
          /delete `([^`]+)`, and plan it again with `\S+ migration plan ([^`]+)`/.exec(advice);
        expect(followed, advice).not.toBeNull();
        const [, directory = '', command = ''] = followed ?? [];
        expect(query(ctx.dbPath, `SELECT id, age FROM "User" ORDER BY id`)).toEqual([
          { id: 1, age: 'ten' },
          { id: 2, age: '7' },
        ]);

        rmSync(resolve(ctx.testDir, directory), { recursive: true });
        const planned = await runMigrationPlan(ctx, command.split(' '));
        expect(planned.exitCode, `plan as printed: ${planned.stdout}\n${planned.stderr}`).toBe(0);
        await fillAndApply(
          ctx,
          join(ctx.testDir, 'migrations', 'app', latestMigrationDirName(ctx)),
          (scaffold) =>
            scaffold.replace(
              /placeholder\((['"])User\.age:using\1\)/,
              `"CASE WHEN \\"age\\" = 'ten' THEN 10 ELSE CAST(\\"age\\" AS INTEGER) END"`,
            ),
        );

        expect(
          query(ctx.dbPath, `SELECT id, age, typeof(age) AS stored FROM "User" ORDER BY id`),
        ).toEqual([
          { id: 1, age: 10, stored: 'integer' },
          { id: 2, age: 7, stored: 'integer' },
        ]);
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'gives a new required field a temporary value in the old rows, then makes it NOT NULL',
      async () => {
        const ctx = await seeded(createTempDir);
        await emit(
          ctx,
          BASE.replace('  nickname String?\n', '  nickname String?\n  name     String\n'),
        );
        const planned = await runMigrationPlan(ctx, [
          '--name',
          'add-name',
          '--from',
          latestMigrationDirName(ctx),
          '--json',
        ]);
        expect(planned.exitCode, `plan: ${planned.stderr}`).toBe(0);
        expect(parseJsonOutput(planned)).not.toHaveProperty('pendingPlaceholders');

        const migrationDir = plannedDir(ctx, 'add_name');
        const opsPlanned = readFileSync(join(migrationDir, 'ops.json'), 'utf-8');
        await fillAndApply(ctx, migrationDir, (scaffold) => scaffold);
        expect(readFileSync(join(migrationDir, 'ops.json'), 'utf-8')).toBe(opsPlanned);

        expect(query(ctx.dbPath, `SELECT id, name FROM "User" ORDER BY id`)).toEqual([
          { id: 1, name: '' },
          { id: 2, name: '' },
        ]);
        expect(
          query(
            ctx.dbPath,
            `SELECT "notnull", dflt_value FROM pragma_table_info('User') WHERE name = 'name'`,
          ),
        ).toEqual([{ notnull: 1, dflt_value: null }]);
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'adds a new required field nullable, fills it through the backfill slot, then tightens it',
      async () => {
        const ctx = await seeded(createTempDir);
        await emit(
          ctx,
          BASE.replace('  nickname String?\n', '  nickname String?\n  name     String\n'),
        );
        const planned = await runMigrationPlan(ctx, [
          '--name',
          'backfill-name',
          '--from',
          latestMigrationDirName(ctx),
          '--backfill',
          'User.name',
          '--json',
        ]);
        expect(planned.exitCode, `plan: ${planned.stderr}`).toBe(0);

        const slot = /\(\) => placeholder\((['"])User\.name:run\1\)/;
        await fillAndApply(ctx, plannedDir(ctx, 'backfill_name'), (scaffold) => {
          expect(scaffold).toMatch(slot);
          return scaffold.replace(
            slot,
            '() => `UPDATE "User" SET name = \'user \' || id WHERE name IS NULL`',
          );
        });

        expect(query(ctx.dbPath, `SELECT id, name FROM "User" ORDER BY id`)).toEqual([
          { id: 1, name: 'user 1' },
          { id: 2, name: 'user 2' },
        ]);
        expect(
          query(ctx.dbPath, `SELECT "notnull" FROM pragma_table_info('User') WHERE name = 'name'`),
        ).toEqual([{ notnull: 1 }]);
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'fills an optional field made required through the backfill slot, then tightens it',
      async () => {
        const ctx = await seeded(createTempDir);
        await emit(ctx, BASE.replace('nickname String?', 'nickname String '));
        const planned = await runMigrationPlan(ctx, [
          '--name',
          'nickname-required',
          '--from',
          latestMigrationDirName(ctx),
          '--backfill',
          'User.nickname',
          '--json',
        ]);
        expect(planned.exitCode, `plan: ${planned.stderr}`).toBe(0);

        const slot = /\(\) => placeholder\((['"])User\.nickname:run\1\)/;
        await fillAndApply(ctx, plannedDir(ctx, 'nickname_required'), (scaffold) => {
          expect(scaffold).toMatch(slot);
          return scaffold.replace(
            slot,
            '() => `UPDATE "User" SET nickname = \'anon\' WHERE nickname IS NULL`',
          );
        });

        expect(query(ctx.dbPath, `SELECT id, nickname FROM "User" ORDER BY id`)).toEqual([
          { id: 1, nickname: 'al' },
          { id: 2, nickname: 'anon' },
        ]);
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'gives a new required enum field no temporary value, so a table with rows refuses it',
      async () => {
        const ctx = await seeded(createTempDir);
        await emit(ctx, WITH_ROLE);
        const migrationDir = await plannedPlain(ctx, 'add-role');
        expect(readFileSync(join(migrationDir, 'migration.ts'), 'utf-8')).not.toContain(
          'copyExpressions',
        );

        const refused = await runMigrate(ctx);
        expect(refused.exitCode, 'the rebuild cannot copy the rows').not.toBe(0);
        expect(`${refused.stdout}${refused.stderr}`).toContain('NOT NULL');
        expect(
          query(ctx.dbPath, `SELECT name FROM pragma_table_info('User') ORDER BY name`),
        ).toEqual([{ name: 'age' }, { name: 'id' }, { name: 'nickname' }]);
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'carries a new required unique field through the rebuild, which applies to an empty table',
      async () => {
        const ctx = await applied(createTempDir);
        await emit(ctx, WITH_CODE);
        await plannedPlain(ctx, 'add-code');
        const added = await runMigrate(ctx);
        expect(added.exitCode, `apply: ${added.stdout}\n${added.stderr}`).toBe(0);
        expect(
          query(ctx.dbPath, `SELECT "notnull" FROM pragma_table_info('User') WHERE name = 'code'`),
        ).toEqual([{ notnull: 1 }]);
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'carries a new required unique field through the rebuild, which a table with rows refuses',
      async () => {
        const ctx = await seeded(createTempDir);
        await emit(ctx, WITH_CODE);
        await plannedPlain(ctx, 'add-code');
        const refused = await runMigrate(ctx);
        expect(refused.exitCode, 'the rebuild cannot copy the rows').not.toBe(0);
        expect(`${refused.stdout}${refused.stderr}`).toContain('NOT NULL');
        expect(query(ctx.dbPath, `SELECT count(*) AS rows FROM "User"`)).toEqual([{ rows: 2 }]);
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'follows the advice for two new required fields without a value to a migration that fills both',
      async () => {
        const ctx = await seeded(createTempDir);
        await emit(
          ctx,
          WITH_ROLE.replace('  role     Role\n', '  role     Role\n  code     String @unique\n'),
        );
        await plannedPlain(ctx, 'role-and-code');

        const failed = await runMigrate(ctx, ['--json']);
        expect(failed.exitCode).not.toBe(0);
        const error = parseJsonOutput<{
          readonly nextActions: readonly { readonly label: string }[];
        }>(failed);
        const advice = error.nextActions.map(({ label }) => label).join('\n');
        const directory = /delete `([^`]+)`/.exec(advice)?.[1];
        const command = /`\S+ migration plan ([^`]+)`/.exec(advice)?.[1];
        expect([directory, command], advice).toEqual([expect.any(String), expect.any(String)]);
        const args = (command ?? '').split(' ');
        expect(args).toEqual(expect.arrayContaining(['--backfill', 'User.role', 'User.code']));

        rmSync(resolve(ctx.testDir, directory ?? ''), { recursive: true });
        const planned = await runMigrationPlan(ctx, args);
        expect(planned.exitCode, `plan as printed: ${planned.stdout}\n${planned.stderr}`).toBe(0);
        await fillAndApply(
          ctx,
          join(ctx.testDir, 'migrations', 'app', latestMigrationDirName(ctx)),
          (scaffold) =>
            scaffold
              .replace(
                /\(\) => placeholder\((['"])User\.role:run\1\)/,
                '() => `UPDATE "User" SET role = \'member\' WHERE role IS NULL`',
              )
              .replace(
                /\(\) => placeholder\((['"])User\.code:run\1\)/,
                '() => `UPDATE "User" SET code = \'c\' || id WHERE code IS NULL`',
              ),
        );

        expect(query(ctx.dbPath, `SELECT id, role, code FROM "User" ORDER BY id`)).toEqual([
          { id: 1, role: 'member', code: 'c1' },
          { id: 2, role: 'member', code: 'c2' },
        ]);
      },
      timeouts.spinUpPpgDev,
    );
  });
});
