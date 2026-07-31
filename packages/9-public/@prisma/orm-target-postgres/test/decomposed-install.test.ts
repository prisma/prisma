import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installShells, packShell, runInScratch } from '@prisma-next/tsdown/shell-testkit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const publicRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoRoot = join(publicRoot, '..', '..', '..');

/**
 * The application's direct dependencies. No facade: a decomposed install
 * drops it rather than adding packages beside it (ADR 242), and the emitter
 * reads that from the manifest.
 */
const direct = ['orm-framework', 'orm-family-sql', 'orm-target-postgres'];

/** Arrives transitively; the platform shells depend on it. */
const transitive = ['orm-toolchain'];

/**
 * An emitted Postgres contract, copied in as a stand-in for one the
 * application would have generated. What matters here is that the platform
 * packages compose, not how the contract was produced.
 */
const contractFixture = join(repoRoot, 'examples/bundle-size/src/postgres/generated/contract.json');

/**
 * The replaced component: an application's own driver, in place of
 * `@prisma/orm-target-postgres/driver`. It records what it is asked to
 * execute and answers from memory, which is what makes the run observable
 * without a database — and a driver is the component an application most
 * often has its own of (a pool it already manages, a proxy, a serverless
 * transport). ADR 242's worked example replaces the adapter instead; the
 * substitution point is the same, and keeping the published adapter means
 * the SQL asserted below is the one the real Postgres adapter produced.
 */
const REPLACEMENT_DRIVER = `
const executed = [];

function rowsFor(request) {
  executed.push({ sql: request.sql, params: request.params });
  return (async function* () {
    yield { id: 'note-1' };
    yield { id: 'note-2' };
  })();
}

const connection = {
  execute: (request) => rowsFor(request),
  executePrepared: () => (async function* () {})(),
  query: async () => ({ rows: [], rowCount: 0 }),
  beginTransaction: async () => {
    throw new Error('the recording driver does not open transactions');
  },
  release: async () => {},
  destroy: async () => {},
};

const driverInstance = {
  familyId: 'sql',
  targetId: 'postgres',
  state: 'connected',
  connect: async () => {},
  close: async () => {},
  acquireConnection: async () => connection,
  execute: (request) => rowsFor(request),
  executePrepared: () => (async function* () {})(),
  query: async () => ({ rows: [], rowCount: 0 }),
};

const recordingDriver = {
  kind: 'driver',
  familyId: 'sql',
  targetId: 'postgres',
  id: 'recording',
  version: '0.0.1',
  capabilities: {},
  create: () => driverInstance,
};
`;

describe('an application that installs the platform packages and replaces a component', () => {
  let scratch: string;

  beforeAll(() => {
    scratch = mkdtempSync(join(tmpdir(), 'orm-decomposed-'));
    const packed = [...direct, ...transitive].map((shell) =>
      packShell(join(publicRoot, shell), scratch),
    );
    installShells(scratch, packed, { direct: direct.map((shell) => `@prisma/${shell}`) });
    copyFileSync(contractFixture, join(scratch, 'contract.json'));
  }, 300_000);

  afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it('resolves no facade at all', () => {
    const script = `
      import { strict as assert } from 'node:assert';
      for (const facade of ['@prisma/orm-postgres', '@prisma/orm-sqlite', '@prisma/orm-mongo']) {
        await assert.rejects(import(facade), /Cannot find package/, facade);
      }
      console.log('no facade ok');
    `;
    expect(runInScratch(scratch, script)).toContain('no facade ok');
  });

  // The whole point of decomposing: the stack an application composes by hand
  // out of the platform packages runs a query, through the published target
  // and adapter, into a driver the application wrote itself.
  it('runs a query through a stack it composed itself', () => {
    const script = `
      import { strict as assert } from 'node:assert';
      import { readFileSync } from 'node:fs';
      import { instantiateExecutionStack } from '@prisma/orm-framework/components/execution';
      import { sql as sqlBuilder } from '@prisma/orm-family-sql/builder/runtime';
      import {
        createExecutionContext,
        createSqlExecutionStack,
        SqlRuntimeBase,
      } from '@prisma/orm-family-sql/runtime';
      import adapter from '@prisma/orm-target-postgres/adapter/runtime';
      import target, { PostgresContractSerializer } from '@prisma/orm-target-postgres/target/runtime';

      ${REPLACEMENT_DRIVER}

      const contract = new PostgresContractSerializer().deserializeContract(
        JSON.parse(readFileSync('contract.json', 'utf8')),
      );

      const stack = createSqlExecutionStack({ target, adapter, driver: recordingDriver });
      const context = createExecutionContext({ contract, stack, driver: recordingDriver });
      const instance = instantiateExecutionStack(stack);

      class MyRuntime extends SqlRuntimeBase {}
      const runtime = new MyRuntime({
        context,
        adapter: instance.adapter,
        driver: instance.driver,
        verifyMarker: false,
      });

      const sql = sqlBuilder({ context, rawCodecInferer: adapter.rawCodecInferer });
      const rows = await runtime.execute(sql.public.Note.select('id').limit(10).build());

      assert.deepEqual(rows, [{ id: 'note-1' }, { id: 'note-2' }]);
      assert.equal(executed.length, 1, 'the replacement driver ran exactly one statement');
      assert.match(executed[0].sql, /select/i);
      assert.match(executed[0].sql, /"Note"/);
      await runtime.close();
      console.log('decomposed run ok');
    `;
    expect(runInScratch(scratch, script)).toContain('decomposed run ok');
  });

  // Under a decomposed install the emitter writes platform names, because
  // there is no facade to name. Those names have to resolve from the
  // application's own `node_modules`, not merely exist somewhere in the
  // install: a package manager puts only direct dependencies there, which is
  // the failure this whole shape exists to avoid. `import-roots` is where the
  // internal-to-published mapping itself is tested; this is the other half —
  // that what it produces is installed.
  it('resolves the specifiers emission writes under the platform root', () => {
    const emitted = [
      '@prisma/orm-framework/contract/types',
      '@prisma/orm-framework/components',
      '@prisma/orm-family-sql/contract/types',
      '@prisma/orm-target-postgres/target/codec-types',
      '@prisma/orm-target-postgres/adapter/operation-types',
    ];
    const script = [
      `const specifiers = ${JSON.stringify(emitted)};`,
      'for (const specifier of specifiers) await import(specifier);',
      `console.log('emitted specifiers ok: ' + specifiers.length);`,
    ].join('\n');
    expect(runInScratch(scratch, script)).toContain(`emitted specifiers ok: ${emitted.length}`);
  });
});
