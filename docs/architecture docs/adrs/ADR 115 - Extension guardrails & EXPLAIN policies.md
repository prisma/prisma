# ADR 115 — Extension guardrails & EXPLAIN policies

## Context

Target extensions like pgvector and PostGIS unlock powerful queries but can be easy to misuse, leading to slow sequential scans, incorrect distance computations, or unstable plans. Because agents and humans will both author queries, we need guardrails that are:

- Extension-aware and capability-gated
- Deterministic and lane-agnostic across the query builder, raw SQL lane, and TypedSQL
- Enforceable in development and CI preflight, with safe fallbacks in production

ADR 022 and ADR 023 defined generic lint and EXPLAIN budgeting. This ADR specializes those for extension workloads and codifies how packs surface rules and how the runtime decides when to require EXPLAIN, index checks, and parameter validation.

## Problem

- Extension queries often rely on specific operators, indexes, or parameter shapes to be safe
- Plans can silently regress when indexes are missing or when dimensions/SRID mismatch
- EXPLAIN needs to be applied selectively to extension-heavy Plans without adding production overhead
- Guardrails must be consistent across lanes and environments

## Decision

Introduce an extension-aware guardrail layer and EXPLAIN policy that is driven by:

1. **Contract + capabilities**: extensions declared in the contract and negotiated via adapter capabilities
2. **Plan annotations**: operators/functions referenced, referenced columns, and extension metadata contributed by packs per ADR 113
3. **Target Extension Packs**: each pack ships a small ruleset and EXPLAIN policy hints for its types and operators
4. **Mode-aware enforcement**: stricter in preflight, non-intrusive in production

### Goals

- Catch high-risk extension misuses early with clear diagnostics
- Require EXPLAIN in CI for extension Plans that exceed configurable risk thresholds
- Keep runtime overhead under a fixed budget with fingerprinted caching
- Make behavior consistent regardless of query lane

### Non-goals

- Parsing SQL generically in core
- Autotuning database settings or creating indexes implicitly

## Scope

- Postgres v1 with pgvector and PostGIS packs
- Applies to relational lanes and TypedSQL plans with extension annotations
- Production runtime runs static checks only by default and never runs EXPLAIN ANALYZE on live traffic

## Model

### Capability and contract gating

- At connect time, the adapter and packs negotiate a capability profile per ADR 065
- A Plan that references an extension operator or type must pass both gates:
  - Extension declared in contract
  - Adapter advertises the capability, optionally version-pinned
- Violations yield `E_EXT_CAPABILITY_MISSING` with actionable remediation

### Plan annotations

Packs attach normalized annotations to Plans per ADR 018 and ADR 113:

- `ext.refs`: array of `{ typeId, table, column, attrs }`
- `ext.ops`: array of `{ opId, kind: 'function' | 'operator', args: [...], hints: {...} }`
- `ext.hints`: pack-specific hints such as dim, srid, metric
- `ext.risk`: optional quick heuristic score contributed by the pack

These annotations are lane-agnostic and produced at build time by the compiler or the TypedSQL CLI.

### Guardrail categories

1. **Static preconditions**
   - Operator requires a supporting index on column
   - Parameter dimensionality/SRID must match column attributes
   - KNN or nearest-N queries must include `ORDER BY <op>` and a `LIMIT`
   - Disallow sequential scan on extension columns over a configured row threshold unless explicitly allowed

2. **Heuristic checks**
   - Estimated row count or selectivity thresholds when available from Plan metadata
   - Join shape checks that commonly explode with extension filters

3. **EXPLAIN policy triggers**
   - Any Plan using certain operators must be EXPLAINed in preflight unless explicitly waived
   - If a static check passes but risk score exceeds a threshold, require EXPLAIN

### EXPLAIN policy

- **Where**: preflight only by default, using shadow DB or EXPLAIN-only mode per ADR 029
- **What**: `EXPLAIN (FORMAT JSON, COSTS, BUFFERS, TIMING)` by default, no ANALYZE on production databases
- **Caching**: keyed by `sqlFingerprint + coreHash + adapterProfile + extVersionSet` with TTL and size limits per ADR 023
- **Budget evaluation**: extension packs can add interpretation hooks to derive meaningful signals from EXPLAIN JSON
  - pgvector: index used, rows, actual_rows in shadow, scan method, recheck ratio
  - PostGIS: spatial index used, filter selectivity, recheck ratio

