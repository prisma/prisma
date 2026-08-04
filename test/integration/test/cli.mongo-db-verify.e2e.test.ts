import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MongoControlAdapterImpl } from '@internal/adapter-mongo/control';
import { createDbVerifyCommand } from '@internal/cli/commands/db-verify';
import { coreHash, crossRef, profileHash } from '@internal/contract/types';
import { MongoControlDriver } from '@internal/driver-mongo/control';
import { MongoCollection, type MongoContract, MongoIndex } from '@internal/mongo-contract';
import { timeouts } from '@repo/test-utils';
import { type Db, MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  executeCommand,
  getExitCode,
  setupCommandMocks,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';

const controlAdapter = new MongoControlAdapterImpl();

const testContract: MongoContract = {
  target: 'mongo',
  targetFamily: 'mongo',
  roots: { users: crossRef('User') },
  domain: {
    namespaces: {
      __unbound__: {
        models: {
          User: {
            fields: {
              _id: { nullable: false, type: { kind: 'scalar', codecId: 'mongo/objectId@1' } },
              email: { nullable: false, type: { kind: 'scalar', codecId: 'mongo/string@1' } },
            },
            relations: {},
            storage: { collection: 'users' },
          },
        },
      },
    },
  },
  storage: {
    namespaces: {
      __unbound__: {
        id: '__unbound__' as const,
        kind: 'mongo-namespace' as const,
        entries: {
          collection: {
            users: new MongoCollection({
              indexes: [
                new MongoIndex({ keys: [{ field: 'email', direction: 1 as const }], unique: true }),
              ],
            }),
          },
        },
      },
    },
    storageHash: coreHash('mongo-verify-test'),
  },
  capabilities: {},
  extensions: {},
  profileHash: profileHash('mongo-verify-test'),
  meta: {},
};

function extractJson(lines: string[]): unknown {
  const joined = lines.join('\n');
  const start = joined.indexOf('{');
  const end = joined.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found in output:\n${joined}`);
  }
  return JSON.parse(joined.slice(start, end + 1));
}

function writeContractJson(testDir: string, contract: MongoContract): void {
  const outputDir = resolve(testDir, 'output');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, 'contract.json'), JSON.stringify(contract, null, 2), 'utf-8');
}

describe('mongo db verify command (e2e)', { timeout: timeouts.spinUpMongoMemoryServer }, () => {
  let replSet: MongoMemoryReplSet;
  let client: MongoClient;
  let db: Db;
  let mongoUri: string;
  const dbName = 'verify_e2e_test';

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      instanceOpts: [
        { launchTimeout: timeouts.spinUpMongoMemoryServer, storageEngine: 'wiredTiger' },
      ],
      replSet: { count: 1, storageEngine: 'wiredTiger', dbName },
    });
    const baseUri = replSet.getUri();
    const url = new URL(baseUri);
    url.pathname = `/${dbName}`;
    mongoUri = url.toString();
    client = new MongoClient(replSet.getUri());
    await client.connect();
    db = client.db(dbName);
  }, timeouts.spinUpMongoMemoryServer);

  afterAll(async () => {
    try {
      await client?.close();
      await replSet?.stop();
    } catch {
      // ignore cleanup errors
    }
  }, timeouts.spinUpMongoMemoryServer);

  withTempDir(({ createTempDir }) => {
    let consoleOutput: string[] = [];
    let cleanupMocks: () => void = () => {};

    beforeEach(async () => {
      await db.dropDatabase();
      const mocks = setupCommandMocks();
      consoleOutput = mocks.consoleOutput;
      cleanupMocks = mocks.cleanup;
    });

    afterEach(() => {
      cleanupMocks();
    });

    it('reports error when marker is missing', async () => {
      await db.createCollection('users');
      await db.collection('users').createIndex({ email: 1 }, { unique: true });

      const testSetup = setupTestDirectoryFromFixtures(
        createTempDir,
        'mongo-db-commands',
        'prisma-next.config.with-db.ts',
        { '{{MONGO_URI}}': mongoUri },
      );
      writeContractJson(testSetup.testDir, testContract);

      const command = createDbVerifyCommand();
      const originalCwd = process.cwd();
      try {
        process.chdir(testSetup.testDir);
        await expect(
          executeCommand(command, ['--config', testSetup.configPath, '--json']),
        ).rejects.toThrow('process.exit called');
      } finally {
        process.chdir(originalCwd);
      }

      expect(getExitCode()).not.toBe(0);
      const parsed = extractJson(consoleOutput) as Record<string, unknown>;
      expect(parsed).toMatchObject({
        code: 'CONTRACT.MARKER_MISSING',
      });
    });

    it('verifies matching marker and schema', async () => {
      await db.createCollection('users');
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await controlAdapter.initMarker(new MongoControlDriver(db, client), 'app', {
        storageHash: testContract.storage.storageHash,
        profileHash: testContract.profileHash!,
      });

      const testSetup = setupTestDirectoryFromFixtures(
        createTempDir,
        'mongo-db-commands',
        'prisma-next.config.with-db.ts',
        { '{{MONGO_URI}}': mongoUri },
      );
      writeContractJson(testSetup.testDir, testContract);

      const outputStartIndex = consoleOutput.length;
      const command = createDbVerifyCommand();
      const originalCwd = process.cwd();
      try {
        process.chdir(testSetup.testDir);
        await executeCommand(command, ['--config', testSetup.configPath, '--json']);
      } finally {
        process.chdir(originalCwd);
      }

      expect(getExitCode()).toBe(0);
      const parsed = extractJson(consoleOutput.slice(outputStartIndex)) as Record<string, unknown>;
      expect(parsed).toMatchObject({
        ok: true,
        summary: expect.any(String),
      });
    });

    it('runs schema-only verification with matching schema', async () => {
      await db.createCollection('users');
      await db.collection('users').createIndex({ email: 1 }, { unique: true });

      const testSetup = setupTestDirectoryFromFixtures(
        createTempDir,
        'mongo-db-commands',
        'prisma-next.config.with-db.ts',
        { '{{MONGO_URI}}': mongoUri },
      );
      writeContractJson(testSetup.testDir, testContract);

      const outputStartIndex = consoleOutput.length;
      const command = createDbVerifyCommand();
      const originalCwd = process.cwd();
      try {
        process.chdir(testSetup.testDir);
        await executeCommand(command, [
          '--config',
          testSetup.configPath,
          '--schema-only',
          '--json',
        ]);
      } finally {
        process.chdir(originalCwd);
      }

      expect(getExitCode()).toBe(0);
      const parsed = extractJson(consoleOutput.slice(outputStartIndex)) as Record<string, unknown>;
      expect(parsed).toMatchObject({
        ok: true,
        summary: expect.stringContaining('matches contract'),
        meta: { strict: false },
      });
    });

    it('fails schema-only verification when index is missing', async () => {
      await db.createCollection('users');

      const testSetup = setupTestDirectoryFromFixtures(
        createTempDir,
        'mongo-db-commands',
        'prisma-next.config.with-db.ts',
        { '{{MONGO_URI}}': mongoUri },
      );
      writeContractJson(testSetup.testDir, testContract);

      const outputStartIndex = consoleOutput.length;
      const command = createDbVerifyCommand();
      const originalCwd = process.cwd();
      try {
        process.chdir(testSetup.testDir);
        await expect(
          executeCommand(command, ['--config', testSetup.configPath, '--schema-only', '--json']),
        ).rejects.toThrow('process.exit called');
      } finally {
        process.chdir(originalCwd);
      }

      expect(getExitCode()).toBe(1);
      const parsed = extractJson(consoleOutput.slice(outputStartIndex)) as Record<string, unknown>;
      expect(parsed).toMatchObject({
        ok: false,
      });
    });

    it('runs marker-only verification with matching marker', async () => {
      await controlAdapter.initMarker(new MongoControlDriver(db, client), 'app', {
        storageHash: testContract.storage.storageHash,
        profileHash: testContract.profileHash!,
      });

      const testSetup = setupTestDirectoryFromFixtures(
        createTempDir,
        'mongo-db-commands',
        'prisma-next.config.with-db.ts',
        { '{{MONGO_URI}}': mongoUri },
      );
      writeContractJson(testSetup.testDir, testContract);

      const outputStartIndex = consoleOutput.length;
      const command = createDbVerifyCommand();
      const originalCwd = process.cwd();
      try {
        process.chdir(testSetup.testDir);
        await executeCommand(command, [
          '--config',
          testSetup.configPath,
          '--marker-only',
          '--json',
        ]);
      } finally {
        process.chdir(originalCwd);
      }

      expect(getExitCode()).toBe(0);
      const parsed = extractJson(consoleOutput.slice(outputStartIndex)) as Record<string, unknown>;
      expect(parsed).toMatchObject({
        ok: true,
        mode: 'marker-only',
      });
    });
  });
});
