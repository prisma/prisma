/**
 * `node migration.ts` finds the project's config by walking up from the migration's own directory, so it runs from any working directory, including when `migrations.dir` is not the default.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'pathe';
import { describe, expect, it } from 'vitest';
import { withTempDir, writeProjectManifest } from '../utils/cli-test-helpers';
import {
  type JourneyContext,
  runContractEmit,
  runMigrationPlan,
  sqlitePslConfigFixture,
  timeouts,
} from '../utils/journey-test-helpers';

const PSL = `// use prisma-8

model Profile {
  id   Int    @id
  name String
}
`;

function setupProject(createTempDir: () => string): JourneyContext {
  const testDir = createTempDir();
  const configPath = join(testDir, 'prisma.config.ts');
  const config = readFileSync(sqlitePslConfigFixture, 'utf-8')
    .replace('{{DB_PATH}}', () => join(testDir, 'journey.db'))
    .replace("migrations: { dir: 'migrations' }", "migrations: { dir: './db/migrations' }");
  writeFileSync(configPath, config, 'utf-8');
  writeFileSync(join(testDir, 'contract.prisma'), PSL, 'utf-8');
  writeProjectManifest(testDir);
  return { testDir, configPath, outputDir: testDir };
}

function runNode(file: string, cwd: string) {
  const run = spawnSync(process.execPath, [file], { cwd, encoding: 'utf-8' });
  return { exitCode: run.status, stdout: run.stdout, stderr: run.stderr };
}

withTempDir(({ createTempDir }) => {
  describe('node migration.ts', () => {
    it(
      'finds the config from the migration directory and from the project directory',
      async () => {
        const ctx = setupProject(createTempDir);
        const emitted = await runContractEmit(ctx);
        expect(emitted.exitCode, `emit: ${emitted.stderr}`).toBe(0);
        const planned = await runMigrationPlan(ctx, ['--name', 'initial']);
        expect(planned.exitCode, `plan: ${planned.stderr}`).toBe(0);
        const appDir = join(ctx.testDir, 'db/migrations/app');
        const [dir] = readdirSync(appDir).filter((name) => name !== 'refs');
        const migrationDir = join(appDir, String(dir));

        const fromMigrationDir = runNode('migration.ts', migrationDir);
        expect(fromMigrationDir, 'from the migration directory').toMatchObject({
          exitCode: 0,
          stdout: expect.stringContaining('Wrote ops.json + migration.json'),
        });

        const fromProjectDir = runNode(
          relative(ctx.testDir, join(migrationDir, 'migration.ts')),
          ctx.testDir,
        );
        expect(fromProjectDir, 'from the project directory').toMatchObject({
          exitCode: 0,
          stdout: expect.stringContaining('Wrote ops.json + migration.json'),
        });
      },
      timeouts.spinUpPpgDev,
    );
  });
});