If EXPLAIN cannot run, policy falls back to static checks and marks result as incomplete with warn or error depending on config.

## Initial rule catalog

Rules are namespaced and follow ADR 022 taxonomy:

### pgvector

- **ext.pgvector.limit-required**: KNN queries must include `ORDER BY <->` and `LIMIT`
- **ext.pgvector.index-required**: Distance operator on a vector column requires a matching vector index
- **ext.pgvector.dim-mismatch**: Parameter dimension must match column dim
- **ext.pgvector.no-seqscan-threshold**: Disallow sequential scans over N rows when using distance filters
- **ext.pgvector.metric-mismatch**: Query metric must match index metric unless explicitly allowed

### PostGIS

- **ext.postgis.index-required**: Spatial predicate requires a usable spatial index unless table is under threshold
- **ext.postgis.srid-mismatch**: SRID of parameter geometry/geography must match column SRID or be transformed
- **ext.postgis.recheck-ratio**: Recheck ratio exceeds threshold, advise index or query rewrite
- **ext.postgis.geom-type-mismatch**: Incompatible geometry types for predicate

Each rule has `level: off | warn | error` with defaults provided by the pack and overridable by user config.

## Configuration

```typescript
createRuntime({
  ir: contract,
  driver,
  plugins: [
    guardrails({
      rules: {
        'ext.pgvector.limit-required': 'error',
        'ext.pgvector.index-required': 'error',
        'ext.postgis.index-required': 'warn'
      },
      budgets: {
        explain: { enabledIn: ['preflight'], maxTimeMs: 2000 },
        rows: { warnAt: 50_000, errorAt: 200_000 }
      },
      thresholds: {
        seqScanRowThreshold: 10_000,
        recheckWarn: 0.2,
        recheckError: 0.5
      }
    })
  ]
})
```

- Defaults come from packs, merged with user config
- Production default skips EXPLAIN and enforces static checks only
- CI preflight enables EXPLAIN per ADR 023 and ADR 029

## Error semantics

New stable codes extend ADR 027 and ADR 068:

- **E_EXT_CAPABILITY_MISSING**: extension type/operator requires capability not present
- **E_EXT_INDEX_REQUIRED**: operator used without a usable supporting index
- **E_EXT_PARAM_MISMATCH**: parameter does not satisfy extension constraints
- **E_EXT_EXPLAIN_REQUIRED**: policy requires EXPLAIN but environment disallows
- **E_EXT_EXPLAIN_BUDGET_EXCEEDED**: EXPLAIN exceeded time or size budget
- **E_EXT_PLAN_RISK_TOO_HIGH**: risk score exceeded configured threshold

Violations include `ruleId`, severity, advice, and refs to tables/columns and operator signatures.

## Performance

- Static checks operate on Plan annotations and contract lookups in O(k) where k is number of referenced extension columns
- EXPLAIN is gated by budgets and caching
- No SQL parsing in core; packs provide operator signatures and detection during compilation

## Testing

- Conformance suite includes fixtures for each rule with positive and negative cases
- Golden EXPLAIN snapshots for representative queries in shadow mode
- Adapter-profile matrix runs to validate capability gating and error mapping

## Alternatives considered

- **Enforce EXPLAIN for all queries using extensions**
  - Rejected due to production overhead and noise in CI
- **Rely only on EXPLAIN without static checks**
  - Rejected because many errors are catchable earlier and deterministically
- **Auto-create indexes as part of preflight**
  - Rejected for now to keep separation of concerns and avoid surprises

## Consequences

### Positive

- Safer use of extensions with clear, actionable diagnostics
- Consistent cross-lane and cross-environment behavior
- Predictable production overhead with CI catching regressions

### Negative

- Packs must maintain rule metadata and operator catalogs
- Some false positives are likely until rules are tuned
- EXPLAIN availability varies by environment and requires shadow in CI for best results

## Open questions

- Should packs be able to add parameter builders that embed validated metadata into Plans to reduce false positives
- Do we want an opt-in production sampling mode that runs EXPLAIN on a small percentage of extension Plans against a shadow follower
- How do we surface compact but useful advice for agents to auto-fix violations

## Implementation notes

- Packs export guardrails modules that declare rule metadata, detection hooks, and EXPLAIN interpreters
- The runtime merges all pack rules into the global lint registry at connect time
- Plan hashing ignores guardrail configuration to avoid churn, but includes a boolean flag that the Plan contains extension usage for policy routing
