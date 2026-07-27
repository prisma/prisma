/**
 * End-to-end round-trip for the Postgres migration authoring surface.
 *
 * Confirms that the TypeScript source produced by
 * `TypeScriptRenderablePostgresMigration#renderTypeScript()` is a
 * faithful serialization of the call list: when rewritten to point at the
 * live workspace entrypoints, written to disk, and executed via `tsx`,
 * the resulting `ops.json` matches `renderOps(calls)` exactly (modulo
 * JSON-only fields). This is the acceptance criterion that the
 * authoring surface is an invariant — a planner that emits IR, the IR
 * survives a full parse → execute round-trip back into runtime ops.
 */

import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { APP_SPACE_ID, storageHashHex } from '@prisma-next/framework-components/control';
import { col, primaryKey } from '@prisma-next/sql-relational-core/contract-free';
import {
  AddColumnCall,
  CreateExtensionCall,
  CreateIndexCall,
  CreatePostgresRlsPolicyCall,
  CreateSchemaCall,
  CreateTableCall,
  DisableRowLevelSecurityCall,
  DropPostgresRlsPolicyCall,
  DropTableCall,
  EnableRowLevelSecurityCall,
  RawSqlCall,
  RenameIndexCall,
  RenamePostgresRlsPolicyCall,
} from '@prisma-next/target-postgres/op-factory-call';
import { TypeScriptRenderablePostgresMigration } from '@prisma-next/target-postgres/planner-produced-postgres-migration';
import { renderOps } from '@prisma-next/target-postgres/render-ops';
import { PostgresRlsPolicy } from '@prisma-next/target-postgres/types';
import { timeouts } from '@prisma-next/test-utils';
import { join, resolve } from 'pathe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPostgresBuiltinCodecLookup } from '../../src/core/codec-lookup';
import { PostgresControlAdapter } from '../../src/core/control-adapter';

const execFileAsync = promisify(execFile);
const testAdapter = new PostgresControlAdapter(createPostgresBuiltinCodecLookup());
const packageRoot = resolve(import.meta.dirname, '../..');
const repoRoot = resolve(packageRoot, '../../../..');
const targetPostgresRoot = resolve(repoRoot, 'packages/3-targets/3-targets/postgres');
const tsxPath = join(repoRoot, 'node_modules/.bin/tsx');

const targetPostgresMigrationExport = pathToFileURL(
  resolve(targetPostgresRoot, 'src/exports/migration.ts'),
).href;
const relationalCoreContractFreeExport = pathToFileURL(
  resolve(repoRoot, 'packages/2-sql/4-lanes/relational-core/src/exports/contract-free.ts'),
).href;
const cliConfigTypesExport = pathToFileURL(
  resolve(repoRoot, 'packages/1-framework/3-tooling/cli/src/exports/config-types.ts'),
).href;
const familySqlControlExport = pathToFileURL(
  resolve(repoRoot, 'packages/2-sql/9-family/src/exports/control.ts'),
).href;
const targetPostgresControlExport = pathToFileURL(
  resolve(targetPostgresRoot, 'src/exports/control.ts'),
).href;
const adapterPostgresControlExport = pathToFileURL(
  resolve(packageRoot, 'src/exports/control.ts'),
).href;

/**
 * `MigrationCLI.run` requires a `prisma-next.config.ts` to assemble a
 * `ControlStack`. Tests have no workspace `node_modules` resolution from
 * `tmpDir`, so we write a bespoke config alongside `migration.ts` whose
 * imports all use absolute `file://` URLs into the live workspace
 * sources. The driver is omitted — the round-trip exercises the
 * serialization path only and never opens a database connection.
 */
const fixtureConfigSource = [
  `import postgresAdapter from '${adapterPostgresControlExport}';`,
  `import { defineConfig } from '${cliConfigTypesExport}';`,
  `import sql from '${familySqlControlExport}';`,
  `import postgres from '${targetPostgresControlExport}';`,
  '',
  'export default defineConfig({',
  '  family: sql,',
  '  target: postgres,',
  '  adapter: postgresAdapter,',
  '});',
  '',
].join('\n');

