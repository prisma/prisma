import type { SchemaDiffIssue } from './schema-diff';

/**
 * Framework SPI for verifying that an introspected schema matches the
 * contract that authored it. The implementer walks the target's IR
 * natively — concrete classes, target-only kinds — and reports issues.
 *
 * The framework verifier (per FR6) walks the contract-space aggregate,
 * dispatches to the right target's verifier (`descriptor.schemaVerifier`)
 * per space, and wraps the per-target results into a unified
 * `VerifyDatabaseSchemaResult` with timings, summary, and the issue list.
 *
 * Family-level abstract bases (e.g. `SqlSchemaVerifierBase`) carry the
 * shared SQL/Mongo walk logic and expose protected hooks for target
 * extensions; concrete target verifiers (`PostgresSchemaVerifier extends
 * SqlSchemaVerifierBase`) own the dispatch on target-specific kinds.
 */
export interface SchemaVerifier<TContract, TSchema> {
  verifySchema(options: SchemaVerifyOptions<TContract, TSchema>): SchemaVerifyResult;
}

/**
 * Minimal per-target verifier input. Family abstract bases extend this
 * shape with family-specific options (`strict`, `frameworkComponents`,
 * codec hooks, …) — the framework SPI itself stays at the contract +
 * schema pair every implementer needs.
 */
export interface SchemaVerifyOptions<TContract, TSchema> {
  readonly contract: TContract;
  readonly schema: TSchema;
}

/**
 * Per-target verifier result. The framework verifier wraps these into the
 * existing `VerifyDatabaseSchemaResult` envelope (with timings, summary,
 * issue list); the SPI itself returns just the core ok/issues pair so the
 * seam between target-walk and framework-aggregation is explicit.
 */
export interface SchemaVerifyResult {
  readonly ok: boolean;
  readonly issues: readonly SchemaDiffIssue[];
}
