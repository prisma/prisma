import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../_harness/postgres';
import type { Contract } from './_fixture/generated/contract';
import contractJson from './_fixture/generated/contract.json' with { type: 'json' };

// Port of prisma/prisma@a6d0155 packages/client/tests/functional/distinct
// (postgres matrix entry). Upstream seeds four users via copycat-randomised
// names and asserts only on result counts, so the port seeds the same
// distinctness structure with explicit values and asserts the same counts:
//   A: firstName=a lastName=x
//   B: firstName=a lastName=x   (full duplicate of A)
//   C: firstName=a lastName=y   (half duplicate)
//   D: firstName=b lastName=z
//
// Ported to distinctOn(...cols), since distinct(...cols) no longer exists.
// distinctOn requires a leading orderBy over the same columns, in the same
// order; every case below adds one. Every assertion here is a row count,
// which distinctOn preserves exactly like the old distinct(cols) did — the
// only thing an orderBy changes is which representative row survives per
// key, and none of these tests inspect which row that is.
const SEED = [
  { id: '1', firstName: 'a', lastName: 'x' },
  { id: '2', firstName: 'a', lastName: 'x' },
  { id: '3', firstName: 'a', lastName: 'y' },
  { id: '4', firstName: 'b', lastName: 'z' },
];

function withDistinct(fn: Parameters<typeof withPostgresPort<Contract>>[1]) {
  return withPostgresPort<Contract>(
    {
      contractJson,
    },
    async (ctx) => {
      await ctx.db.public.User.createAll(SEED);
      await fn(ctx);
    },
  );
}

describe('ports/prisma/functional/distinct', () => {
  it(
    'distinct on firstName',
    () =>
      withDistinct(async ({ db }) => {
        const result = await db.public.User.orderBy((u) => u.firstName.asc())
          .distinctOn('firstName')
          .all();
        expect(result.length).toBe(2);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'distinct on firstName and lastName',
    () =>
      withDistinct(async ({ db }) => {
        const result = await db.public.User.orderBy([
          (u) => u.firstName.asc(),
          (u) => u.lastName.asc(),
        ])
          .distinctOn('firstName', 'lastName')
          .all();
        expect(result.length).toBe(3);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'distinct on id',
    () =>
      withDistinct(async ({ db }) => {
        const result = await db.public.User.orderBy((u) => u.id.asc())
          .distinctOn('id')
          .all();
        expect(result.length).toBe(4);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'distinct on id and firstName',
    () =>
      withDistinct(async ({ db }) => {
        const result = await db.public.User.orderBy([(u) => u.id.asc(), (u) => u.firstName.asc()])
          .distinctOn('id', 'firstName')
          .all();
        expect(result.length).toBe(4);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'distinct on id and lastName',
    () =>
      withDistinct(async ({ db }) => {
        const result = await db.public.User.orderBy([(u) => u.id.asc(), (u) => u.lastName.asc()])
          .distinctOn('id', 'lastName')
          .all();
        expect(result.length).toBe(4);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'distinct on firstName and id',
    () =>
      withDistinct(async ({ db }) => {
        const result = await db.public.User.orderBy([(u) => u.firstName.asc(), (u) => u.id.asc()])
          .distinctOn('firstName', 'id')
          .all();
        expect(result.length).toBe(4);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'distinct on firstName and firstName',
    () =>
      withDistinct(async ({ db }) => {
        const result = await db.public.User.orderBy((u) => u.firstName.asc())
          .distinctOn('firstName', 'firstName')
          .all();
        expect(result.length).toBe(2);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'distinct on id and firstName and lastName',
    () =>
      withDistinct(async ({ db }) => {
        const result = await db.public.User.orderBy([
          (u) => u.id.asc(),
          (u) => u.firstName.asc(),
          (u) => u.lastName.asc(),
        ])
          .distinctOn('id', 'firstName', 'lastName')
          .all();
        expect(result.length).toBe(4);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'distinct on id shortcut',
    () =>
      withDistinct(async ({ db }) => {
        const result = await db.public.User.orderBy((u) => u.id.asc())
          .distinctOn('id')
          .all();
        expect(result.length).toBe(4);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'distinct on id and firstName shortcut',
    () =>
      withDistinct(async ({ db }) => {
        const result = await db.public.User.orderBy((u) => u.firstName.asc())
          .distinctOn('firstName')
          .all();
        expect(result.length).toBe(2);
      }),
    timeouts.spinUpPpgDev,
  );
});
