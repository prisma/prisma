import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import mysql from '../../src/runtime/mysql';
import { contractFromJson } from '../../src/static/contract-from-json';
import type { Contract } from '../fixtures/generated/contract.d';
import contractJson from '../fixtures/generated/contract.json' with { type: 'json' };
import { exampleDatabase, withSeededDatabase } from './live-database';

const contract = contractFromJson<Contract>(contractJson);

const restored = { nbe: 0, ansi: 0, tz: '+00:00', cs: 'utf8mb4' };

function singleConnection(url: string): string {
  const single = new URL(url);
  single.searchParams.set('connectionLimit', '1');
  return single.toString();
}

describe('MySQL session settings after raw SQL', { timeout: timeouts.databaseOperation }, () => {
  it('restores the session settings raw SQL changed before the next statement, on pooled, streamed and held paths', async (test) => {
    await withSeededDatabase(
      test,
      [...exampleDatabase, "CREATE PROCEDURE shift_zone() BEGIN SET time_zone = '+05:00'; END"],
      async (url) => {
        await using db = mysql({ contract, url: singleConnection(url), verifyMarker: false });
        const run = (sql: TemplateStringsArray) =>
          db.execute(db.raw.sql(sql).affectedCount().build());
        const session = async () => {
          const [row] = await db.query(
            db.raw
              .sql`SELECT FIND_IN_SET('NO_BACKSLASH_ESCAPES', @@SESSION.sql_mode) AS nbe, FIND_IN_SET('ANSI_QUOTES', @@SESSION.sql_mode) AS ansi, @@SESSION.time_zone AS tz, @@SESSION.character_set_client AS cs`
              .returnsRow({
                nbe: 'mysql/int@1',
                ansi: 'mysql/int@1',
                tz: 'mysql/text@1',
                cs: 'mysql/text@1',
              })
              .build(),
          );
          return row;
        };

        await run`SET SESSION session_track_system_variables = ''`;
        await run`SET SESSION sql_mode = 'ANSI_QUOTES,NO_BACKSLASH_ESCAPES'`;
        const afterTrackingOff = await session();

        await run`CALL shift_zone()`;
        const afterProcedure = await session();

        await run`SET NAMES latin1`;
        const afterNames = await session();

        for await (const _row of db.query(
          db.raw.sql`SET time_zone = '+03:00'`.returnsRow({}).build(),
        )) {
        }
        const afterStreamedZone = await session();

        const inTransaction = await db.transaction(async (tx) => {
          await tx.execute(tx.raw.sql`SET time_zone = '+07:00'`.affectedCount().build());
          const [row] = await tx.query(
            tx.raw.sql`SELECT @@SESSION.time_zone AS tz`.returnsRow({ tz: 'mysql/text@1' }).build(),
          );
          return row;
        });

        expect({
          afterTrackingOff,
          afterProcedure,
          afterNames,
          afterStreamedZone,
          inTransaction,
        }).toEqual({
          afterTrackingOff: restored,
          afterProcedure: restored,
          afterNames: restored,
          afterStreamedZone: restored,
          inTransaction: { tz: '+00:00' },
        });
      },
    );
  });
});
