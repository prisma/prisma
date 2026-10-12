/**
 * Field changes on a MongoDB contract written in TypeScript, which gives its collections no validator.
 *
 * Field names are then not in the contract's storage hash, so a migration that only renames or removes a field would start and end at the same hash, which `db migrate` refuses. `migration plan` refuses the change before it writes anything; `db update` carries it out. Journey H1 renames `Event.name` and follows the refusal's advice through `db update`. Journey H2 removes the field: no statement names a removal, so `migration plan` finds no change and writes nothing, and `db update` carries it out.
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { timeouts } from '@repo/test-utils';
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fixtureAppDir } from '../utils/cli-test-helpers';
import {
  engineError,
  getMigrationDirs,
  type JourneyContext,
  latestMigrationDirName,
  parseJsonOutput,
  runContractEmit,
  runDbUpdate,
  runMigrate,
  runMigrationPlan,
} from '../utils/journey-test-helpers';

const FIXTURES_DIR = join(fixtureAppDir, 'fixtures/mongo-cli-journeys');

function withDatabase(baseUri: string, dbName: string): string {
  const url = new URL(baseUri);
  url.pathname = `/${dbName}`;
  return url.toString();
}

function setupProject(connectionString: string): JourneyContext {
  const testDir = join(
    fixtureAppDir,
    `test-mongo-same-hash-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const outputDir = join(testDir, 'output');
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(join(testDir, 'migrations'), { recursive: true });
  writeFileSync(
    join(testDir, 'package.json'),
    JSON.stringify({
      name: 'mongo-same-hash-journey',
      private: true,
      type: 'module',
      dependencies: { '@prisma/orm-mongo': 'workspace:0.16.0' },
    }),
    'utf-8',
  );
  copyFileSync(join(FIXTURES_DIR, 'contract-with-events.ts'), join(testDir, 'contract.ts'));
  const config = readFileSync(join(FIXTURES_DIR, 'prisma.config.with-db.ts'), 'utf-8').replace(
    /\{\{DB_URL\}\}/g,
    () => connectionString,
  );
  const configPath = join(testDir, 'prisma.config.ts');
  writeFileSync(configPath, config, 'utf-8');
  return { testDir, configPath, outputDir };
}

async function useFixture(ctx: JourneyContext, name: string, label: string): Promise<void> {
  copyFileSync(join(FIXTURES_DIR, name), join(ctx.testDir, 'contract.ts'));
  const emitted = await runContractEmit(ctx);
  expect(emitted.exitCode, `${label}: emit: ${emitted.stderr}`).toBe(0);
}

describe('Journeys (MongoDB): field changes that leave the storage hash unchanged', {
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

  async function migratedProject(dbName: string, label: string) {
    const ctx = setupProject(withDatabase(replSet.getUri(), dbName));
    created.add(ctx.testDir);
    await useFixture(ctx, 'contract-with-events.ts', `${label}.01`);
    const initial = await runMigrationPlan(ctx, ['--name', 'initial']);
    expect(initial.exitCode, `${label}.02: plan initial: ${initial.stderr}`).toBe(0);
    expect((await runMigrate(ctx)).exitCode, `${label}.03: migrate initial`).toBe(0);
    await client.db(dbName).collection('events').insertOne({ name: 'launch' });
    return { ctx, origin: latestMigrationDirName(ctx) };
  }

  async function events(dbName: string) {
    return client
      .db(dbName)
      .collection('events')
      .find({}, { projection: { _id: 0 } })
      .toArray();
  }

  it('H1: migration plan refuses a field rename, and db update carries it out as advised', async () => {
    const dbName = 'mongo_same_hash_rename';
    const { ctx, origin } = await migratedProject(dbName, 'H1');
    await useFixture(ctx, 'contract-events-name-renamed.ts', 'H1.04');
    const rename = ['--rename', 'Event.name:Event.title'];

    const refused = await runMigrationPlan(ctx, ['--from', origin, ...rename, '--json']);
    expect(refused.exitCode, 'H1.05: the rename is refused').not.toBe(0);
    const error = JSON.stringify(engineError(refused));
    expect(error, 'H1.05: names the field and the reason').toContain(
      'Cannot rename field \\"Event.name\\" to \\"Event.title\\": the migration would start and end at the same contract hash',
    );
    expect(error, 'H1.05: says what works').toContain('Use prisma db update for this change');
    expect(getMigrationDirs(ctx), 'H1.05: nothing written').toHaveLength(1);

    const updated = await runDbUpdate(ctx, ['--no-interactive', ...rename, '--json']);
    expect(updated.exitCode, `H1.06: db update: ${updated.stderr}`).toBe(0);
    expect(await events(dbName), 'H1.06: the value is under the new name').toEqual([
      { title: 'launch' },
    ]);
  });

  it('H2: migration plan finds no change in a field removal, and db update carries it out', async () => {
    const dbName = 'mongo_same_hash_remove';
    const { ctx, origin } = await migratedProject(dbName, 'H2');
    await useFixture(ctx, 'contract-events-name-removed.ts', 'H2.04');

    const unstated = await runMigrationPlan(ctx, ['--from', origin, '--json']);
    expect(unstated.exitCode, `H2.05: without a statement: ${unstated.stderr}`).toBe(0);
    expect(
      parseJsonOutput<{ noOp: boolean }>(unstated).noOp,
      'H2.05: the hash is unchanged, so the plan sees no change',
    ).toBe(true);

    expect(getMigrationDirs(ctx), 'H2.05: nothing written').toHaveLength(1);

    const updated = await runDbUpdate(ctx, [
      '--no-interactive',
      '--delete',
      'Event.name',
      '--json',
    ]);
    expect(updated.exitCode, `H2.06: db update: ${updated.stderr}`).toBe(0);
    expect(await events(dbName), 'H2.06: the field is gone').toEqual([{}]);
  });
});
