import { budgets, lints } from '@prisma/orm-postgres/family-runtime';
import postgresServerless from '@prisma/orm-postgres/serverless';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

/**
 * Module-scope client. Constructing once per isolate is correct: only the static
 * authoring surface (`sql`, `context`, `stack`, `contract`) is closure-cached.
 * The per-request runtime is acquired inside `fetch` via `db.connect({ url })`.
 */
function createMiddleware() {
  return [
    lints(),
    budgets({
      maxRows: 10_000,
      defaultTableRows: 10_000,
      tableRows: { user: 10_000, post: 10_000 },
      maxLatencyMs: 5_000,
    }),
  ];
}

export const db = postgresServerless<Contract>({
  contractJson,
  middleware: createMiddleware(),
});

// Transaction routes buffer DML so each statement settles before the callback commits or rolls back.
export const transactionalDb = postgresServerless<Contract>({
  contractJson,
  cursor: { disabled: true },
  middleware: createMiddleware(),
});