/**
 * Rewrite the bare import the renderer always emits so that running the
 * rendered scaffold from a temp directory (which has no workspace
 * `node_modules` resolution) still reaches the live in-source modules.
 * The renderer pulls both `Migration` (the base class) and
 * `MigrationCLI` (the entrypoint) from the postgres migration facade, so
 * a single rewrite is enough.
 */
function rewriteImports(tsSource: string): string {
  return tsSource
    .replace("'@prisma-next/postgres/migration'", `'${targetPostgresMigrationExport}'`)
    .replace(
      "'@prisma-next/sql-relational-core/contract-free'",
      `'${relationalCoreContractFreeExport}'`,
    );
}

/**
 * Write the deduplicated snapshot-store fixtures the rendered scaffold
 * imports — `snapshots/<hex>/contract.json` (carrying `storage.storageHash`,
 * which the base's derived `describe()` reads) and the matching
 * `snapshots/<hex>/contract.ts` type module (`export type Contract`) for
 * each of `meta.to` and (when non-null) `meta.from`. The JSON hashes match
 * `meta` so the derived describe() is consistent with the migration's
 * identity. `SNAPSHOTS_IMPORT_PATH` matches the `snapshotsImportPath` passed
 * to the migration under test, so the rendered import specifiers resolve
 * relative to `migration.ts` at the root of `dir`.
 */
async function writeContractFixtures(
  dir: string,
  meta: { readonly from: string | null; readonly to: string },
): Promise<void> {
  const contractType =
    'export type Contract = { readonly storage: { readonly storageHash: string } };\n';
  const writeSnapshot = async (storageHash: string) => {
    const snapshotDir = join(dir, SNAPSHOTS_IMPORT_PATH, storageHashHex(storageHash));
    await mkdir(snapshotDir, { recursive: true });
    await writeFile(
      join(snapshotDir, 'contract.json'),
      JSON.stringify({ storage: { storageHash } }, null, 2),
    );
    await writeFile(join(snapshotDir, 'contract.ts'), contractType);
  };
  await writeSnapshot(meta.to);
  if (meta.from !== null) {
    await writeSnapshot(meta.from);
  }
}

const SNAPSHOTS_IMPORT_PATH = './snapshots';
const META = {
  from: '0'.repeat(64),
  to: '1'.repeat(64),
} as const;

const tscPath = join(repoRoot, 'node_modules/.bin/tsc');

/**
 * Writes a rendered migration plus the tsconfig and contract-type fixtures
 * the typecheck tests need. The facade import is pointed at the live
 * workspace source (an absolute path specifier; bare workspace imports
 * inside the sources then resolve from their own package directories), so
 * tsc checks the rendered text against the real `createRlsPolicy`
 * signature. The execution fixtures' minimal `Contract` type does not
 * satisfy the `Migration` base's `Contract<SqlStorage>` constraint, so the
 * snapshot contract types come from the same dist types the migration
 * source graph resolves its own bare imports to.
 */
async function writeTypecheckDir(dir: string, renderedSource: string): Promise<void> {
  const tsSource = renderedSource.replace(
    "'@prisma-next/postgres/migration'",
    `'${resolve(targetPostgresRoot, 'src/exports/migration.ts')}'`,
  );
  await writeFile(join(dir, 'migration.ts'), tsSource);
  const contractDistTypes = resolve(
    repoRoot,
    'packages/1-framework/0-foundation/contract/dist/types.mjs',
  );
  const sqlContractDistTypes = resolve(repoRoot, 'packages/2-sql/1-core/contract/dist/types.mjs');
  const realContractType = `export type Contract = import('${contractDistTypes}').Contract<\n  import('${sqlContractDistTypes}').SqlStorage\n>;\n`;
  for (const hash of [META.to, META.from]) {
    await writeFile(
      join(dir, SNAPSHOTS_IMPORT_PATH, storageHashHex(hash), 'contract.ts'),
      realContractType,
    );
  }
  await writeFile(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'preserve',
        moduleResolution: 'bundler',
        lib: ['ES2022'],
        strict: true,
        exactOptionalPropertyTypes: true,
        noUncheckedIndexedAccess: true,
        skipLibCheck: true,
        noEmit: true,
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        typeRoots: [join(repoRoot, 'node_modules/@types')],
        types: ['node'],
      },
      include: ['migration.ts'],
    }),
  );
}

