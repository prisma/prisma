import { field } from '@prisma/orm-postgres/contract-builder';
import type { CodecField } from '@prisma/orm-postgres/orm-client';
import type { Contract } from '../prisma/contract.d';
import { db } from '../prisma/db';

type CreatedAt = CodecField<Contract, 'pg/timestamptz-temporal@1'>;

/**
 * A scope for any model with a `createdAt` timestamp, such as `User`, `Post` and `Task`: rows created since `since`.
 */
export function createdSince(since: Temporal.Instant) {
  return db.orm.fragment({ createdAt: field.temporal.timestamptz() }, (rows) =>
    rows.where((row) => row.createdAt.gte(since)),
  );
}

/**
 * A filter for any model with a `createdAt` timestamp, run with `where`: rows created before `until`.
 */
export function createdBefore(until: Temporal.Instant) {
  return (row: { createdAt: CreatedAt }) => row.createdAt.lt(until);
}

/**
 * A scope for any model with a `userId`, such as `Post` and `Task`: rows that belong to one user.
 */
export function ownedBy(userId: string) {
  return db.orm.fragment({ userId: field.uuidNative() }, (rows) =>
    rows.where((row) => row.userId.eq(userId)),
  );
}

/**
 * The fields of a post that a list of posts shows, run with `with` on any collection of posts.
 */
export const postSummary = db.orm.public.Post.fragment((posts) =>
  posts.select('id', 'title', 'createdAt').include('tags'),
);
