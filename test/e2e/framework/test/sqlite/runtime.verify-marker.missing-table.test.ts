import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import sqliteAdapter from '@prisma-next/adapter-sqlite/runtime';
import sqliteDriver from '@prisma-next/driver-sqlite/runtime';
import { instantiateExecutionStack } from '@prisma-next/framework-components/execution';
import { UNBOUND_NAMESPACE_ID } from '@prisma-next/framework-components/ir';
import { sql as sqlBuilder } from '@prisma-next/sql-builder/runtime';
import type { Db } from '@prisma-next/sql-builder/types';
import {
  createExecutionContext,
  createSqlExecutionStack,
  type Log,
  type Runtime,
} from '@prisma-next/sql-runtime';
import { SqliteRuntimeImpl } from '@prisma-next/sqlite/runtime';
import sqliteTarget from '@prisma-next/target-sqlite/runtime';
import { timeouts } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestSqlContractSerializer as SqlContractSerializer } from '../../../../../packages/2-sql/9-family/test/test-sql-contract-serializer';
import type { Contract } from './fixtures/generated/contract.d';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractJsonPath = resolve(__dirname, 'fixtures/generated/contract.json');

interface Harness {
  readonly db: Db<Contract>;
  readonly runtime: Runtime;
  readonly cleanup: () => Promise<void>;
}

async function buildHarness(log: Log): Promise<Harness> {
  const contractJson = JSON.parse(readFileSync(contractJsonPath, 'utf-8')) as unknown;
  const contract = new SqlContractSerializer().deserializeContract(contractJson) as Contract;

  const testDir = mkdtempSync(join(tmpdir(), 'prisma-sqlite-verify-marker-'));
  const dbPath = join(testDir, 'test.db');

  // Deliberately skip `_prisma_marker` — exercises the
  // attached-to-uninitialised-DB scenario.
  const rawDb = new DatabaseSync(dbPath);
  rawDb.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      invited_by_id INTEGER
    )
  `);
  rawDb.exec(`
    INSERT INTO users (id, name, email, invited_by_id)
    VALUES (1, 'Alice', 'alice@example.com', NULL)
  `);
  rawDb.close();

  const stack = createSqlExecutionStack({
    target: sqliteTarget,
    adapter: sqliteAdapter,
    driver: sqliteDriver,
    extensions: [],
  });

  const stackInstance = instantiateExecutionStack(stack);
  const context = createExecutionContext({ contract, stack });
  const driver = stackInstance.driver;
  if (!driver) throw new Error('SQLite driver missing from execution stack');
  await driver.connect({ kind: 'path', path: dbPath });

  const runtime = new SqliteRuntimeImpl({ context, adapter: stackInstance.adapter, driver, log });
  const db = sqlBuilder<Contract>({
    context,
    rawCodecInferer: stack.adapter.rawCodecInferer,
  });

  return {
    db,
    runtime,
    async cleanup() {
      await runtime.close();
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    },
  };
}

describe('sqlite runtime verify-marker: missing marker table', {
  timeout: timeouts.databaseOperation,
}, () => {
  let harness: Harness | undefined;

  beforeEach(() => {
    harness = undefined;
  });

  afterEach(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  it('logs warn and proceeds when the marker table is absent', async () => {
    const contractJson = JSON.parse(readFileSync(contractJsonPath, 'utf-8')) as unknown;
    const contract = new SqlContractSerializer().deserializeContract(contractJson) as Contract;
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } satisfies Log;

    harness = await buildHarness(log);

    const rows = await harness.runtime
      .execute(harness.db[UNBOUND_NAMESPACE_ID].users.select('id').build())
      .toArray();

    expect(rows.map((r) => r.id)).toEqual([1]);
    expect(log.warn).toHaveBeenCalledOnce();
    expect(log.warn).toHaveBeenCalledWith({
      code: 'CONTRACT.MARKER_MISSING',
      scope: 'marker-verification',
      expected: {
        storageHash: contract.storage.storageHash,
        profileHash: contract.profileHash ?? null,
      },
      actual: null,
      message: 'Contract marker not found in database',
    });
  });
});
