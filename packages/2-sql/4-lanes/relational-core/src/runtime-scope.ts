import type { RuntimeExecutor } from '@internal/framework-components/runtime';
import type { SqlQueryPlan } from './plan';
import type { SqlExecutionPlan } from './sql-execution-plan';

/**
 * The plan shape accepted by the SQL ORM client and SQL runtime: either a
 * pre-lowering `SqlQueryPlan` (AST + meta) or a post-lowering
 * `SqlExecutionPlan` (sql + params + meta).
 */
export type SqlOrmPlan = SqlExecutionPlan | SqlQueryPlan;

/**
 * The minimal SQL-runtime surface that the ORM client and SQL runtime both
 * depend on: the `execute` method of `RuntimeExecutor<SqlOrmPlan>`.
 *
 * Owned by `sql-relational-core` (lanes layer) so both
 * `@internal/sql-runtime` and `@internal/sql-orm-client` consume the
 * same source of truth without a layering inversion.
 */
export type RuntimeScope = Pick<RuntimeExecutor<SqlOrmPlan>, 'execute'>;
