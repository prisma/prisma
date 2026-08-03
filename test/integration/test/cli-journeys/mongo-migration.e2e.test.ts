/**
 * Mongo migration authoring journey (CLI end-to-end).
 *
 * Covers the gap that no Postgres-shaped journey test exercises for MongoDB:
 *
 *  1. `migration plan --target mongo` from the empty contract baseline:
 *     scaffolds a `migration.ts`, populates the migrations root's
 *     content-addressed `migrations/snapshots/<hex>/contract.{json,d.ts}`
 *     store entry for the destination contract, and emits attested
 *     `ops.json` with the expected `createIndex` operation(s). Asserts the
 *     rendered `migration.ts` is round-trip executable: running it via `tsx`
 *     instantiates the migration class, reads its `operations` getter, and
 *     self-emits `ops.json` + attested `migration.json`.
 *
 *  2. `migration new --target mongo` after a contract change: scaffolds an
 *     empty `Migration` subclass stub for hand-authoring (with the contract
 *     bookends populated in `describe()`) and populates the destination
 *     contract's store entry.
 *
 *  3. End-to-end with a real MongoDB instance via
 *     `MongoMemoryReplSet`: plan + apply the initial DDL, seed data,
 *     hand-author a `dataTransform` + additive `createIndex` migration,
 *     self-emit it by running `node migration.ts`, apply it, and verify both
 *     the structural change and the data transformation took effect against
 *     the live database.
 */

import { execFile } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { rm } from 'node:fs/promises';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { storageHashHex } from '@prisma/orm-mongo/components/control';
import { timeouts } from '@repo/test-utils';
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createContractEmitCommand,
  createMigrateCommand,
  createMigrationNewCommand,
  createMigrationPlanCommand,
} from '../utils/cli-commands';
import {
  executeCommand,
  fixtureAppDir,
  getExitCode,
  setupCommandMocks,
} from '../utils/cli-test-helpers';

const execFileAsync = promisify(execFile);
const TSX_BIN = resolve(import.meta.dirname, '../../../../node_modules/.bin/tsx');

interface JourneyCtx {
  testDir: string;
  configPath: string;
  outputDir: string;
}

const FIXTURES_DIR = join(fixtureAppDir, 'fixtures/mongo-cli-journeys');

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCli(
  command: ReturnType<typeof createMigrationPlanCommand>,
  testDir: string,
  args: readonly string[],
): Promise<RunResult> {
  const mocks = setupCommandMocks({ isTTY: true });
  const originalCwd = process.cwd();
  try {
    process.chdir(testDir);
    try {
      await executeCommand(command, ['--no-color', ...args]);
      return {
        exitCode: 0,
        stdout: mocks.consoleOutput.join('\n'),
        stderr: mocks.consoleErrors.join('\n'),
      };
    } catch (error) {
      const exitCode = getExitCode();
      if (exitCode == null) throw error;
      return {
        exitCode,
        stdout: mocks.consoleOutput.join('\n'),
        stderr: mocks.consoleErrors.join('\n'),
      };
    }
  } finally {
    process.chdir(originalCwd);
    mocks.cleanup();
  }
}

