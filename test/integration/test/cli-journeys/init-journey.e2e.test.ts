/**
 * `prisma-next init` user-journey test (TML-2490) — seam verifier.
 *
 * Walks the full user inner loop from `prisma-next init` through to a working
 * query against a real DB, across all four `(target × authoring)` cells.
 * Asserts the contract one subsystem hands to the next at every seam.
 *
 * Each known seam bug (TML-2461, TML-2486, TML-2487, TML-2314) is expressed
 * as a `seamExpectation` whose `status` records whether the seam is still
 * `'broken'` or already `'fixed'`. While a seam is `'broken'` the test
 * passes precisely *because* the bug is still present (the
 * `whenBroken` assertion holds); when the fix lands, the maintainer flips
 * the status to `'fixed'` and the `whenFixed` assertion takes over. This
 * keeps the test honest as a regression backstop without forcing the
 * journey to be temporarily disabled around an in-flight fix.
 */

import { existsSync, readFileSync } from 'node:fs';
import { timeouts } from '@repo/test-utils';
import { join } from 'pathe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DatabaseHandle, spinUpDatabaseForCell } from './init-journey/database-handles';
import {
  ALL_CELLS,
  attachDatabase,
  type CellId,
  type CommandRun,
  cellLabel,
  createJourneyProject,
  emitContract,
  type JourneyProject,
  migrationApply,
  migrationPlan,
  runUserCode,
  type StepResult,
  seamExpectation,
  selfEmitLatestMigration,
} from './init-journey/harness';

/** Per-cell journey runtime artefacts, populated once in `beforeAll`. */
interface JourneyContext {
  readonly project: JourneyProject;
  readonly database: DatabaseHandle | null;
  readonly emit: StepResult | null;
  readonly migrationPlan: StepResult | null;
  readonly migrationEmit: StepResult | null;
  readonly migrationApply: StepResult | null;
}

