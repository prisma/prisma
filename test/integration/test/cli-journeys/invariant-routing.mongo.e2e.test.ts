/**
 * Invariant-aware ref routing — end-to-end against MongoDB.
 *
 * Mirrors the Postgres-backed `invariant-routing.e2e.test.ts` to confirm
 * the routing surface is family-neutral. The CLI commands and the
 * migration-tools pathfinder are target-agnostic; this file is a smoke
 * test that the full apply / status flow works against a live Mongo
 * runner with marker.invariants accumulating server-side via the
 * aggregation-pipeline merge.
 *
 * Three journeys: happy path with marker accumulation, UNKNOWN_INVARIANT
 * pre-check, and NO_INVARIANT_PATH on a divergent graph.
 */

import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { timeouts } from '@repo/test-utils';
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fixtureAppDir } from '../utils/cli-test-helpers';
import {
  engineError,
  type JourneyContext,
  migrationStatusAppSpace,
  parseJsonOutput,
  parseMigrationStatusJson,
  runContractEmit,
  runMigrate,
  runMigrationEmit,
  runMigrationNew,
  runMigrationPlan,
  runMigrationStatus,
} from '../utils/journey-test-helpers';

const FIXTURES_DIR = join(fixtureAppDir, 'fixtures/mongo-cli-journeys');
const INVARIANT_ID = 'lowercase-user-name';

function setupMongoJourney(connectionString: string): JourneyContext {
  const testDir = join(
    fixtureAppDir,
    `test-mongo-invariants-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(testDir, { recursive: true });
  const outputDir = join(testDir, 'output');
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(join(testDir, 'migrations'), { recursive: true });
  // Says which database this project is for. Without it the project inherits
  // the fixture app's manifest, which carries every database these suites
  // exercise and so answers no single import root.
  writeFileSync(
    join(testDir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'mongo-invariants-app',
        private: true,
        type: 'module',
        dependencies: { '@prisma/orm-mongo': 'workspace:0.16.0' },
      },
      null,
      2,
    )}\n`,
    'utf-8',
  );

  copyFileSync(join(FIXTURES_DIR, 'contract-base.ts'), join(testDir, 'contract.ts'));

  let configContent = readFileSync(join(FIXTURES_DIR, 'prisma.config.with-db.ts'), 'utf-8');
  configContent = configContent.replace(/\{\{DB_URL\}\}/g, () => connectionString);
  const configPath = join(testDir, 'prisma.config.ts');
  writeFileSync(configPath, configContent, 'utf-8');

  return { testDir, configPath, outputDir };
}

function swapToAdditive(ctx: JourneyContext): void {
  copyFileSync(join(FIXTURES_DIR, 'contract-additive.ts'), join(ctx.testDir, 'contract.ts'));
}

function swapToBranchB(ctx: JourneyContext): void {
  copyFileSync(join(FIXTURES_DIR, 'contract-branch-b.ts'), join(ctx.testDir, 'contract.ts'));
}

