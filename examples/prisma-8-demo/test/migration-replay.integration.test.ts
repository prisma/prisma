/**
 * Replay proof: executing the shipped app migration chain from scratch lands
 * a database whose live schema matches the current contract.
 *
 * The chain is a multi-step incremental history that exercises the migration
 * CLI's apply-successive-migrations path. The initial migration creates
 * `user.kind` as a `text` column with a `user_kind_check` CHECK constraint —
 * the domain-enum representation — from the start; no native Postgres enum type
 * is ever created. Later migrations add `displayName`, the MTI variant link
 * columns, and the `post.priority` value-set column with its default. This test
 * replays every execute step in chain order against a fresh dev database, then
 * introspects and verifies against the contract.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pgvectorPack from '@prisma/orm-extension-pgvector/control';
import { createPostgresControlClient } from '@prisma/orm-postgres/control';
import { timeouts, withClient, withDevDatabase } from '@repo/test-utils';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';
import contractJson from '../src/prisma/contract.json' with { type: 'json' };

const DEMO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP_MIGRATIONS_DIR = join(DEMO_ROOT, 'migrations', 'app');

interface OpsJsonStep {
  readonly sql: string;
  readonly params?: readonly unknown[];
}

interface OpsJsonOperation {
  readonly id: string;
  readonly execute: readonly OpsJsonStep[];
}

function loadChainInOrder(): ReadonlyArray<{
  dirName: string;
  ops: readonly OpsJsonOperation[];
}> {
  return readdirSync(APP_MIGRATIONS_DIR)
    .filter((d) => !d.startsWith('.'))
    .sort()
    .map((dirName) => ({
      dirName,
      ops: JSON.parse(
        readFileSync(join(APP_MIGRATIONS_DIR, dirName, 'ops.json'), 'utf-8'),
      ) as readonly OpsJsonOperation[],
    }));
}

describe('demo migration replay (dev database)', () => {
  it(
    'replaying the full chain produces a schema that verifies against the contract',
    async () => {
      await withDevDatabase(async ({ connectionString }) => {
        await withClient(connectionString, async (client) => {
          for (const { dirName, ops } of loadChainInOrder()) {
            for (const op of ops) {
              for (const step of op.execute) {
                try {
                  await client.query(step.sql, [...(step.params ?? [])]);
                } catch (error) {
                  throw new Error(
                    `replay failed at ${dirName} / ${op.id}: ${(error as Error).message}\n${step.sql}`,
                  );
                }
              }
            }
          }

          // `kind` is a text column with a CHECK constraint — never a native enum.
          const kindType = await client.query<{ udt_name: string }>(
            `SELECT udt_name FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'kind'`,
          );
          expect(kindType.rows).toEqual([{ udt_name: 'text' }]);

          const nativeEnums = await client.query<{ typname: string }>(
            `SELECT t.typname FROM pg_type t
             JOIN pg_namespace n ON n.oid = t.typnamespace
             WHERE t.typtype = 'e' AND n.nspname = 'public'`,
          );
          expect(nativeEnums.rows).toEqual([]);

          const check = await client.query<{ def: string }>(
            `SELECT pg_get_constraintdef(c.oid) AS def
             FROM pg_constraint c
             JOIN pg_class t ON t.oid = c.conrelid
             JOIN pg_namespace n ON n.oid = t.relnamespace
             WHERE n.nspname = 'public' AND t.relname = 'user'
               AND c.conname = 'user_kind_check_836d43ef' AND c.contype = 'c'`,
          );
          expect(check.rows).toHaveLength(1);
          expect(check.rows[0]?.def).toContain('admin');
          expect(check.rows[0]?.def).toContain('user');
        });

        // Full schema verification against the current contract.
        const controlClient = createPostgresControlClient({
          connection: connectionString,
          extensions: [pgvectorPack],
        });
        try {
          const verifyResult = await controlClient.schemaVerify({
            contract: contractJson,
            strict: false,
          });
          expect(verifyResult.schema.issues).toEqual([]);
          expect(verifyResult.ok).toBe(true);
        } finally {
          await controlClient.close();
        }
      }, {});
    },
    timeouts.spinUpPpgDev,
  );
});
