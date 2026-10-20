import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';

const GUIDE_PATH =
  'upgrade-instructions/pending/transaction-query-members/extension/instructions.md';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');

function detects(content: string): boolean {
  const guide = readFileSync(join(repoRoot, GUIDE_PATH), 'utf8');
  return [...guide.matchAll(/^ {8}- '(.*)'$/gm)]
    .map(([, pattern]) => new RegExp((pattern ?? '').replaceAll("''", "'")))
    .some((pattern) => pattern.test(content));
}

describe('the transaction-query-members detection', () => {
  it.each([
    [
      'a Postgres transaction context',
      'const tx: PostgresTransactionContext<Contract> = makeTx();',
    ],
    ['a role-bound client', 'function useDb(db: RoleBoundDb<Contract>) {}'],
    ['the SQLite ORM type', 'type Orm = SqliteOrm<Contract>;'],
    ['the Postgres query members', 'type M = PostgresQueryMembers<Contract>;'],
  ])('finds %s', (_name, content) => {
    expect(detects(content)).toBe(true);
  });

  it.each([
    ['the plain transaction context', 'function run(tx: TransactionContext) {}'],
    ['a longer name', 'type T = MyPostgresTransactionContextHelper;'],
  ])('skips %s', (_name, content) => {
    expect(detects(content)).toBe(false);
  });
});