function getLatestMigrationDir(ctx: JourneyContext): string {
  const migrationsDir = join(ctx.testDir, 'migrations', 'app');
  const dirs = readdirSync(migrationsDir).filter((d) => {
    if (d.startsWith('.')) return false;
    if (d === 'refs') return false;
    return statSync(join(migrationsDir, d)).isDirectory();
  });
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

function findMigrationDirBySlug(ctx: JourneyContext, slugFragment: string): string {
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

function buildMongoUri(baseUri: string, dbName: string): string {
  const [hostPart, query] = baseUri.split('?');
  const trimmedHost = (hostPart ?? '').replace(/\/?$/, '/');
  return query ? `${trimmedHost}${dbName}?${query}` : `${trimmedHost}${dbName}`;
}

function writeRefFile(
  ctx: JourneyContext,
  name: string,
  hash: string,
  invariants: readonly string[],
): void {
  const refsDir = join(ctx.testDir, 'migrations', 'app', 'refs');
  mkdirSync(refsDir, { recursive: true });
  const file = join(refsDir, `${name}.json`);
  writeFileSync(file, `${JSON.stringify({ hash, invariants }, null, 2)}\n`, 'utf-8');
}

/**
 * Renders a hand-authored Mongo migration.ts that adds a `name` index and
 * runs a `dataTransform` lowercasing user names. The transform optionally
 * declares an `invariantId` so refs can route on it.
 */
function renderInvariantMigrationTs(
  draftFrom: string,
  draftTo: string,
  opts: { invariantId?: string },
): string {
  const invariantField = opts.invariantId
    ? `        invariantId: ${JSON.stringify(opts.invariantId)},\n`
    : '';
  return `import { createIndex, dataTransform, Migration, MigrationCLI } from '@prisma/orm-mongo/target/migration';
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
      from: ${JSON.stringify(draftFrom)},
      to: ${JSON.stringify(draftTo)},
    };
  }

  override get operations() {
    return [
      createIndex('users', [{ field: 'name', direction: 1 }]),
      dataTransform('lowercase-user-name', {
${invariantField}        check: {
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
}

/**
 * Renders a hand-authored Mongo migration.ts that only adds an index — no
 * dataTransform, so the migration declares no invariants. Used by the
 * NO_INVARIANT_PATH journey to build a divergent edge that doesn't cover
 * the ref-required invariant.
 */
function renderIndexOnlyMigrationTs(draftFrom: string, draftTo: string): string {
  return `import { createIndex, Migration, MigrationCLI } from '@prisma/orm-mongo/target/migration';

class M extends Migration {
  override describe() {
    return {
      from: ${JSON.stringify(draftFrom)},
      to: ${JSON.stringify(draftTo)},
    };
  }

  override get operations() {
    return [
      createIndex('users', [{ field: 'email', direction: -1 }]),
    ];
  }
}

export default M;
MigrationCLI.run(import.meta.url, M);
`;
}

describe('Journey: Mongo invariant-aware ref routing (live database)', {
  timeout: timeouts.spinUpMongoMemoryServer,
}, () => {
  let replSet: MongoMemoryReplSet;
  let client: MongoClient;
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

  let dbName: string;
  beforeEach(async () => {
    dbName = `mongo_inv_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  });

  afterEach(async () => {
    await client
      ?.db(dbName)
      .dropDatabase()
      .catch(() => {});
    for (const dir of created) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    created.clear();
  });

  afterAll(async () => {
    await client?.close().catch(() => {});
    await replSet?.stop().catch(() => {});
  }, timeouts.spinUpMongoMemoryServer);

  it('Mongo O: invariantId on dataTransform → ref requires it → apply lowercases names + accumulates marker → re-apply is noop', async () => {
    const ctx = setupMongoJourney(buildMongoUri(replSet.getUri(), dbName));
    created.add(ctx.testDir);

    // Mongo-O.01: emit base + plan + apply init (creates `users` collection + email index).
    expect((await runContractEmit(ctx)).exitCode, 'Mongo-O.01: emit base').toBe(0);
    expect((await runMigrationPlan(ctx, ['--name', 'initial'])).exitCode, 'Mongo-O.01: plan').toBe(
      0,
    );
    expect(
      (
        await runMigrationEmit(ctx, [
          '--dir',
          `migrations/app/${basename(getLatestMigrationDir(ctx))}`,
        ])
      ).exitCode,
      'Mongo-O.01: emit init',
    ).toBe(0);
    expect((await runMigrate(ctx)).exitCode, 'Mongo-O.01: apply init').toBe(0);

    // Mongo-O.02: seed a row whose `name` needs lower-casing.
    await client
      .db(dbName)
      .collection('users')
      .insertMany([
        { email: 'alice@example.com', name: 'Alice' },
        { email: 'bob@example.com', name: 'BOB' },
      ]);

    // Mongo-O.03: swap to additive (adds `name` index), emit, scaffold a hand-authored migration.
    swapToAdditive(ctx);
    expect((await runContractEmit(ctx)).exitCode, 'Mongo-O.03: emit additive').toBe(0);
    expect(
      (await runMigrationNew(ctx, ['--name', 'normalize-names'])).exitCode,
      'Mongo-O.03: migration new',
    ).toBe(0);

    const migrationDir = findMigrationDirBySlug(ctx, 'normalize_names');
    const migrationTsPath = join(migrationDir, 'migration.ts');
    const draftManifest = JSON.parse(
      readFileSync(join(migrationDir, 'migration.json'), 'utf-8'),
    ) as { from: string; to: string };

    // Mongo-O.04: write the migration with invariantId baked in.
    writeFileSync(
      migrationTsPath,
      renderInvariantMigrationTs(draftManifest.from, draftManifest.to, {
        invariantId: INVARIANT_ID,
      }),
    );
    expect(
      (await runMigrationEmit(ctx, ['--dir', migrationDir])).exitCode,
      'Mongo-O.04: emit',
    ).toBe(0);

    // Mongo-O.05: confirm migration.json carries providedInvariants.
    const manifestAfter = JSON.parse(readFileSync(join(migrationDir, 'migration.json'), 'utf-8'));
    expect(
      manifestAfter.providedInvariants,
      'Mongo-O.05: manifest carries providedInvariants',
    ).toEqual([INVARIANT_ID]);
    const c2Hash = manifestAfter.to as string;

    // Mongo-O.06: declare a ref that requires the invariant.
    writeRefFile(ctx, 'prod', c2Hash, [INVARIANT_ID]);

    // Mongo-O.07: apply --ref prod — routes through the invariant edge.
    const applyRef = await runMigrate(ctx, ['--to', 'prod', '--json']);
    expect(
      applyRef.exitCode,
      `Mongo-O.07: apply --ref prod: ${applyRef.stdout}\n${applyRef.stderr}`,
    ).toBe(0);
    const applyResult = parseJsonOutput<{
      ok: boolean;
      markerHash: string;
      pathDecision?: {
        requiredInvariants: readonly string[];
        satisfiedInvariants: readonly string[];
        selectedPath: readonly { dirName: string; invariants: readonly string[] }[];
      };
    }>(applyRef);
    expect(applyResult.ok, 'Mongo-O.07: ok').toBe(true);
    expect(applyResult.markerHash, 'Mongo-O.07: marker advanced').toBe(c2Hash);
    expect(
      applyResult.pathDecision?.requiredInvariants,
      'Mongo-O.07: required reflects ref',
    ).toEqual([INVARIANT_ID]);
    expect(
      applyResult.pathDecision?.satisfiedInvariants,
      'Mongo-O.07: satisfied = required',
    ).toEqual([INVARIANT_ID]);
    expect(
      applyResult.pathDecision?.selectedPath.at(-1)?.invariants,
      'Mongo-O.07: selectedPath edge carries the invariant',
    ).toEqual([INVARIANT_ID]);

    // Mongo-O.08: data was actually lowercased.
    const users = await client
      .db(dbName)
      .collection('users')
      .aggregate([{ $project: { _id: 0, email: 1, name: 1 } }, { $sort: { email: 1 } }])
      .toArray();
    expect(users, 'Mongo-O.08: names lowercased').toEqual([
      { email: 'alice@example.com', name: 'alice' },
      { email: 'bob@example.com', name: 'bob' },
    ]);

    // Mongo-O.09: status --ref prod surfaces the three invariant sets and
    // proves the marker doc accumulated the invariant via $setUnion.
    const statusRef = await runMigrationStatus(ctx, ['--to', 'prod', '--json']);
    expect(statusRef.exitCode, 'Mongo-O.09: status --ref prod').toBe(0);
    const statusResult = parseMigrationStatusJson(statusRef);
    expect(
      statusResult.diagnostics?.some((d) => d.code === 'MIGRATION.MISSING_INVARIANTS'),
      'Mongo-O.09: missing empty',
    ).toBeFalsy();
    expect(statusResult.summary, 'Mongo-O.09: up to date').toMatch(/up to date/i);
    expect(
      migrationStatusAppSpace(statusResult).migrations.every((m) => m.status === 'applied'),
      'Mongo-O.09: path migrations applied',
    ).toBe(true);

    // Mongo-O.10: re-apply is a noop. The CLI's marker subtraction empties
    // the required set; the Mongo runner additionally short-circuits via
    // its own `incomingIsSubsetOfExisting` guard.
    const reapply = await runMigrate(ctx, ['--to', 'prod', '--json']);
    expect(reapply.exitCode, 'Mongo-O.10: re-apply').toBe(0);
    const reapplyResult = parseJsonOutput<{
      ok: boolean;
      markerHash: string;
      summary: string;
    }>(reapply);
    expect(reapplyResult.ok, 'Mongo-O.10: ok').toBe(true);
    expect(reapplyResult.markerHash, 'Mongo-O.10: marker unchanged').toBe(c2Hash);
    expect(reapplyResult.summary, 'Mongo-O.10: noop summary').toMatch(/up to date/i);
  });

  it('Mongo P: apply and status both exit with MIGRATION.UNKNOWN_INVARIANT before any DB activity', async () => {
    const ctx = setupMongoJourney(buildMongoUri(replSet.getUri(), dbName));
    created.add(ctx.testDir);

    // Mongo-P.01: stand up an init migration on disk; no invariant declared.
    expect((await runContractEmit(ctx)).exitCode, 'Mongo-P.01: emit base').toBe(0);
    expect((await runMigrationPlan(ctx, ['--name', 'initial'])).exitCode, 'Mongo-P.01: plan').toBe(
      0,
    );
    const initDir = getLatestMigrationDir(ctx);
    expect(
      (await runMigrationEmit(ctx, ['--dir', `migrations/app/${basename(initDir)}`])).exitCode,
      'Mongo-P.01: emit init',
    ).toBe(0);
    expect((await runMigrate(ctx)).exitCode, 'Mongo-P.01: apply init').toBe(0);

    // Mongo-P.02: hand-author an additive migration with INVARIANT_ID.
    swapToAdditive(ctx);
    expect((await runContractEmit(ctx)).exitCode, 'Mongo-P.02: emit additive').toBe(0);
    expect(
      (await runMigrationNew(ctx, ['--name', 'normalize-names'])).exitCode,
      'Mongo-P.02: new',
    ).toBe(0);
    const dir2 = findMigrationDirBySlug(ctx, 'normalize_names');
    const draft = JSON.parse(readFileSync(join(dir2, 'migration.json'), 'utf-8')) as {
      from: string;
      to: string;
    };
    writeFileSync(
      join(dir2, 'migration.ts'),
      renderInvariantMigrationTs(draft.from, draft.to, { invariantId: INVARIANT_ID }),
    );
    expect((await runMigrationEmit(ctx, ['--dir', dir2])).exitCode, 'Mongo-P.02: emit').toBe(0);

    const manifest = JSON.parse(readFileSync(join(dir2, 'migration.json'), 'utf-8'));
    const c2Hash = manifest.to as string;

    // Mongo-P.03: ref names an id no migration declares.
    writeRefFile(ctx, 'prod', c2Hash, ['typo-no-migration-declares-this']);

    // Mongo-P.04: apply fails with UNKNOWN_INVARIANT.
    const applyFail = await runMigrate(ctx, ['--to', 'prod', '--json']);
    expect(applyFail.exitCode, 'Mongo-P.04: apply exits 2').toBe(2);
    const applyEnvelope = parseJsonOutput<{
      code?: string;
      meta?: { unknown?: readonly string[]; declared?: readonly string[] };
    }>(applyFail);
    expect(applyEnvelope.code, 'Mongo-P.04: error code').toBe('MIGRATION.UNKNOWN_INVARIANT');
    expect(applyEnvelope.meta?.unknown, 'Mongo-P.04: unknown listed').toEqual([
      'typo-no-migration-declares-this',
    ]);
    expect(applyEnvelope.meta?.declared, 'Mongo-P.04: declared listed').toEqual([INVARIANT_ID]);

    // Mongo-P.05: marker untouched (still at C1, not C2). Read via status
    // without --ref so the pre-check doesn't fire.
    const statusOffline = await runMigrationStatus(ctx, ['--json']);
    expect(statusOffline.exitCode, 'Mongo-P.05: status').toBe(0);
    const offlineState = migrationStatusAppSpace(parseMigrationStatusJson(statusOffline));
    expect(offlineState.currentContract, 'Mongo-P.05: marker did not advance to C2').not.toBe(
      c2Hash,
    );

    // Mongo-P.06: status --ref also fatal (parity with apply).
    const statusFail = await runMigrationStatus(ctx, ['--to', 'prod', '--json']);
    expect(statusFail.exitCode, 'Mongo-P.06: status exits 2').toBe(2);
    expect(engineError(statusFail)?.code, 'Mongo-P.06: status error code').toBe(
      'MIGRATION.UNKNOWN_INVARIANT',
    );
  });

  it('Mongo Q: divergent graph — ref points at the no-invariant branch, apply fails with NO_INVARIANT_PATH', async () => {
    const ctx = setupMongoJourney(buildMongoUri(replSet.getUri(), dbName));
    created.add(ctx.testDir);

    // Mongo-Q.01: emit base, plan + apply init.
    expect((await runContractEmit(ctx)).exitCode, 'Mongo-Q.01: emit base').toBe(0);
    expect((await runMigrationPlan(ctx, ['--name', 'initial'])).exitCode, 'Mongo-Q.01: plan').toBe(
      0,
    );
    const initDir = getLatestMigrationDir(ctx);
    expect(
      (await runMigrationEmit(ctx, ['--dir', `migrations/app/${basename(initDir)}`])).exitCode,
      'Mongo-Q.01: emit init',
    ).toBe(0);
    expect((await runMigrate(ctx)).exitCode, 'Mongo-Q.01: apply init').toBe(0);
    const initManifest = JSON.parse(readFileSync(join(initDir, 'migration.json'), 'utf-8')) as {
      to: string;
    };
    const c1Hash = initManifest.to;

    // Mongo-Q.02: branch A — additive contract, hand-authored migration WITH invariantId.
    swapToAdditive(ctx);
    expect((await runContractEmit(ctx)).exitCode, 'Mongo-Q.02: emit CA').toBe(0);
    expect(
      (await runMigrationNew(ctx, ['--name', 'branch-a-with-invariant'])).exitCode,
      'Mongo-Q.02: new branch A',
    ).toBe(0);
    const branchADir = findMigrationDirBySlug(ctx, 'branch_a_with_invariant');
    const draftA = JSON.parse(readFileSync(join(branchADir, 'migration.json'), 'utf-8')) as {
      from: string;
      to: string;
    };
    writeFileSync(
      join(branchADir, 'migration.ts'),
      renderInvariantMigrationTs(draftA.from, draftA.to, { invariantId: INVARIANT_ID }),
    );
    expect(
      (await runMigrationEmit(ctx, ['--dir', branchADir])).exitCode,
      'Mongo-Q.02: emit branch A',
    ).toBe(0);

    // Mongo-Q.03: branch B — index-only migration, no invariantId, planned --from C1.
    // The destination contract snapshot store is content-addressed (keyed by
    // the contract's real storage hash), so branch B needs a genuinely
    // distinct contract to land at a distinct destination — swap to a third
    // fixture (a different additive index) and emit it before scaffolding,
    // then hand-author an index-only migration.ts against the real hash.
    swapToBranchB(ctx);
    expect((await runContractEmit(ctx)).exitCode, 'Mongo-Q.03: emit CB').toBe(0);
    expect(
      (await runMigrationNew(ctx, ['--name', 'branch-b-no-invariant', '--from', c1Hash])).exitCode,
      'Mongo-Q.03: new branch B',
    ).toBe(0);
    const branchBDir = findMigrationDirBySlug(ctx, 'branch_b_no_invariant');
    const branchBManifest = JSON.parse(
      readFileSync(join(branchBDir, 'migration.json'), 'utf-8'),
    ) as { from: string; to: string };
    const cbHash = branchBManifest.to;
    writeFileSync(
      join(branchBDir, 'migration.ts'),
      renderIndexOnlyMigrationTs(branchBManifest.from, cbHash),
    );
    expect(
      (await runMigrationEmit(ctx, ['--dir', branchBDir])).exitCode,
      'Mongo-Q.03: emit branch B',
    ).toBe(0);

    // Mongo-Q.04: ref points at CB but requires INVARIANT_ID — declared on
    // branch A, not on the path C1 → CB.
    writeRefFile(ctx, 'prod', cbHash, [INVARIANT_ID]);

    // Mongo-Q.05: apply --ref prod fails with NO_INVARIANT_PATH.
    const applyFail = await runMigrate(ctx, ['--to', 'prod', '--json']);
    expect(applyFail.exitCode, 'Mongo-Q.05: apply exits 2').toBe(2);
    const envelope = parseJsonOutput<{
      code?: string;
      meta?: {
        required?: readonly string[];
        missing?: readonly string[];
        structuralPath?: readonly { dirName: string; invariants: readonly string[] }[];
      };
    }>(applyFail);
    expect(envelope.code, 'Mongo-Q.05: error code').toBe('MIGRATION.NO_INVARIANT_PATH');
    expect(envelope.meta?.required, 'Mongo-Q.05: required').toEqual([INVARIANT_ID]);
    expect(envelope.meta?.missing, 'Mongo-Q.05: missing').toEqual([INVARIANT_ID]);
    expect(envelope.meta?.structuralPath, 'Mongo-Q.05: structuralPath populated').toBeDefined();
    expect(
      envelope.meta?.structuralPath?.at(-1)?.invariants,
      'Mongo-Q.05: CB-branch edge has no invariants',
    ).toEqual([]);
  });
});
