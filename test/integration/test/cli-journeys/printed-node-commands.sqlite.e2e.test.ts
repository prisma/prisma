/**
 * The `node` commands the CLI prints run as printed from the directory the CLI ran in, when
 * `--config` names a config in another directory: the one `migration new` prints, the one
 * `migration plan` prints for a migration with slots to fill, and the one in the advice of a
 * `db migrate` whose conversion failed.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';
import { runOnEngine, withTempDir, writeProjectManifest } from '../utils/cli-test-helpers';
import { sqlitePslConfigFixture, timeouts } from '../utils/journey-test-helpers';

const CONFIG = 'app/prisma.config.ts';

const psl = (age: 'String' | 'Int') => `// use prisma-8

model User {
  id  Int    @id
  age ${age}
}
`;

interface Project {
  readonly parent: string;
  readonly appDir: string;
  readonly dbPath: string;
}

function writeProject(parent: string): Project {
  const appDir = join(parent, 'app');
  mkdirSync(appDir, { recursive: true });
  const dbPath = join(appDir, 'journey.db');
  const config = readFileSync(sqlitePslConfigFixture, 'utf-8')
    .replace('{{DB_PATH}}', () => dbPath)
    .replace("migrations: { dir: 'migrations' }", "migrations: { dir: './db/migrations' }");
  writeFileSync(join(parent, CONFIG), config, 'utf-8');
  writeFileSync(join(appDir, 'contract.prisma'), psl('String'), 'utf-8');
  writeProjectManifest(appDir);
  return { parent, appDir, dbPath };
}

/** Runs the CLI from the parent directory, naming the config in `app/` as a user would type it. */
async function cli(project: Project, argv: readonly string[]) {
  const run = await runOnEngine(
    { testDir: project.parent, configPath: join(project.parent, CONFIG) },
    [...argv, '--config', CONFIG],
  );
  return { ...run, output: `${run.stdout}\n${run.stderr}` };
}

/** The arguments of the first `node "…"` command in `text`, as printed, also inside JSON output. */
function printedNodeCommand(text: string): readonly string[] {
  const match = /node "([^"]+)"(?: --config "([^"]+)")?/.exec(text.replaceAll('\\"', '"'));
  expect(match, `no node command in:\n${text}`).not.toBeNull();
  const [, file = '', config] = match ?? [];
  return config === undefined ? [file] : [file, '--config', config];
}

function runPrinted(project: Project, args: readonly string[]) {
  const run = spawnSync(process.execPath, [...args], { cwd: project.parent, encoding: 'utf-8' });
  return { exitCode: run.status, output: `${run.stdout}\n${run.stderr}` };
}

/** The name of the latest migration directory of the app space. */
function latestMigration(project: Project): string {
  const names = readdirSync(join(project.appDir, 'db/migrations/app')).filter(
    (name) => name !== 'refs',
  );
  return names.sort().at(-1) ?? '';
}

function exec(dbPath: string, sql: string): void {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(sql);
  } finally {
    db.close();
  }
}

withTempDir(({ createTempDir }) => {
  describe('node commands printed for a config in another directory', () => {
    it(
      'run as printed from the directory the CLI ran in',
      async () => {
        const project = writeProject(createTempDir());
        expect((await cli(project, ['contract', 'emit'])).exitCode, 'emit').toBe(0);
        const initial = await cli(project, ['migration', 'plan', '--name', 'initial']);
        expect(initial.exitCode, `plan: ${initial.output}`).toBe(0);
        expect((await cli(project, ['db', 'migrate'])).exitCode, 'migrate').toBe(0);
        exec(project.dbPath, `INSERT INTO "User" (id, age) VALUES (1, 'ten'), (2, '7')`);

        writeFileSync(join(project.appDir, 'contract.prisma'), psl('Int'), 'utf-8');
        expect((await cli(project, ['contract', 'emit'])).exitCode, 'emit Int').toBe(0);
        const planned = await cli(project, [
          'migration',
          'plan',
          '--name',
          'age-to-int',
          '--from',
          latestMigration(project),
          '--convert',
          'User.age',
        ]);
        expect(planned.exitCode, `plan --convert: ${planned.output}`).toBe(0);
        const command = printedNodeCommand(planned.output);
        const migrationTs = join(project.parent, command[0] ?? '');
        const scaffold = readFileSync(migrationTs, 'utf-8');
        const slot = /placeholder\((['"])User\.age:convert\1\)/;

        writeFileSync(migrationTs, scaffold.replace(slot, `'trim("age")'`));
        const emitted = runPrinted(project, command);
        expect(emitted.exitCode, `migration plan's command: ${emitted.output}`).toBe(0);
        const failed = await cli(project, ['db', 'migrate', '--json']);
        expect(failed.exitCode, 'the conversion leaves a text value').not.toBe(0);
        const advice = runPrinted(project, printedNodeCommand(failed.output));

        writeFileSync(
          migrationTs,
          scaffold.replace(
            slot,
            `"CASE WHEN \\"age\\" = 'ten' THEN 10 ELSE CAST(\\"age\\" AS INTEGER) END"`,
          ),
        );
        const fixed = runPrinted(project, printedNodeCommand(failed.output));
        expect({ advice: advice.exitCode, fixed: fixed.exitCode }, fixed.output).toEqual({
          advice: 0,
          fixed: 0,
        });
        const applied = await cli(project, ['db', 'migrate']);
        expect(applied.exitCode, `migrate: ${applied.output}`).toBe(0);

        const scaffolded = await cli(project, [
          'migration',
          'new',
          '--name',
          'by-hand',
          '--from',
          JSON.parse(readFileSync(join(dirname(migrationTs), 'migration.json'), 'utf-8')).to,
        ]);
        expect(scaffolded.exitCode, `migration new: ${scaffolded.output}`).toBe(0);
        const byHand = runPrinted(project, printedNodeCommand(scaffolded.output));
        expect(byHand.exitCode, `migration new's command: ${byHand.output}`).toBe(0);
      },
      timeouts.spinUpPpgDev,
    );
  });
});