describe.each(ALL_CELLS.map((cell) => ({ cell, label: cellLabel(cell) })))(
  'init-journey · $label',
  ({ cell }) => {
    let ctx: JourneyContext;

    beforeAll(async () => {
      ctx = await runFullJourney(cell);
    }, 240_000);

    afterAll(async () => {
      await ctx?.database?.close();
      ctx?.project?.cleanup();
    });

    it('step 1 (init): scaffolds the expected project skeleton', () => {
      expect(ctx.project.initResult.exitCode, formatInitDiagnostic(ctx.project)).toBe(0);

      expectScaffoldedFiles(ctx.project);
      expectSchemaFile(ctx.project, cell);
      expectConfigFile(ctx.project, cell);
      expectPackageJsonIsEsm(ctx.project);
    });

    it('step 2 (install): pnpm install succeeds with isolated linker', () => {
      const install = ctx.project.installResult;
      expect(install, 'install was skipped — harness option mismatch').not.toBeNull();
      if (install === null) return;
      expect(install.exitCode, formatInstallDiagnostic(ctx.project, install)).toBe(0);

      expectFacadeIsResolvable(ctx.project);
    });

    it('step 3 (emit): produces contract.json + contract.d.ts next to the input', () => {
      const emit = ctx.emit;
      expect(emit, 'emit was not run (precondition failure)').not.toBeNull();
      if (emit === null) return;
      expect(emit.exitCode, formatStepDiagnostic('emit', ctx.project, emit)).toBe(0);

      // The init scaffold passes a single string `contract: "./src/prisma/contract.ts"`
      // to the facade `defineConfig`, which derives an output path next to the
      // input. The journey verifies that derivation actually reaches the emitter
      // — this is the seam that breaks when init scaffold and emit output get
      // out of sync (the symptom shape of TML-2461, even if the facade currently
      // masks the underlying default-output bug).
      expect(
        existsSync(join(ctx.project.dir, 'src/prisma/contract.json')),
        'contract.json must land next to the scaffolded contract source',
      ).toBe(true);
      expect(
        existsSync(join(ctx.project.dir, 'src/prisma/contract.d.ts')),
        'contract.d.ts must land next to the scaffolded contract source',
      ).toBe(true);
    });

    it('step 4a (migration plan): materialises a create-from-scratch migration draft', () => {
      const result = ctx.migrationPlan;
      expect(result, 'migration plan was not run (precondition failure)').not.toBeNull();
      if (result === null) return;
      expect(result.exitCode, formatStepDiagnostic('migration plan', ctx.project, result)).toBe(0);
      expect(
        existsSync(join(ctx.project.dir, 'migrations/app')),
        'migration plan must create migrations/app/<timestamp>_init/',
      ).toBe(true);
    });

    it('step 4b (migration emit): self-emits ops.json next to the draft migration.ts', () => {
      const result = ctx.migrationEmit;
      expect(result, 'migration self-emit was not run (precondition failure)').not.toBeNull();
      if (result === null) return;
      expect(result.exitCode, formatStepDiagnostic('migration emit', ctx.project, result)).toBe(0);
    });

    it('step 4c (migration apply): applies the planned migration (TML-2486 seam)', () => {
      const result = ctx.migrationApply;
      expect(result, 'migration apply was not run (precondition failure)').not.toBeNull();
      if (result === null) return;
      TML_2486_seam(cell, ctx.project, result);
    });

    it(
      'step 5 (user code: ObjectId import) (TML-2487 seam)',
      async () => {
        if (cell.target !== 'mongo') return;
        const run = await runUserCode(
          ctx.project,
          'check-objectid.ts',
          [
            "import { ObjectId } from '@prisma/orm-mongo/bson';",
            'const id = new ObjectId();',
            'console.log(id.toHexString().length);',
            '',
          ].join('\n'),
        );
        TML_2487_seam(run);
      },
      timeouts.coldTransformImport,
    );

    it(
      'step 6 (user code: write & read an entity through the contract) (TML-2314 seam)',
      async () => {
        if (cell.target !== 'postgres') return;
        // The core "bolt user code on top" assertion: a freshly-scaffolded
        // user opens the runtime facade, writes a `User` row through the
        // typed ORM, reads it back by `email`, and verifies the round-trip.
        // This is the user inner loop the journey exists to backstop —
        // everything before this (init, install, emit, migration plan +
        // apply) is pre-amble that only matters if the user can then
        // write/read data.
        //
        // The same script also exercises the control facade
        // (`createPostgresControlClient`) — the TML-2314 seam. The runtime
        // and control facades are distinct surfaces, but a real user
        // typically uses both in the same script (data path + programmatic
        // migrations / health-check), so they ride together here.
        const run = await runUserCode(
          ctx.project,
          'check-postgres-journey.ts',
          [
            "import { createPostgresControlClient } from '@prisma/orm-postgres/control';",
            "import postgres from '@prisma/orm-postgres/runtime';",
            "import type { Contract } from './src/prisma/contract.d';",
            "import contractJson from './src/prisma/contract.json' with { type: 'json' };",
            '',
            'const url = process.env.DATABASE_URL;',
            'if (url === undefined) {',
            "  console.error('DATABASE_URL missing');",
            '  process.exit(2);',
            '}',
            '',
            'const db = postgres<Contract>({ contractJson, url });',
            // String concatenation (not a template literal) to avoid
            // biome's `noTemplateCurlyInString` rule in this fixture
            // string — the generated user code is functionally
            // equivalent.
            "const email = 'journey-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '@example.com';",
            'try {',
            "  const created = await db.orm.public.User.create({ email, name: 'Journey User' });",
            '  const found = await db.orm.public.User.where((u) => u.email.eq(email)).first();',
            '  if (found === null || found.id !== created.id || found.email !== email) {',
            "    console.error('runtime CRUD roundtrip failed', { created, found });",
            '    process.exit(1);',
            '  }',
            '} finally {',
            '  await db.runtime().close();',
            '}',
            '',
            'const control = createPostgresControlClient({ connection: url });',
            'try {',
            '  await control.connect();',
            '  const marker = await control.readMarker();',
            '  if (marker === null) {',
            "    console.error('control readMarker returned null after migration apply');",
            '    process.exit(3);',
            '  }',
            '} finally {',
            '  await control.close();',
            '}',
            '',
            "console.log('ok');",
            '',
          ].join('\n'),
        );
        TML_2314_seam(run);
      },
      timeouts.coldTransformImport,
    );
  },
);