function setupMongoJourney(connectionString: string | undefined): JourneyCtx {
  const testDir = join(
    fixtureAppDir,
    `test-mongo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(testDir, { recursive: true });
  const outputDir = join(testDir, 'output');
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(join(testDir, 'migrations'), { recursive: true });

  // The journey's project states the one package it installs. Emission reads
  // the nearest manifest to decide which names generated files carry, and
  // without this the temp directory would inherit the shared fixture app's,
  // which lists the whole workspace and looks nothing like a user's project.
  writeFileSync(
    join(testDir, 'package.json'),
    JSON.stringify(
      {
        name: 'mongo-journey-app',
        private: true,
        type: 'module',
        dependencies: { '@prisma/orm-mongo': 'workspace:0.16.0' },
      },
      null,
      2,
    ),
    'utf-8',
  );

  copyFileSync(join(FIXTURES_DIR, 'contract-base.ts'), join(testDir, 'contract.ts'));

  let configContent = readFileSync(join(FIXTURES_DIR, 'prisma-next.config.with-db.ts'), 'utf-8');
  configContent = configContent.replace(
    /\{\{DB_URL\}\}/g,
    () => connectionString ?? 'mongodb://localhost:27017/unused',
  );
  const configPath = join(testDir, 'prisma-next.config.ts');
  writeFileSync(configPath, configContent, 'utf-8');

  return { testDir, configPath, outputDir };
}

function swapToAdditive(ctx: JourneyCtx): void {
  copyFileSync(join(FIXTURES_DIR, 'contract-additive.ts'), join(ctx.testDir, 'contract.ts'));
}

async function emitContract(ctx: JourneyCtx): Promise<RunResult> {
  return runCli(createContractEmitCommand(), ctx.testDir, ['--config', ctx.configPath]);
}

async function migrationPlan(ctx: JourneyCtx, args: readonly string[] = []): Promise<RunResult> {
  return runCli(createMigrationPlanCommand(), ctx.testDir, ['--config', ctx.configPath, ...args]);
}

async function migrationNew(ctx: JourneyCtx, args: readonly string[] = []): Promise<RunResult> {
  return runCli(createMigrationNewCommand(), ctx.testDir, ['--config', ctx.configPath, ...args]);
}

async function migrationEmit(ctx: JourneyCtx, args: readonly string[] = []): Promise<RunResult> {
  const rest = [...args];
  const dirIdx = rest.indexOf('--dir');
  if (dirIdx < 0 || dirIdx === rest.length - 1) {
    throw new Error('migrationEmit requires --dir <migration-dir>');
  }
  const dirArg = rest[dirIdx + 1]!;
  rest.splice(dirIdx, 2);

  const migrationTs = isAbsolute(dirArg)
    ? join(dirArg, 'migration.ts')
    : join(ctx.testDir, dirArg, 'migration.ts');
  try {
    const { stdout, stderr } = await execFileAsync(TSX_BIN, [migrationTs, ...rest], {
      cwd: ctx.testDir,
    });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; code?: number };
    return { exitCode: e.code ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

async function migrationApply(ctx: JourneyCtx, args: readonly string[] = []): Promise<RunResult> {
  return runCli(createMigrateCommand(), ctx.testDir, ['--config', ctx.configPath, ...args]);
}

function getLatestMigrationDir(ctx: JourneyCtx): string {
  const migrationsDir = join(ctx.testDir, 'migrations', 'app');
  const dirs = readdirSync(migrationsDir).filter((d) => !d.startsWith('.'));
  if (dirs.length === 0) throw new Error('No migration directory found');
  let newest = dirs[0]!;
  let newestMtime = statSync(join(migrationsDir, newest)).mtimeMs;
  for (let i = 1; i < dirs.length; i++) {
    const dir = dirs[i]!;
    const mtime = statSync(join(migrationsDir, dir)).mtimeMs;
    if (mtime > newestMtime) {
      newestMtime = mtime;
      newest = dir;
    }
  }
  return join(migrationsDir, newest);
}

/**
 * `MongoMemoryReplSet.getUri()` returns a URI without an explicit database
 * name (and may carry query parameters such as `?replicaSet=...`). The CLI
 * needs a connection string that points at a specific database, so splice
 * the database name into the path component while preserving the query.
 */
function buildMongoUri(baseUri: string, dbName: string): string {
  const [hostPart, query] = baseUri.split('?');
  const trimmedHost = (hostPart ?? '').replace(/\/?$/, '/');
  return query ? `${trimmedHost}${dbName}?${query}` : `${trimmedHost}${dbName}`;
}

function findMigrationDirBySlug(ctx: JourneyCtx, slugFragment: string): string {
  const migrationsDir = join(ctx.testDir, 'migrations', 'app');
  const dirs = readdirSync(migrationsDir)
    .filter((d) => !d.startsWith('.') && d.includes(slugFragment))
    .sort();
  const match = dirs[dirs.length - 1];
  if (!match) {
    throw new Error(`No migration directory found containing '${slugFragment}'`);
  }
  return join(migrationsDir, match);
}

/** Path to a `migrations/snapshots/<hex>/contract.{json,d.ts}` store entry. */
function contractSnapshotPath(
  ctx: JourneyCtx,
  storageHash: string,
  file: 'contract.json' | 'contract.d.ts',
): string {
  return join(ctx.testDir, 'migrations', 'snapshots', storageHashHex(storageHash), file);
}

// Journey tests shell out to the CLI binary, which easily exceeds the
// integration-suite default `it` timeout of 100ms.
describe('Journey: Mongo migration authoring (offline)', { timeout: timeouts.spinUpPpgDev }, () => {
  const created = new Set<string>();

  afterEach(async () => {
    for (const dir of created) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    created.clear();
  });

  it('migration plan --target mongo scaffolds migration.ts, populates the contract snapshot store, and emits attested ops.json', async () => {
    const ctx = setupMongoJourney(undefined);
    created.add(ctx.testDir);

    const emit0 = await emitContract(ctx);
    expect(emit0.exitCode, `contract emit: ${emit0.stderr}`).toBe(0);

    const plan = await migrationPlan(ctx, ['--name', 'initial']);
    expect(plan.exitCode, `migration plan: ${plan.stdout}\n${plan.stderr}`).toBe(0);

    const migrationDir = getLatestMigrationDir(ctx);

    const migrationTs = readFileSync(join(migrationDir, 'migration.ts'), 'utf-8');
    expect(migrationTs).toContain('@prisma/orm-mongo/target/migration');
    expect(migrationTs).toContain('createIndex');
    // Prettier rewrites double-quoted literals to single-quoted on disk.
    expect(migrationTs).toContain("'users'");
    expect(migrationTs).toContain('MigrationCLI.run(import.meta.url');

    const draftManifest = JSON.parse(
      readFileSync(join(migrationDir, 'migration.json'), 'utf-8'),
    ) as { to: string };

    // The store canonicalizes JSON (compact, sorted keys), while the
    // emitted project artifact is pretty-printed — compare parsed content,
    // not bytes.
    expect(
      JSON.parse(
        readFileSync(contractSnapshotPath(ctx, draftManifest.to, 'contract.json'), 'utf-8'),
      ),
    ).toEqual(JSON.parse(readFileSync(join(ctx.outputDir, 'contract.json'), 'utf-8')));
    expect(
      readFileSync(contractSnapshotPath(ctx, draftManifest.to, 'contract.d.ts'), 'utf-8'),
    ).toBe(readFileSync(join(ctx.outputDir, 'contract.d.ts'), 'utf-8'));

    // Plan leaves a draft migration; self-emit via `tsx migration.ts` to
    // produce `ops.json` and the attested `migration.json`.
    const emit = await migrationEmit(ctx, ['--dir', `migrations/app/${basename(migrationDir)}`]);
    expect(emit.exitCode, `migration emit: ${emit.stdout}\n${emit.stderr}`).toBe(0);

    const ops = JSON.parse(readFileSync(join(migrationDir, 'ops.json'), 'utf-8')) as ReadonlyArray<{
      id: string;
      operationClass: string;
      kind?: string;
    }>;
    const opIds = ops.map((o) => o.id).sort();
    expect(opIds.some((id) => id.startsWith('index.users.'))).toBe(true);
    for (const op of ops) {
      expect(op.operationClass).toBe('additive');
    }

    const manifest = JSON.parse(readFileSync(join(migrationDir, 'migration.json'), 'utf-8')) as {
      migrationHash: string;
    };
    expect(manifest.migrationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('migration new --target mongo scaffolds an empty Migration stub with the contract snapshot store populated', async () => {
    const ctx = setupMongoJourney(undefined);
    created.add(ctx.testDir);

    const emit0 = await emitContract(ctx);
    expect(emit0.exitCode, `contract emit base: ${emit0.stderr}`).toBe(0);

    const plan = await migrationPlan(ctx, ['--name', 'initial']);
    expect(plan.exitCode, `seed initial migration: ${plan.stderr}`).toBe(0);

    swapToAdditive(ctx);
    const emit1 = await emitContract(ctx);
    expect(emit1.exitCode, `contract emit additive: ${emit1.stderr}`).toBe(0);

    const newResult = await migrationNew(ctx, ['--name', 'add-name-index']);
    expect(newResult.exitCode, `migration new: ${newResult.stdout}\n${newResult.stderr}`).toBe(0);

    const migrationDir = findMigrationDirBySlug(ctx, 'add_name_index');

    const migrationTs = readFileSync(join(migrationDir, 'migration.ts'), 'utf-8');
    expect(migrationTs).toContain(
      "import { Migration, MigrationCLI } from '@prisma/orm-mongo/target/migration'",
    );
    // New generator shape: the base derives describe() from the imported contract
    // JSON, so the scaffold carries `Migration<…, End>` + the endContractJson
    // field and emits no describe() / hash literals.
    expect(migrationTs).toContain('class M extends Migration<');
    expect(migrationTs).not.toContain('describe()');
    expect(migrationTs).toContain('override readonly endContractJson = endContract;');
    expect(migrationTs).toContain('get operations()');
    expect(migrationTs).toContain('return [');
    // Empty stub: no operation factory is imported because no calls were rendered.
    expect(migrationTs).not.toContain('createIndex');

    const manifest = JSON.parse(readFileSync(join(migrationDir, 'migration.json'), 'utf-8')) as {
      to: string;
      migrationHash: string;
    };

    // The store canonicalizes JSON (compact, sorted keys), while the
    // emitted project artifact is pretty-printed — compare parsed content,
    // not bytes.
    expect(
      JSON.parse(readFileSync(contractSnapshotPath(ctx, manifest.to, 'contract.json'), 'utf-8')),
    ).toEqual(JSON.parse(readFileSync(join(ctx.outputDir, 'contract.json'), 'utf-8')));
    expect(readFileSync(contractSnapshotPath(ctx, manifest.to, 'contract.d.ts'), 'utf-8')).toBe(
      readFileSync(join(ctx.outputDir, 'contract.d.ts'), 'utf-8'),
    );

    const ops = JSON.parse(readFileSync(join(migrationDir, 'ops.json'), 'utf-8'));
    expect(ops).toEqual([]);
    // `migration new` always writes a fully attested package; the
    // `migrationHash` is the content-address over `(manifest, [])` since
    // the scaffolded `migration.ts` carries no operations yet. The
    // developer fills in operations and re-runs `node migration.ts` to
    // rewrite both `ops.json` and `migrationHash`.
    expect(manifest.migrationHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('Journey: Mongo migration authoring (live database)', {
  timeout: timeouts.spinUpMongoMemoryServer,
}, () => {
  let replSet: MongoMemoryReplSet;
  let client: MongoClient;
  const dbName = 'mongo_journey_test';
  const created = new Set<string>();

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      instanceOpts: [
        { launchTimeout: timeouts.spinUpMongoMemoryServer, storageEngine: 'wiredTiger' },
      ],
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    client = new MongoClient(replSet.getUri());
    await client.connect();
  }, timeouts.spinUpMongoMemoryServer);

  beforeEach(async () => {
    await client.db(dbName).dropDatabase();
  });

  afterEach(async () => {
    for (const dir of created) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    created.clear();
  });

  afterAll(async () => {
    await client?.close().catch(() => {});
    await replSet?.stop().catch(() => {});
  }, timeouts.spinUpMongoMemoryServer);

  it('plans + applies initial DDL, then hand-authored dataTransform migration runs against live MongoDB', async () => {
    const connectionString = buildMongoUri(replSet.getUri(), dbName);
    const ctx = setupMongoJourney(connectionString);
    created.add(ctx.testDir);

    const emit0 = await emitContract(ctx);
    expect(emit0.exitCode, `contract emit: ${emit0.stderr}`).toBe(0);

    const plan0 = await migrationPlan(ctx, ['--name', 'initial']);
    expect(plan0.exitCode, `migration plan initial: ${plan0.stdout}\n${plan0.stderr}`).toBe(0);

    const emitInit = await migrationEmit(ctx, [
      '--dir',
      `migrations/app/${basename(getLatestMigrationDir(ctx))}`,
    ]);
    expect(
      emitInit.exitCode,
      `migration emit initial: ${emitInit.stdout}\n${emitInit.stderr}`,
    ).toBe(0);

    const apply0 = await migrationApply(ctx);
    expect(apply0.exitCode, `migration apply initial: ${apply0.stdout}\n${apply0.stderr}`).toBe(0);

    const collections = await client.db(dbName).listCollections({ name: 'users' }).toArray();
    expect(collections.map((c) => c.name)).toContain('users');

    await client
      .db(dbName)
      .collection('users')
      .insertMany([
        { email: 'alice@example.com', name: 'Alice' },
        { email: 'bob@example.com', name: 'BOB' },
        { email: 'carol@example.com', name: 'Carol' },
      ]);

    swapToAdditive(ctx);
    const emit1 = await emitContract(ctx);
    expect(emit1.exitCode, `contract emit additive: ${emit1.stderr}`).toBe(0);

    const newResult = await migrationNew(ctx, ['--name', 'normalize-names']);
    expect(newResult.exitCode, `migration new: ${newResult.stdout}\n${newResult.stderr}`).toBe(0);

    const migrationDir = findMigrationDirBySlug(ctx, 'normalize_names');
    const migrationTsPath = join(migrationDir, 'migration.ts');
    const draftManifest = JSON.parse(
      readFileSync(join(migrationDir, 'migration.json'), 'utf-8'),
    ) as { from: string; to: string };

    // Hand-author the migration: a createIndex op (matches what the planner
    // would emit) plus a dataTransform that lowercases the `name` field.
    // The check finds documents whose `name` contains an uppercase letter;
    // after the transform all names are lower-case so the check is
    // satisfied, enabling idempotency-skip on re-apply (tested below).
    const handAuthored = `import { createIndex, dataTransform, Migration, MigrationCLI } from '@prisma/orm-mongo/target/migration';
import { RawUpdateManyCommand, RawAggregateCommand } from '@prisma/orm-mongo/query-ast/execution';

const planMeta = {
  target: 'mongo',
  storageHash: 'hand-authored',
  lane: 'mongo-raw',
  paramDescriptors: [],
};

class M extends Migration {
  override describe() {
    return {
      from: ${JSON.stringify(draftManifest.from)},
      to: ${JSON.stringify(draftManifest.to)},
    };
  }

  override get operations() {
    return [
      createIndex('users', [{ field: 'name', direction: 1 }]),
      dataTransform('lowercase-user-name', {
        check: {
          source: () => ({
            collection: 'users',
            command: new RawAggregateCommand(
              'users',
              [{ $match: { name: { $regex: '[A-Z]' } } }, { $limit: 1 }],
            ),
            meta: { ...planMeta, lane: 'mongo-pipeline' },
          }),
        },
        run: () => ({
          collection: 'users',
          command: new RawUpdateManyCommand(
            'users',
            { name: { $exists: true } },
            [{ $set: { name: { $toLower: '$name' } } }],
          ),
          meta: planMeta,
        }),
      }),
    ];
  }
}

export default M;
MigrationCLI.run(import.meta.url, M);
`;
    writeFileSync(migrationTsPath, handAuthored);

    const emitResult = await migrationEmit(ctx, ['--dir', migrationDir]);
    expect(emitResult.exitCode, `migration emit: ${emitResult.stdout}\n${emitResult.stderr}`).toBe(
      0,
    );

    const ops = JSON.parse(readFileSync(join(migrationDir, 'ops.json'), 'utf-8')) as ReadonlyArray<{
      id: string;
      operationClass: string;
    }>;
    expect(ops.map((o) => o.id)).toEqual(
      expect.arrayContaining(['data_transform.lowercase-user-name']),
    );
    expect(ops.some((o) => o.id.startsWith('index.users.'))).toBe(true);

    const manifest = JSON.parse(readFileSync(join(migrationDir, 'migration.json'), 'utf-8')) as {
      migrationHash: string;
    };
    expect(manifest.migrationHash).toMatch(/^[a-f0-9]{64}$/);

    const apply1 = await migrationApply(ctx);
    expect(apply1.exitCode, `migration apply additive: ${apply1.stdout}\n${apply1.stderr}`).toBe(0);

    const users = await client
      .db(dbName)
      .collection('users')
      .find({}, { projection: { _id: 0, email: 1, name: 1 } })
      .sort({ email: 1 })
      .toArray();
    expect(users).toEqual([
      { email: 'alice@example.com', name: 'alice' },
      { email: 'bob@example.com', name: 'bob' },
      { email: 'carol@example.com', name: 'carol' },
    ]);

    const indexes = await client.db(dbName).collection('users').indexes();
    expect(indexes.some((idx) => JSON.stringify(idx.key) === JSON.stringify({ name: 1 }))).toBe(
      true,
    );

    // Re-apply: the runner postcheck sees all names are already lower-case,
    // so the data transform is skipped. Data must be byte-identical.
    const apply2 = await migrationApply(ctx);
    expect(apply2.exitCode, `re-apply: ${apply2.stdout}\n${apply2.stderr}`).toBe(0);

    const usersAfterReApply = await client
      .db(dbName)
      .collection('users')
      .find({}, { projection: { _id: 0, email: 1, name: 1 } })
      .sort({ email: 1 })
      .toArray();
    expect(usersAfterReApply).toEqual(users);
  });
});
