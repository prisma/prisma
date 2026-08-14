/**
 * A written `migration.ts` names the packages its project installs.
 *
 * The file is one the application keeps, so every package name in it has to
 * be one the application can resolve — which means one of its direct
 * dependencies (ADR 242). The import root comes from the project's own
 * `package.json`, the same way `contract.d.ts` gets it, so this journey runs
 * the real commands against projects that differ only in their manifest and
 * reads the bytes they wrote.
 *
 * The last case is why it matters: a project on the facade root whose
 * migration still named `@internal/*` would name two import roots at once,
 * which `scripts/lint-single-import-root.mjs` rejects because the two roots
 * are separate copies of the same modules. That case runs the lint itself
 * over real command output rather than reasoning about what it would say, and
 * runs it twice — once on a scaffold that must pass and once on one that must
 * fail — so a pass cannot mean the lint simply stopped finding things.
 *
 * No database: `contract emit`, `migration new` and `migration plan` are all
 * offline.
 *
 * Package names are built from the constants below rather than written into
 * assertions as literals. `test/` is a consumer tree, so both
 * `lint-single-import-root.mjs` and `lint-consumer-internal-imports.mjs` scan
 * this file for import specifiers, and neither can tell an assertion string
 * from a real import.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import {
  type JourneyContext,
  runContractEmit,
  runMigrationNew,
  runMigrationPlan,
  setupJourney,
  timeouts,
} from '../utils/journey-test-helpers';

const FACADE = '@prisma/orm-postgres';
const WORKSPACE = '@internal/postgres';

const FACADE_MANIFEST = {
  name: 'facade-only-app',
  private: true,
  type: 'module',
  dependencies: { [FACADE]: '0.16.0' },
};

const INTERNAL_SCOPE = '@internal/';
const SPECIFIER = /\b(?:from|import)\s*\(?\s*['"]([^'"\n]+)['"]/g;

const SINGLE_IMPORT_ROOT_LINT = fileURLToPath(
  new URL('../../../../scripts/lint-single-import-root.mjs', import.meta.url),
);

/** The lint's own verdict on `baseDir`, run the way CI runs it. */
function singleImportRootLint(baseDir: string): { status: number; output: string } {
  const run = spawnSync(process.execPath, [SINGLE_IMPORT_ROOT_LINT, baseDir], { encoding: 'utf8' });
  return { status: run.status ?? 1, output: `${run.stdout}${run.stderr}` };
}

/** Package names a source file imports; relative paths are not root-governed. */
function packageImports(source: string): string[] {
  return [...source.matchAll(SPECIFIER)]
    .map(([, specifier]) => specifier ?? '')
    .filter((specifier) => !specifier.startsWith('.'))
    .sort();
}

/** The `migration.ts` just written, from the one app-space package. */
function writtenMigrationTs(ctx: JourneyContext): string {
  const appDir = join(ctx.testDir, 'migrations', 'app');
  const [dirName, ...rest] = readdirSync(appDir).filter((entry) => !entry.startsWith('.'));
  expect(rest, 'expected exactly one migration package').toEqual([]);
  return readFileSync(join(appDir, dirName!, 'migration.ts'), 'utf-8');
}

function facadeOnly(ctx: JourneyContext): JourneyContext {
  writeFileSync(join(ctx.testDir, 'package.json'), JSON.stringify(FACADE_MANIFEST, null, 2));
  return ctx;
}

async function emitContract(ctx: JourneyContext): Promise<void> {
  const emit = await runContractEmit(ctx);
  expect(emit.exitCode, `contract emit: ${emit.stderr}`).toBe(0);
}

async function scaffoldMigration(ctx: JourneyContext, name: string): Promise<string> {
  await emitContract(ctx);
  const scaffold = await runMigrationNew(ctx, ['--name', name]);
  expect(scaffold.exitCode, `migration new: ${scaffold.stderr}`).toBe(0);
  return writtenMigrationTs(ctx);
}