describe('TypeScriptRenderablePostgresMigration round-trip', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'postgres-render-roundtrip-'));
    await writeFile(join(tmpDir, 'package.json'), '{"type":"module"}');
    await writeFile(join(tmpDir, 'prisma-next.config.ts'), fixtureConfigSource);
    // The rendered scaffold imports its from/to identity from committed
    // contract JSON (the base derives describe() from `storage.storageHash`)
    // and the matching `Contract` types. Write minimal fixtures so the
    // executed migration resolves its imports; the from/to hashes here match
    // META so the derived describe() is consistent.
    await writeContractFixtures(tmpDir, META);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  }, timeouts.databaseOperation);

  it('renders TS that re-parses to operations matching renderOps(calls) exactly', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const calls = [
      new CreateExtensionCall('citext'),
      new CreateSchemaCall('app'),
      new CreateTableCall(
        'public',
        'user',
        [col('id', 'text', { notNull: true }), col('email', 'text', { notNull: true })],
        [primaryKey(['id'])],
      ),
      new AddColumnCall('public', 'user', col('nickname', 'text')),
      new CreateIndexCall('public', 'user', 'user_email_idx', { columns: ['email'] }),
      new CreateIndexCall(
        'public',
        'user',
        'user_email_eq',
        { expression: 'lower(email)' },
        { unique: true, where: 'nickname IS NOT NULL' },
      ),
      new RenameIndexCall('public', 'user', 'user_email_idx', 'user_email_lookup_ab12cd34'),
      new EnableRowLevelSecurityCall('public', 'user'),
      new CreatePostgresRlsPolicyCall(
        'public',
        'user',
        new PostgresRlsPolicy({
          name: 'p_ab12cd34',
          prefix: 'p',
          tableName: 'user',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using: '(id = auth.uid())',
          withCheck: '(id = auth.uid())',
          permissive: true,
        }),
      ),
      new RenamePostgresRlsPolicyCall('public', 'user', 'p_ab12cd34', 'p_e5f6a7b8'),
      new DropPostgresRlsPolicyCall('public', 'user', 'p_e5f6a7b8'),
      new DisableRowLevelSecurityCall('public', 'user'),
      new DropTableCall('public', 'stale'),
    ];
    const migration = new TypeScriptRenderablePostgresMigration(
      calls,
      META,
      APP_SPACE_ID,
      SNAPSHOTS_IMPORT_PATH,
      testAdapter,
    );

    const tsSource = rewriteImports(migration.renderTypeScript());
    await writeFile(join(tmpDir, 'migration.ts'), tsSource);

    const { stdout, stderr } = await execFileAsync(tsxPath, [join(tmpDir, 'migration.ts')], {
      cwd: tmpDir,
    });
    expect(stderr).toBe('');
    expect(stdout).toContain('Wrote ops.json + migration.json to ');

    const opsJson = await readFile(join(tmpDir, 'ops.json'), 'utf-8');
    const ops = JSON.parse(opsJson);

    const expected = await Promise.all(renderOps(calls, testAdapter));
    expect(ops).toEqual(expected);
  });

  it('renders an empty calls list whose executed scaffold emits []', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const migration = new TypeScriptRenderablePostgresMigration(
      [],
      META,
      APP_SPACE_ID,
      SNAPSHOTS_IMPORT_PATH,
    );

    const tsSource = rewriteImports(migration.renderTypeScript());
    await writeFile(join(tmpDir, 'migration.ts'), tsSource);

    const { stderr } = await execFileAsync(tsxPath, [join(tmpDir, 'migration.ts')], {
      cwd: tmpDir,
    });
    expect(stderr).toBe('');

    const ops = JSON.parse(await readFile(join(tmpDir, 'ops.json'), 'utf-8'));
    expect(ops).toEqual([]);
  });

  it('rendered RLS-policy migration source typechecks against the live migration surface', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    // The failure mode under test: `createRlsPolicy`'s parameter accepts the
    // rendered literal shape, which omits absent keys — `withCheck` for a
    // SELECT policy, `prefix` for an exact policy. A required-key parameter
    // type makes every generated RLS migration a TypeScript error in the
    // user's project, which execution round-trips (tsx strips types) can
    // never catch.
    const calls = [
      new CreatePostgresRlsPolicyCall(
        'public',
        'user',
        new PostgresRlsPolicy({
          name: 'tenant_read_f8d5e783',
          prefix: 'tenant_read',
          tableName: 'user',
          namespaceId: 'public',
          operation: 'select',
          roles: ['app_user'],
          using: '(tenant_id = 1)',
          withCheck: undefined,
          permissive: true,
        }),
      ),
      new CreatePostgresRlsPolicyCall(
        'public',
        'user',
        new PostgresRlsPolicy({
          name: 'Tenant members can read',
          prefix: undefined,
          tableName: 'user',
          namespaceId: 'public',
          operation: 'select',
          roles: ['app_user'],
          using: '(tenant_id = 1)',
          withCheck: undefined,
          permissive: true,
        }),
      ),
    ];
    const migration = new TypeScriptRenderablePostgresMigration(
      calls,
      META,
      APP_SPACE_ID,
      SNAPSHOTS_IMPORT_PATH,
      testAdapter,
    );

    await writeTypecheckDir(tmpDir, migration.renderTypeScript());
    // Non-zero exit (a type error in the rendered source) rejects.
    await execFileAsync(tscPath, ['--project', tmpDir]);
  });

  it('the typecheck catches a rendered literal missing a required key (negative control)', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const migration = new TypeScriptRenderablePostgresMigration(
      [
        new CreatePostgresRlsPolicyCall(
          'public',
          'user',
          new PostgresRlsPolicy({
            name: 'Tenant members can read',
            prefix: undefined,
            tableName: 'user',
            namespaceId: 'public',
            operation: 'select',
            roles: ['app_user'],
            using: '(tenant_id = 1)',
            withCheck: undefined,
            permissive: true,
          }),
        ),
      ],
      META,
      APP_SPACE_ID,
      SNAPSHOTS_IMPORT_PATH,
      testAdapter,
    );

    // Delete the policy's required `name` key from the rendered source — the
    // compile must fail (TS2741 missing-property), proving the green run of
    // the sibling test is a real typecheck and not a vacuous pass.
    const brokenSource = migration
      .renderTypeScript()
      .replace('  name: "Tenant members can read",\n', '');
    expect(brokenSource).not.toContain('Tenant members can read');
    await writeTypecheckDir(tmpDir, brokenSource);

    const failure = await execFileAsync(tscPath, ['--project', tmpDir]).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(failure).toBeDefined();
    expect(String((failure as { stdout?: string }).stdout)).toContain('TS2741');
  });

  it('preserves RawSqlCall ops byte-for-byte through the render → execute round-trip', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const op = {
      id: 'raw.custom.1',
      label: 'raw custom 1',
      operationClass: 'additive' as const,
      target: { id: 'postgres' as const },
      precheck: [],
      execute: [{ description: 'do thing', sql: 'SELECT 1' }],
      postcheck: [],
      meta: { note: 'preserved' },
    };
    const calls = [new RawSqlCall(op)];
    const migration = new TypeScriptRenderablePostgresMigration(
      calls,
      META,
      APP_SPACE_ID,
      SNAPSHOTS_IMPORT_PATH,
    );

    const tsSource = rewriteImports(migration.renderTypeScript());
    await writeFile(join(tmpDir, 'migration.ts'), tsSource);

    await execFileAsync(tsxPath, [join(tmpDir, 'migration.ts')], {
      cwd: tmpDir,
    });

    const ops = JSON.parse(await readFile(join(tmpDir, 'ops.json'), 'utf-8'));

    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual(JSON.parse(JSON.stringify(op)));
  });
});
