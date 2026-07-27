import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../_harness/postgres';
import type { Contract } from './_fixture/generated/contract';
import contractJson from './_fixture/generated/contract.json' with { type: 'json' };

// Port of prisma/prisma@a6d0155 packages/client/tests/functional/batching-bigint
// (postgres matrix entry; allProviders, ported postgres branch).
//
// Upstream verifies that Prisma Client correctly handles BigInt @unique values in
// concurrent queries. The `$transaction([...])` array-batch form has no prisma-next
// equivalent and remains non-ported.
//
// prisma-next int8 codec: input typed as `number` (test files are cast-exempt);
// pg driver returns int8 as string to avoid precision loss, so output assertions
// use the string form.
//
// Dispositions:
//   'findUnique bigint with Promise.all' → PORTED (passing)
//   'findUnique bigint with $transaction([...])' → non-ported (no array-batch surface)
//   'findFirst bigint with Promise.all' → PORTED (passing)
//   'findFirst bigint with $transaction([...])' → non-ported (no array-batch surface)

// Upstream uses BigInt literals; pg/int8@1 input is typed `number` — cast in test.
const bigint1 = BigInt('354789435768435687') as unknown as number;
const bigint2 = BigInt('873547358945943556') as unknown as number;
// pg returns int8 as string
const bigint1Str = '354789435768435687';
const bigint2Str = '873547358945943556';

function withBatchingBigint(fn: Parameters<typeof withPostgresPort<Contract>>[1]) {
  return withPostgresPort<Contract>({ contractJson }, fn);
}

describe('ports/prisma/functional/batching-bigint', () => {
  it(
    'findUnique bigint with Promise.all',
    () =>
      withBatchingBigint(async ({ db }) => {
        await db.public.Resource.createAll([
          { id: 'id1', bigint: bigint1 },
          { id: 'id2', bigint: bigint2 },
        ]);

        const [r1, r2] = await Promise.all([
          db.public.Resource.where({ bigint: bigint1 }).select('bigint').all(),
          db.public.Resource.where({ bigint: bigint2 }).select('bigint').all(),
        ]);

        expect([r1[0], r2[0]]).toMatchObject([{ bigint: bigint1Str }, { bigint: bigint2Str }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'findFirst bigint with Promise.all',
    () =>
      withBatchingBigint(async ({ db }) => {
        await db.public.Resource.createAll([
          { id: 'id1', bigint: bigint1 },
          { id: 'id2', bigint: bigint2 },
        ]);

        const [r1, r2] = await Promise.all([
          db.public.Resource.where({ bigint: bigint1 }).select('bigint').all(),
          db.public.Resource.where({ bigint: bigint2 }).select('bigint').all(),
        ]);

        expect([r1[0], r2[0]]).toMatchObject([{ bigint: bigint1Str }, { bigint: bigint2Str }]);
      }),
    timeouts.spinUpPpgDev,
  );
});
