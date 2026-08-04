import type { PlanMeta } from '@internal/contract/types';

/**
 * Family-agnostic plan marker.
 *
 * Carries only `meta` (the family-agnostic plan metadata) and the optional
 * phantom `_row` parameter that lets type-level utilities recover the row
 * type from a plan value. SQL and Mongo extend this marker with their own
 * concrete shapes (`SqlQueryPlan`, `MongoQueryPlan`).
 *
 * `QueryPlan` is the *pre-lowering* marker — i.e. the surface a builder
 * produces before family-specific lowering turns it into an executable
 * plan (`ExecutionPlan`).
 */
export interface QueryPlan<Row = unknown> {
  readonly meta: PlanMeta;
  /**
   * Phantom property to carry the Row generic for type-level utilities.
   * Not set at runtime; used only for `ResultType` extraction.
   */
  readonly _row?: Row;
}

/**
 * Family-agnostic execution-plan marker.
 *
 * Extends `QueryPlan` with no additional structural fields — the marker
 * exists to nominally distinguish executable plans from pre-lowering plans
 * in the type system. Family-specific execution plans (`SqlExecutionPlan`,
 * `MongoExecutionPlan`) extend this marker with their concrete shapes
 * (e.g. `sql + params` for SQL, `wireCommand` for Mongo).
 */
export interface ExecutionPlan<Row = unknown> extends QueryPlan<Row> {}

/**
 * Extracts the `Row` type from a plan via the phantom `_row` property.
 *
 * Works with any plan that extends `QueryPlan<Row>` — including
 * `ExecutionPlan<Row>`, `SqlQueryPlan<Row>`, `SqlExecutionPlan<Row>`,
 * `MongoQueryPlan<Row>`, and `MongoExecutionPlan<Row>`.
 *
 * The `_row` property must be present in the plan's static type for the
 * conditional to bind `R`; objects whose type lacks `_row` resolve to
 * `never`. Without the `keyof` guard, `extends { _row?: infer R }` would
 * silently match any object and infer `unknown`.
 *
 * Example: `type Row = ResultType<typeof plan>`.
 */
export type ResultType<P> = '_row' extends keyof P
  ? P extends { readonly _row?: infer R }
    ? R
    : never
  : never;
