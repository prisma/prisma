import type { Runtime } from '@prisma/orm-postgres/family-runtime';
import { enums, sql } from './context';

/**
 * Reads posts ordered by their `Priority` enum column. The enum's declaration
 * order (low -> high -> urgent) drives the sort, not lexical order, so the feed
 * surfaces the lowest-priority posts first.
 */
export async function getPostsByPriority(runtime: Runtime) {
  const rows = await runtime.execute(
    sql.post.select('id', 'title', 'priority').orderBy('priority').orderBy('id').build(),
  );
  return rows;
}

/**
 * Returns the declaration-ordered runtime surface for the `Priority` enum via
 * the `db.enums` facade member (`enums.public.Priority`), demonstrating that
 * the value tuple and helpers are reachable as lane-agnostic contract metadata.
 */
export function getPriorityEnum() {
  // The no-emit contract types its domain namespaces loosely (index
  // signature), so `enums['public']` is reached with bracket access and a
  // runtime guard rather than a cast — the same shape `createOrmClient` uses.
  const publicEnums = enums['public'];
  if (publicEnums === undefined) {
    throw new Error("Contract is missing the 'public' namespace enums");
  }
  return publicEnums.Priority;
}
