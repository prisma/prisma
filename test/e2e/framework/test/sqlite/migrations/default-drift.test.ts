import { defineContract, field, model } from '@prisma/orm-sqlite/contract-builder';
import { describe, expect, it } from 'vitest';
import { applyMigration, int, integerColumn } from './harness';

/**
 * Regression for the integer `@default` drift loop.
 *
 * `parseSqliteDefault` used to return integer-affinity defaults as JS strings
 * (e.g. `'42'`) while contract literals authored with `.default(42)` are JS
 * `number`. The verifier's `literalValuesEqual` does no cross-type coercion,
 * so `42 === '42'` failed and the schema verify reported a default mismatch
 * on every plan — making real-world contracts effectively unmigratable.
 *
 * The fix mirrors `parsePostgresDefault`'s bigint handling: parse as JS
 * `number` when the value is in the safe-integer range, fall back to the raw
 * text only for SQLite's 64-bit integers that exceed JS's safe range.
 */
describe('SQLite Migration E2E - integer default drift', () => {
  it('verifies an integer `@default(42)` without drift', async () => {
    await applyMigration(
      {
        destination: defineContract({
          models: {
            Setting: model('Setting', {
              fields: {
                id: int.id(),
                priority: field.column(integerColumn).default(42),
              },
            }),
          },
        }),
      },
      async ({ driver }) => {
        await driver.query('INSERT INTO "Setting" (id) VALUES (?)', [1]);
        const rows = await driver.query<{ priority: number }>(
          'SELECT priority FROM "Setting" WHERE id = ?',
          [1],
        );
        expect(rows.rows[0]!.priority).toBe(42);
      },
    );
  });
});