async function planMigration(ctx: JourneyContext, name: string): Promise<string> {
  await emitContract(ctx);
  const planned = await runMigrationPlan(ctx, ['--name', name]);
  expect(planned.exitCode, `migration plan: ${planned.stderr}`).toBe(0);
  return writtenMigrationTs(ctx);
}

const lintFixtures: string[] = [];

/**
 * A facade-only consumer package on disk: the manifest and config a user
 * writes, plus `migrationTs` as its one generated file. Laid out under
 * `examples/` because that is one of the consumer roots the lint script walks.
 *
 * Built outside the repository rather than in the journey's own temp dir,
 * which lives under `test/` — a tree the real lint walks.
 */
function facadeOnlyProject(migrationTs: string): string {
  const base = mkdtempSync(join(tmpdir(), 'facade-only-project-'));
  lintFixtures.push(base);
  const projectDir = join(base, 'examples', 'app');
  mkdirSync(join(projectDir, 'migrations', 'app', '00001_new'), { recursive: true });
  writeFileSync(join(projectDir, 'package.json'), JSON.stringify(FACADE_MANIFEST, null, 2));
  writeFileSync(
    join(projectDir, 'prisma.config.ts'),
    `import postgres from '${FACADE}/control';\nexport default postgres;\n`,
  );
  writeFileSync(join(projectDir, 'migrations', 'app', '00001_new', 'migration.ts'), migrationTs);
  return base;
}

withTempDir(({ createTempDir }) => {
  describe('Journey: a written migration.ts follows the project’s import root', () => {
    afterEach(() => {
      for (const dir of lintFixtures.splice(0)) rmSync(dir, { recursive: true, force: true });
    });

    it(
      'names workspace packages in a project that depends on workspace packages',
      async () => {
        const migrationTs = await scaffoldMigration(setupJourney({ createTempDir }), 'workspace');

        expect(packageImports(migrationTs)).toEqual([`${WORKSPACE}/migration`]);
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'names the facade in a project that depends on the facade',
      async () => {
        const ctx = facadeOnly(setupJourney({ createTempDir }));

        const migrationTs = await scaffoldMigration(ctx, 'facade');

        expect(packageImports(migrationTs)).toEqual([`${FACADE}/migration`]);

        // The emitted pair has to agree: a project whose contract types name
        // the facade while its migration names the workspace is exactly the
        // mixed-root state the last case rejects.
        const contractDts = readFileSync(join(ctx.outputDir, 'contract.d.ts'), 'utf-8');
        expect(
          packageImports(contractDts).filter((specifier) => specifier.startsWith(INTERNAL_SCOPE)),
        ).toEqual([]);
      },
      timeouts.typeScriptCompilation,
    );

    // `migration plan` writes a `migration.ts` the same way `migration new`
    // does, from a plan the planner filled rather than an empty one.
    it(
      'names the facade from a planned migration too',
      async () => {
        const ctx = facadeOnly(setupJourney({ createTempDir }));

        const migrationTs = await planMigration(ctx, 'facade');

        expect(packageImports(migrationTs)).toEqual([`${FACADE}/migration`]);
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'leaves a facade-only project on one import root',
      async () => {
        const onFacade = await scaffoldMigration(
          facadeOnly(setupJourney({ createTempDir })),
          'facade',
        );

        const accepted = singleImportRootLint(facadeOnlyProject(onFacade));
        expect(accepted.status, accepted.output).toBe(0);
        expect(accepted.output).toContain('No consumer package');

        // The same project holding a workspace-named migration instead: that
        // is what the lint exists to catch, so a green result above means the
        // written file changed, not that the check stopped looking.
        const onWorkspace = await scaffoldMigration(setupJourney({ createTempDir }), 'workspace');

        const refused = singleImportRootLint(facadeOnlyProject(onWorkspace));
        expect(refused.status).toBe(1);
        expect(refused.output).toContain('examples/app');
      },
      timeouts.typeScriptCompilation,
    );
  });
});
