import type { SqlControlAdapter } from '@internal/family-sql/control-adapter';
import { DdlNode } from '@internal/sql-relational-core/ast';
import { describe, expect, it } from 'vitest';
import { mysqlAdapterCapabilities } from '../src/core/capabilities';
import { createAdapter, recordingDriver } from './helpers';

class OtherDdl extends DdlNode {
  readonly kind = 'other' as const;
}

const markerRow = {
  space: 'app',
  core_hash: 'sha256:core',
  profile_hash: 'sha256:profile',
  contract_json: null,
  canonical_version: '1',
  updated_at: '2024-01-02 03:04:05.678',
  app_tag: null,
  meta: '{}',
  invariants: '["b","a"]',
};

const ledgerRow = {
  space: 'app',
  migration_name: '20240101_init',
  migration_hash: 'sha256:m',
  origin_core_hash: null,
  destination_core_hash: 'sha256:core',
  operations: '[{"id":"one"},{"id":"two"}]',
  created_at: '2024-01-02 03:04:05.678',
};

function catalogDriver(tables: readonly string[], rows: readonly Record<string, unknown>[]) {
  return recordingDriver((sql, params) => {
    if (sql.includes('information_schema.TABLES')) {
      return tables.includes(String(params[0])) ? [{ TABLE_NAME: params[0] }] : [];
    }
    return rows;
  });
}

describe('MysqlControlAdapter', () => {
  it('reports the capabilities of MySQL 8.4', () => {
    expect(mysqlAdapterCapabilities).toEqual({
      sql: { orderBy: true, limit: true, foreignKeys: true, enums: true },
    });
  });

  it('reads no marker from a database without the marker table', async () => {
    const adapter = createAdapter();
    const driver = catalogDriver([], []);
    expect(await adapter.readMarker(driver, 'app')).toBeNull();
    expect(await adapter.readAllMarkers(driver)).toEqual(new Map());
    expect(await adapter.readLedger(driver)).toEqual([]);
  });

  it('reads a marker row as MySQL sends it', async () => {
    const adapter = createAdapter();
    const driver = catalogDriver(['_prisma_marker'], [markerRow]);
    const expected = {
      storageHash: 'sha256:core',
      profileHash: 'sha256:profile',
      contractJson: null,
      canonicalVersion: 1,
      updatedAt: new Date('2024-01-02T03:04:05.678Z'),
      appTag: null,
      meta: {},
      invariants: ['b', 'a'],
    };
    expect(await adapter.readMarker(driver, 'app')).toEqual(expected);
    expect(await adapter.readAllMarkers(driver)).toEqual(new Map([['app', expected]]));
    expect(driver.statements.at(-1)).toBe(
      'SELECT space, core_hash, profile_hash, contract_json, canonical_version, updated_at, app_tag, meta, invariants FROM `_prisma_marker`',
    );
  });

  it('refuses a marker row whose invariants are not JSON', async () => {
    const driver = catalogDriver(['_prisma_marker'], [{ ...markerRow, invariants: '[' }]);
    await expect(createAdapter().readMarker(driver, 'app')).rejects.toThrow(/corrupt/);
  });

  it('reads the ledger in the order it was written', async () => {
    const driver = catalogDriver(['_prisma_ledger'], [ledgerRow]);
    expect(await createAdapter().readLedger(driver, 'app')).toEqual([
      {
        space: 'app',
        migrationName: '20240101_init',
        migrationHash: 'sha256:m',
        from: null,
        to: 'sha256:core',
        appliedAt: new Date('2024-01-02T03:04:05.678Z'),
        operationCount: 2,
      },
    ]);
    expect(driver.statements.at(-1)).toMatch(/WHERE space = \? ORDER BY id$/);
  });

  it('commits work that succeeds and rolls back work that fails', async () => {
    const adapter = createAdapter();
    const driver = recordingDriver();
    expect(await adapter.withTransaction(driver, async () => 'done')).toBe('done');
    await expect(
      adapter.withTransaction(driver, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(driver.statements).toEqual([
      'START TRANSACTION',
      'COMMIT',
      'START TRANSACTION',
      'ROLLBACK',
    ]);
  });

  it('refuses what the migration slice builds', async () => {
    const adapter: SqlControlAdapter<'mysql'> = createAdapter();
    const driver = recordingDriver();
    const destination = { storageHash: 'a', profileHash: 'b' };
    const refusals = [
      adapter.insertMarker(driver, 'app', destination),
      adapter.initMarker(driver, 'app', destination),
      adapter.updateMarker(driver, 'app', 'x', destination),
      adapter.writeLedgerEntry(driver, 'app', {
        edgeId: 'e',
        from: 'a',
        to: 'b',
        migrationName: 'm',
        migrationHash: 'h',
        operations: [],
      }),
      adapter.lockMarker(driver),
      adapter.lowerToExecuteRequest({} as never),
    ];
    for (const refusal of refusals) {
      await expect(refusal).rejects.toMatchObject({ code: 'MIGRATION.TARGET_UNSUPPORTED' });
    }
    expect(() => adapter.lower({} as never, { contract: undefined })).toThrow(/Lowering queries/);
    expect(() => adapter.lower(new OtherDdl(), { contract: undefined })).toThrow(
      /cannot lower DDL/,
    );
    await expect(adapter.lowerToExecuteRequest(new OtherDdl())).rejects.toThrow(/"other"/);
  });

  it('bootstraps the marker table for db sign', () => {
    expect(createAdapter().bootstrapSignMarkerQueries()).toHaveLength(1);
    expect(createAdapter().bootstrapControlTableQueries()).toHaveLength(2);
  });
});
