/**
 * A local extension that contributes one aggregate operation.
 *
 * The aggregate vocabulary is a contribution, not a fixed list: `count`,
 * `sum`, `avg`, `min`, `max` and their lossless variants exist because the
 * PostgreSQL target declares them. Anything else a component declares reaches
 * the same surfaces under its own name — `aggregate()`, `groupBy().aggregate()`
 * and the include reducers all read their method set from the contract's
 * aggregate map, so contributing `stddev` here is the whole of the work. No
 * change to the ORM client or the query lane is involved.
 *
 * The descriptor is listed on both planes: the control descriptor goes in
 * `prisma.config.ts`, so `contract emit` writes `stddev` into the emitted
 * types, and the runtime descriptor goes in `src/prisma/db.ts`, so the registry
 * can resolve it when a query asks for it. Listing only one of the two gives
 * you a method the types promise and the runtime cannot answer.
 *
 * @see docs/reference/aggregate-descriptor-guide.md
 */

import type { SqlControlExtensionDescriptor } from '@prisma/orm-postgres/family/control';
import type { SqlRuntimeExtensionDescriptor } from '@prisma/orm-postgres/family-runtime';
import type { SqlAggregateDescriptor } from '@prisma/orm-postgres/relational-core/aggregate-descriptor-registry';
import { CastExpr, FunctionCallExpr } from '@prisma/orm-postgres/relational-core/ast';

const EXTENSION_ID = 'demo/engagement-stats';
const EXTENSION_VERSION = '0.0.1';

/**
 * Sample standard deviation over any numeric column — how unevenly engagement
 * is spread across posts.
 *
 * `stddev` is not one of the five names the SQL aggregate alphabet knows, so
 * the descriptor has to say how the expression is built. The hook names
 * PostgreSQL's `stddev_samp` and casts its result, which is what makes the
 * declared output codec true: `stddev_samp` answers in `numeric` over integer
 * and `numeric` inputs but in `float8` over a float column, and the trait match
 * admits all of them. Casting the result — rather than the input — keeps the
 * database's own accumulation and rounds once at the end.
 *
 * Being outside the alphabet also makes the operation projection-only: it can
 * name a result key, but not appear in `having(...)` or an ORDER BY, where the
 * comparison would happen inside the database and the rendering would change
 * what it means.
 */
const standardDeviation: SqlAggregateDescriptor = {
  operation: 'stddev',
  input: { kind: 'trait', trait: 'numeric' },
  output: { kind: 'codec', codecId: 'pg/numeric@1' },
  // `stddev_samp` needs two rows to have an answer, and returns NULL below that.
  nullable: true,
  lower: ({ expr }) =>
    CastExpr.as(
      // A trait input match only resolves for a call that carries a field, so
      // `expr` is always present here; the empty-argument branch is the shape
      // the hook signature admits for operations that take no input at all.
      FunctionCallExpr.of('stddev_samp', expr === undefined ? [] : [expr]),
      'numeric',
    ),
};

const aggregateDescriptors: readonly SqlAggregateDescriptor[] = [standardDeviation];

/** Composed into `prisma.config.ts` so `contract emit` types the operation. */
export const engagementStatsControl: SqlControlExtensionDescriptor<'postgres'> = {
  kind: 'extension',
  id: EXTENSION_ID,
  version: EXTENSION_VERSION,
  familyId: 'sql',
  targetId: 'postgres',
  types: { aggregateDescriptors },
  create: () => ({ familyId: 'sql', targetId: 'postgres' }),
};

/** Composed into `src/prisma/db.ts` so the runtime registry can resolve the operation. */
export const engagementStatsRuntime: SqlRuntimeExtensionDescriptor<'postgres'> = {
  kind: 'extension',
  id: EXTENSION_ID,
  version: EXTENSION_VERSION,
  familyId: 'sql',
  targetId: 'postgres',
  types: { aggregateDescriptors },
  codecs: () => [],
  create: () => ({ familyId: 'sql', targetId: 'postgres' }),
};
