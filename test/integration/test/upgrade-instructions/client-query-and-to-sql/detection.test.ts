import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';

const GUIDE_PATHS = [
  'skills/prisma-8/upgrading/app/upgrades/8.0.0-rc.18-to-8.0.0-rc.19/instructions.md',
  'skills/prisma-8/upgrading/extension/upgrades/8.0.0-rc.18-to-8.0.0-rc.19/instructions.md',
];

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');

function detects(guidePath: string, content: string): boolean {
  const guide = readFileSync(join(repoRoot, guidePath), 'utf8');
  const entry = guide
    .split(/\n {2}- id: /)
    .find((block) => block.startsWith('client-query-and-to-sql\n'));
  if (entry === undefined) throw new Error(`${guidePath} has no change client-query-and-to-sql`);
  return [...entry.matchAll(/^ {8}- '(.*)'$/gm)]
    .map(([, pattern]) => new RegExp((pattern ?? '').replaceAll("''", "'")))
    .some((pattern) => pattern.test(content));
}

describe.each(GUIDE_PATHS)('the client-query-and-to-sql detection in %s', (guidePath) => {
  it.each([
    [
      'a Postgres client test double',
      "import type { PostgresClient } from '@prisma/orm-postgres/runtime';\nconst db: PostgresClient<Contract> = makeDb();",
    ],
    [
      'a serverless connection',
      "import { type PostgresServerlessConnection } from '@prisma/orm-postgres/serverless';",
    ],
    [
      'a SQLite client imported beside the default export',
      "import sqlite, {\n  type SqliteClient,\n} from '@prisma/orm-sqlite/runtime';",
    ],
    [
      'a role-bound client',
      "import type { RoleBoundDb } from '@prisma/orm-extension-supabase/runtime';",
    ],
    [
      'a transaction context',
      "import type { Foo, SqliteTransactionContext } from '@prisma/orm-sqlite/runtime';",
    ],
    ['a plan run through the runtime', 'await db.runtime().query(plan);'],
    ['a write run through the runtime', 'await db\n  .runtime()\n  .execute(plan);'],
    [
      'a renamed error detail in an expectation',
      "expect(error.details).toEqual({ planTarget: 'sqlite', runtimeTarget: 'postgres' });",
    ],
    ['a renamed error detail read', 'log(error.details.runtimeStorageHash);'],
    [
      'the old bind-site message',
      "expect(run).toThrow('Ad-hoc execute received a bind-site slot');",
    ],
    [
      'the old hash mismatch message',
      "expect(run).toThrow('Plan storage hash does not match runtime contract');",
    ],
  ])('finds %s', (_name, content) => {
    expect(detects(guidePath, content)).toBe(true);
  });

  it.each([
    ['a plan run on the client', 'await db.query(plan);'],
    ['a runtime connection', 'const connection = await db.runtime().connection();'],
    [
      'a longer name',
      "import type { MyPostgresClientHelper } from '@prisma/orm-postgres/runtime';",
    ],
    [
      'a type of the same name the project declares',
      'export interface PostgresClient {\n  query(sql: string): Promise<unknown>;\n}',
    ],
    [
      'a type of the same name from another package',
      "import type { PostgresClient } from './dev-emulators';",
    ],
    ['a variable named like a detail', "const runtimeTarget = { family: 'sql' };"],
    ['the new detail', "expect(error.details).toEqual({ contractTarget: 'postgres' });"],
  ])('skips %s', (_name, content) => {
    expect(detects(guidePath, content)).toBe(false);
  });
});