async function runFullJourney(cell: CellId): Promise<JourneyContext> {
  const project = await createJourneyProject(cell);
  if (project.initResult.exitCode !== 0 || project.installResult?.exitCode !== 0) {
    return {
      project,
      database: null,
      emit: null,
      migrationPlan: null,
      migrationEmit: null,
      migrationApply: null,
    };
  }

  // After this point we own a database handle and a temp project
  // directory. If any awaited setup step throws before we return the
  // populated context, `beforeAll` rejects with `ctx` still undefined,
  // which means `afterAll` cannot release them. Tear them down here
  // before rethrowing to keep matrix runs hermetic in CI.
  let database: DatabaseHandle | null = null;
  try {
    database = await spinUpDatabaseForCell(cell);
    attachDatabase(project, database.connectionString);

    const emit = await emitContract(project);

    // Drive the schema in via the migration path rather than `db init`,
    // so the journey exercises the same flow the user follows in
    // production: plan a migration, emit its ops, apply it. The mongo
    // planner's missing-`createCollection` seam (TML-2486) surfaces in
    // either path — the migration route additionally proves the
    // planner-to-runner serialisation works for a real on-disk
    // `ops.json`.
    const planResult = await migrationPlan(project, 'init');
    const emitResult = planResult.exitCode === 0 ? await selfEmitLatestMigration(project) : null;
    const applyResult =
      emitResult !== null && emitResult.exitCode === 0 ? await migrationApply(project) : null;

    return {
      project,
      database,
      emit,
      migrationPlan: planResult,
      migrationEmit: emitResult,
      migrationApply: applyResult,
    };
  } catch (error) {
    if (database !== null) {
      try {
        await database.close();
      } catch {}
    }
    try {
      project.cleanup();
    } catch {}
    throw error;
  }
}

// --- Seam expectations -----------------------------------------------------
//
// One per known seam bug. Each is a `seamExpectation<T>` with `status:
// 'broken'`. When the matching fix commit lands, the maintainer flips
// `'broken'` to `'fixed'` here and the assertion follows.

const TML_2486_seam = (cell: CellId, project: JourneyProject, result: StepResult): void => {
  if (cell.target !== 'mongo') {
    expect(result.exitCode, formatStepDiagnostic('migration apply', project, result)).toBe(0);
    return;
  }
  seamExpectation<StepResult>({
    ticket: 'TML-2486',
    description:
      'mongo migration apply successfully creates the contract collections (planner emits createCollection for plain collections; serializer accepts in-memory ops with undefined optionals)',
    status: 'fixed',
    whenBroken: (r) => {
      expect(
        r.exitCode,
        'TML-2486 still broken: mongo migration apply must currently fail',
      ).not.toBe(0);
      // Prisma-Next CLI journey tests treat stdout as the
      // machine-readable channel — assert the diagnostic regex against
      // stdout only so a regression that quietly moves the message to
      // stderr would still flip the test red.
      expect(
        r.stdout,
        'TML-2486 still broken: mongo error must mention undefined fields or missing collections',
      ).toMatch(/undefined|CLI.UNEXPECTED|createCollection|MIGRATION.RUNNER_FAILED|missing_table/);
    },
    whenFixed: (r) => {
      expect(r.exitCode, formatStepDiagnostic('migration apply', project, r)).toBe(0);
    },
  })(result);
};

const TML_2487_seam = seamExpectation<StepResult>({
  ticket: 'TML-2487',
  description: '@prisma/orm-mongo/bson re-exports ObjectId',
  status: 'fixed',
  whenBroken: (r) => {
    expect(r.exitCode, 'TML-2487 still broken: ObjectId import must currently fail').not.toBe(0);
  },
  whenFixed: (r) => {
    expect(r.exitCode, formatStepDiagnostic('ObjectId import', null, r)).toBe(0);
    expect(r.stdout.trim(), 'ObjectId.toHexString() should yield 24 hex chars').toBe('24');
  },
});

const TML_2314_seam = seamExpectation<StepResult>({
  ticket: 'TML-2314',
  description:
    'user can write/read an entity via @internal/postgres/runtime and the /control facade composes a working stack',
  status: 'fixed',
  whenBroken: (r) => {
    expect(r.exitCode, 'TML-2314 still broken: control import must currently fail').not.toBe(0);
  },
  whenFixed: (r) => {
    expect(r.exitCode, formatStepDiagnostic('postgres journey user-code', null, r)).toBe(0);
    expect(
      r.stdout.trim(),
      'postgres journey must complete a runtime CRUD round-trip and a control readMarker',
    ).toBe('ok');
  },
});

