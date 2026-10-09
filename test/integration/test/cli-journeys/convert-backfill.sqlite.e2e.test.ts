/**
 * `--convert`, `--backfill` and the temporary value on SQLite, end to end on a table with rows:
 * `migration plan` writes the rebuild or the data transform, the user fills its slot, runs the
 * `migration.ts`, and `db migrate` applies it.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';
import { withTempDir, writeProjectManifest } from '../utils/cli-test-helpers';
import {
  type JourneyContext,
  latestMigrationDirName,
  parseJsonOutput,
  planMigrationAndSelfEmit,
  runContractEmit,
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

/** The base table, applied, with two rows. */
async function seeded(createTempDir: () => string): Promise<SqliteJourney> {
  const ctx = setup(createTempDir);
  expect((await runContractEmit(ctx)).exitCode, 'emit base').toBe(0);
  const plan0 = await planMigrationAndSelfEmit(ctx, ['--name', 'initial']);
  expect(plan0.exitCode, `plan initial: ${plan0.stderr}`).toBe(0);
  const apply0 = await runMigrate(ctx);
  expect(apply0.exitCode, `apply initial: ${apply0.stderr}`).toBe(0);
  exec(ctx.dbPath, `INSERT INTO "User" (id, age, nickname) VALUES (1, '10', 'al'), (2, '7', NULL)`);
  return ctx;
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
  });
});
