/**
 * Nullable tightening — `nullableTighteningCallStrategy` end-to-end.
 *
 * Drives a contract change that flips an existing column from
 * nullable to NOT NULL (no `addColumn`, no type change). The Postgres
 * planner's `nullableTighteningCallStrategy` matches this
 * case and emits `DataTransformCall(placeholder slots) → setNotNull`,
 * so the planner-emitted `migration.ts` has two `placeholder("…")`
 * stubs the user must fill in to backfill any existing NULL rows
 * before the constraint is tightened. This test simulates the user
 * editing the file (string-patching the stubs and injecting a
 * `db = sql({ context, rawCodecInferer: { inferCodec: () => 'pg/text' } })` setup), then runs `migration emit` +
 * `migration apply` and asserts the post-apply NULL row has been
 * backfilled and the column is NOT NULL.
 *
 * Phase 2 acceptance: covers `postgresPlannerStrategies` (data-safe path) end-to-end
 * for the nullable-tightening case (plan.md AC R2.2 #3).
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import {
  injectMigrationSqlDbSetup,
  type JourneyContext,
  runContractEmit,
  runMigrate,
  runMigrationEmit,
  runMigrationPlan,
  runMigrationPlanAndEmit,
  setupJourney,
  sql,
  swapContract,
  timeouts,
  useDevDatabase,
} from '../utils/journey-test-helpers';

const BACKFILLED_NAME = 'unknown';

withTempDir(({ createTempDir }) => {
  describe('Journey: dataTransform — nullable → NOT NULL tightening (planner-assisted)', () => {
    const db = useDevDatabase();

    it(
      'planner emits placeholder() stubs the user fills in; apply backfills NULLs + tightens to NOT NULL',
      async () => {
        const ctx: JourneyContext = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
        });

        // Initial contract: User.name is nullable. Apply, then seed
        // both a row with a name and a row with NULL — the latter is
        // what the user-filled `:run` query has to backfill before
        // setNotNull can succeed.
        swapContract(ctx, 'contract-nullable-name');
        const emit0 = await runContractEmit(ctx);
        expect(emit0.exitCode, `emit base: ${emit0.stderr}`).toBe(0);
        const plan0 = await runMigrationPlanAndEmit(ctx, ['--name', 'initial']);
        expect(plan0.exitCode, `plan initial: ${plan0.stderr}`).toBe(0);
        const apply0 = await runMigrate(ctx);
        expect(apply0.exitCode, `apply initial: ${apply0.stderr}`).toBe(0);

        await sql(
          db.connectionString,
          `INSERT INTO "public"."user" (id, email, "name") VALUES (1, 'alice@example.com', 'Alice'), (2, 'bob@test.org', NULL)`,
        );

        // Swap to the NOT NULL contract: this is the input to
        // `nullableTighteningCallStrategy`.
        swapContract(ctx, 'contract-nullable-name-required');
        const emit1 = await runContractEmit(ctx);
        expect(emit1.exitCode, `emit required: ${emit1.stderr}`).toBe(0);

        const planResult = await runMigrationPlan(ctx, ['--name', 'tighten-name-not-null']);
        expect(planResult.exitCode, `plan: ${planResult.stdout}\n${planResult.stderr}`).toBe(0);

        const migrationsDir = join(ctx.testDir, 'migrations', 'app');
        const migrationDirs = readdirSync(migrationsDir)
          .filter((d) => d.includes('tighten_name_not_null'))
          .sort();
        expect(migrationDirs.length, 'planned migration dir exists').toBe(1);
        const migrationDir = join(migrationsDir, migrationDirs[0]!);
        const migrationTsPath = join(migrationDir, 'migration.ts');

        const scaffold = readFileSync(migrationTsPath, 'utf-8');
        expect(scaffold).toContain("placeholder('handle-nulls-user-name:check')");
        expect(scaffold).toContain("placeholder('handle-nulls-user-name:run')");
        expect(scaffold).toContain('setNotNull');
        // The planner *must not* emit an addColumn for `name` here:
        // this is the tightening case, the column already exists.
        expect(scaffold).not.toContain('addColumn');
        const manifestBefore = JSON.parse(
          readFileSync(join(migrationDir, 'migration.json'), 'utf-8'),
        );
        // The package is fully attested even when the planner could not
        // lower any calls because of placeholders: `ops.json` is `[]` and
        // `migrationHash` is the content-address over `(manifest, [])`.
        // The author re-emits after filling in placeholders to rewrite
        // both `ops.json` and `migrationHash`.
        expect(manifestBefore.migrationHash).toMatch(/^[a-f0-9]{64}$/);
        expect(JSON.parse(readFileSync(join(migrationDir, 'ops.json'), 'utf-8'))).toEqual([]);

        const filled = injectMigrationSqlDbSetup(scaffold)
          .replace(
            "() => placeholder('handle-nulls-user-name:check')",
            "() => db.public.user.select('id').where((f, fns) => fns.eq(f.name, null)).limit(1)",
          )
          .replace(
            "() => placeholder('handle-nulls-user-name:run')",
            `() => db.public.user.update({ name: '${BACKFILLED_NAME}' }).where((f, fns) => fns.eq(f.name, null))`,
          );
        expect(filled).not.toContain('placeholder(');
        expect(filled).toContain('const db = sql(');
        writeFileSync(migrationTsPath, filled);

        const emitResult = await runMigrationEmit(ctx, [
          '--dir',
          migrationDir,
          '--config',
          ctx.configPath,
        ]);
        expect(emitResult.exitCode, `emit: ${emitResult.stdout}\n${emitResult.stderr}`).toBe(0);

        const opsAfterEmit = JSON.parse(readFileSync(join(migrationDir, 'ops.json'), 'utf-8'));
        const dataTransformOp = opsAfterEmit.find(
          (op: { id: string }) => op.id === 'data_migration.handle-nulls-user-name',
        );
        expect(dataTransformOp, 'dataTransform op exists').toBeDefined();
        expect(dataTransformOp.operationClass).toBe('data');
        expect(dataTransformOp.precheck).toHaveLength(1);
        expect(dataTransformOp.execute).toHaveLength(1);
        expect(dataTransformOp.postcheck).toHaveLength(1);

        const setNotNullOp = opsAfterEmit.find((op: { id: string }) =>
          op.id.includes('setNotNull.user.name'),
        );
        expect(setNotNullOp, 'setNotNull op exists').toBeDefined();

        const apply1 = await runMigrate(ctx);
        expect(apply1.exitCode, `apply: ${apply1.stdout}\n${apply1.stderr}`).toBe(0);

        const result = await sql(
          db.connectionString,
          `SELECT id, email, "name" FROM "public"."user" ORDER BY id`,
        );
        expect(result.rows).toEqual([
          { id: 1, email: 'alice@example.com', name: 'Alice' },
          { id: 2, email: 'bob@test.org', name: BACKFILLED_NAME },
        ]);

        const colInfo = await sql(
          db.connectionString,
          `SELECT is_nullable FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'name'`,
        );
        expect(colInfo.rows).toEqual([{ is_nullable: 'NO' }]);
      },
      timeouts.spinUpPpgDev,
    );
  });
});