function expectScaffoldedFiles(project: JourneyProject): void {
  const required = [
    'package.json',
    'prisma-next.config.ts',
    schemaPath(project.cell),
    'src/prisma/db.ts',
    'tsconfig.json',
  ];
  for (const rel of required) {
    expect(existsSync(join(project.dir, rel)), `expected scaffold to include ${rel}`).toBe(true);
  }
}

/**
 * TML-2494 — the scaffolded `src/prisma/db.ts` uses the ESM-only
 * `with { type: 'json' }` import attribute, so the emitted `package.json`
 * must opt into ESM. Without this, Node either prints the
 * `MODULE_TYPELESS_PACKAGE_JSON` warning (Node 22+ with strip-types) or
 * hard-fails on older loaders trying to read `db.ts` as CommonJS.
 */
function expectPackageJsonIsEsm(project: JourneyProject): void {
  const pkg = JSON.parse(readFileSync(join(project.dir, 'package.json'), 'utf-8')) as {
    type?: string;
  };
  expect(pkg.type, 'init must scaffold "type": "module" so the ESM-only db.ts loads').toBe(
    'module',
  );
}

function expectSchemaFile(project: JourneyProject, cell: CellId): void {
  const contents = readFileSync(join(project.dir, schemaPath(cell)), 'utf-8');

  if (cell.authoring === 'typescript') {
    expect(contents, 'TS schema imports defineContract from the facade').toContain(
      `from '${facadeFor(cell)}/contract-builder'`,
    );
  } else {
    expect(contents, 'PSL schema declares at least one model').toMatch(/^model\s+\w+\s*\{/m);
    if (cell.target === 'mongo') {
      expect(contents, 'Mongo PSL uses ObjectId for ids').toContain('ObjectId');
    }
  }
}

function expectConfigFile(project: JourneyProject, cell: CellId): void {
  const contents = readFileSync(join(project.dir, 'prisma-next.config.ts'), 'utf-8');
  expect(contents, 'config imports postgres/mongo facade only').toContain(
    `from '${facadeFor(cell)}/config'`,
  );
  expect(contents, 'config references the schema file').toContain(schemaPath(cell));
}

function schemaPath(cell: CellId): string {
  return cell.authoring === 'typescript' ? 'src/prisma/contract.ts' : 'src/prisma/contract.prisma';
}

/** The one package name a project scaffolded for `cell` depends on. */
function facadeFor(cell: CellId): string {
  return cell.target === 'mongo' ? '@prisma/orm-mongo' : '@prisma/orm-postgres';
}

function expectFacadeIsResolvable(project: JourneyProject): void {
  const facadeName = facadeFor(project.cell);
  const facadePath = join(project.dir, 'node_modules', facadeName, 'package.json');
  expect(existsSync(facadePath), `facade package not installed at ${facadePath}`).toBe(true);
}

function formatInitDiagnostic(project: JourneyProject): string {
  return [
    `prisma-next init failed for ${cellLabel(project.cell)}`,
    `  exit code: ${project.initResult.exitCode}`,
    '  stdout:',
    indent(project.initResult.stdout, '    '),
    '  stderr:',
    indent(project.initResult.stderr, '    '),
  ].join('\n');
}

function formatInstallDiagnostic(project: JourneyProject, install: CommandRun): string {
  return [
    `pnpm install failed for ${cellLabel(project.cell)}`,
    `  exit code: ${install.exitCode}`,
    `  cwd: ${project.dir}`,
    '  stdout:',
    indent(install.stdout, '    '),
    '  stderr:',
    indent(install.stderr, '    '),
  ].join('\n');
}

function formatStepDiagnostic(
  step: string,
  project: JourneyProject | null,
  result: StepResult,
): string {
  return [
    `${step} failed${project !== null ? ` for ${cellLabel(project.cell)}` : ''}`,
    `  command: ${result.command}`,
    `  exit code: ${result.exitCode}`,
    ...(project !== null ? [`  cwd: ${project.dir}`] : []),
    '  stdout:',
    indent(result.stdout, '    '),
    '  stderr:',
    indent(result.stderr, '    '),
  ].join('\n');
}

function indent(text: string | undefined, prefix: string): string {
  if (text === undefined || text.length === 0) return `${prefix}<empty>`;
  return text
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}
