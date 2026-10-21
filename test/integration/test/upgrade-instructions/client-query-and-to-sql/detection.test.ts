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
    ['a Postgres client test double', 'const db: PostgresClient<Contract> = makeDb();'],
    ['a serverless connection', 'function handle(db: PostgresServerlessConnection<Contract>) {}'],
    ['a SQLite client', 'type Db = SqliteClient<Contract>;'],
    ['a role-bound client', 'function useDb(db: RoleBoundDb<Contract>) {}'],
    ['a static context', 'type S = PostgresStaticContext<Contract>;'],
    ['a transaction context', 'const tx: SqliteTransactionContext<Contract> = makeTx();'],
    ['the Supabase-contract client', 'function admin(db: SupabaseInternalDb) {}'],
    ['a plan run through the runtime', 'await db.runtime().query(plan);'],
    ['a write run through the runtime', 'await db\n  .runtime()\n  .execute(plan);'],
  ])('finds %s', (_name, content) => {
    expect(detects(guidePath, content)).toBe(true);
  });

  it.each([
    ['a plan run on the client', 'await db.query(plan);'],
    ['a runtime connection', 'const connection = await db.runtime().connection();'],
    ['a longer name', 'type T = MyPostgresClientHelper;'],
  ])('skips %s', (_name, content) => {
    expect(detects(guidePath, content)).toBe(false);
  });
});
