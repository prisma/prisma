import { MysqlControlAdapter } from '@internal/adapter-mysql/control';
import { assembleMysqlCodecRegistry } from '@internal/target-mysql/codecs';
import { mysqlDataTypes } from '@internal/target-mysql/data-types';
import { timeouts } from '@repo/test-utils';
import { describe, expect, it, vi } from 'vitest';
import mysql from '../../src/runtime/mysql';
import { contractFromJson } from '../../src/static/contract-from-json';
import type { Contract } from '../fixtures/generated/contract.d';
import contractJson from '../fixtures/generated/contract.json' with { type: 'json' };
import { exampleDatabase, withSeededDatabase } from './live-database';

const contract = contractFromJson<Contract>(contractJson);

describe('MySQL reads through the ORM and the SQL builder', {
  timeout: timeouts.databaseOperation,
}, () => {
  it('filters, orders and limits', async (test) => {
    await withSeededDatabase(test, exampleDatabase, async (url) => {
      await using db = mysql({ contract, url, verifyMarker: false });
      const users = await db.orm.User.where({ role: 'ADMIN' })
        .select('id', 'email')
        .orderBy((u) => u.email.asc())
        .limit(2)
        .all();
      expect(users).toEqual([
        { id: 2, email: 'a@example.com' },
        { id: 1, email: 'b@example.com' },
      ]);
    });
  });

  it('skips rows with an offset, with and without a limit', async (test) => {
    await withSeededDatabase(test, exampleDatabase, async (url) => {
      await using db = mysql({ contract, url, verifyMarker: false });
      const ordered = db.orm.User.select('id', 'role').orderBy((u) => u.id.asc());
      expect({
        offset: await ordered.offset(2).all(),
        page: await ordered.offset(1).limit(2).all(),
      }).toEqual({
        offset: [
          { id: 3, role: 'USER' },
          { id: 4, role: 'ADMIN' },
        ],
        page: [
          { id: 2, role: 'ADMIN' },
          { id: 3, role: 'USER' },
        ],
      });
    });
  });

  it('finds the first row matching a filter', async (test) => {
    await withSeededDatabase(test, exampleDatabase, async (url) => {
      await using db = mysql({ contract, url, verifyMarker: false });
      expect({
        found: await db.orm.User.select('id', 'email').first({ id: 3 }),
        missing: await db.orm.User.select('id').first({ id: 99 }),
      }).toEqual({ found: { id: 3, email: 'c@example.com' }, missing: null });
    });
  });

  it('runs a SQL builder select', async (test) => {
    await withSeededDatabase(test, exampleDatabase, async (url) => {
      await using db = mysql({ contract, url, verifyMarker: false });
      const rows = await db.query(
        db.sql.User.select('id', 'email')
          .where((f, fns) => fns.eq(f.role, 'ADMIN'))
          .orderBy('id')
          .build(),
      );
      expect(rows).toEqual([
        { id: 1, email: 'b@example.com' },
        { id: 2, email: 'a@example.com' },
        { id: 4, email: 'd@example.com' },
      ]);
    });
  });

  it('checks the marker the control tables hold, and warns when it is missing or differs', async (test) => {
    await withSeededDatabase(test, exampleDatabase, async (url, driver) => {
      const warnings = async () => {
        const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        await using db = mysql({ contract, url, log });
        await db.orm.User.select('id').first({ id: 1 });
        return log.warn.mock.calls.map(([event]) => event.code);
      };
      const missing = await warnings();

      const adapter = new MysqlControlAdapter(assembleMysqlCodecRegistry({}, []), mysqlDataTypes);
      for (const node of adapter.bootstrapControlTableQueries()) {
        const { sql, params } = await adapter.lowerToExecuteRequest(node);
        await driver.query(sql, params);
      }
      await adapter.initMarker(driver, 'app', {
        storageHash: 'sha256:other',
        profileHash: contract.profileHash,
      });
      const differs = await warnings();
      await adapter.initMarker(driver, 'app', {
        storageHash: contract.storage.storageHash,
        profileHash: contract.profileHash,
      });
      const matches = await warnings();

      expect({ missing, differs, matches }).toEqual({
        missing: ['CONTRACT.MARKER_MISSING'],
        differs: ['CONTRACT.MARKER_MISMATCH'],
        matches: [],
      });
    });
  });
});
