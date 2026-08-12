import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../_harness/postgres';
import type { Contract } from './_fixture/generated/contract';
import contractJson from './_fixture/generated/contract.json' with { type: 'json' };

// Port of prisma/prisma@a6d0155 packages/client/tests/functional/issues/18970-invalid-date
// (postgres matrix entry).
//
// Subject: querying with an invalid Date object (`new Date('Invalid Date')`)
// should throw rather than silently pass or produce garbage.
//
// API-shape translation:
//   `prisma.user.findMany({ where: { date: new Date('I am not a date') } })`
//   → `db.public.User.where((u) => u.date.eq(new Date('Invalid Date'))).all()`
//
// Upstream asserts a Prisma-specific error snapshot (P2009 / "Invalid value for
// argument `date`"). prisma-next does not emit Prisma error codes; the faithful
// assertion is that the promise rejects with any error when an invalid Date is used.

function withIssue18970(fn: Parameters<typeof withPostgresPort<Contract>>[1]) {
  return withPostgresPort<Contract>({ contractJson }, fn);
}

describe('ports/prisma/functional/issues-18970-invalid-date', () => {
  it(
    'throws on invalid date (json)',
    () =>
      withIssue18970(async ({ db }) => {
        await expect(
          db.public.User.where((u) => u.date.eq(new Date('I am not a date'))).all(),
        ).rejects.toThrow();
      }),
    timeouts.spinUpPpgDev,
  );
});
