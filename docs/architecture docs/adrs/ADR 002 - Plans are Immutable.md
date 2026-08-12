# ADR 002 — Plans are Immutable

## Context

We compile both queries and migrations into Plans. Plans are consumed by the runtime, verified against the data contract, linted, budgeted, and then executed. To enable verification, caching, auditing, and agent interoperability, a Plan must be a stable, hashable value. Mutable plans make audit trails unreliable, complicate plugin behavior, and break deterministic CI checks.

## Decision

Plans are immutable value objects once constructed:
- A Plan carries ast, sql, params, and meta including coreHash and stable references
- `build()` returns a frozen Plan
- Any transformation produces a new Plan rather than mutating the existing one
- Plugin hooks cannot mutate Plans in place
- Diagnostics, metrics, and annotations are stored out-of-band keyed by planId or planHash

Plan hashing is canonical and excludes non-semantic fields:
- The plan hash includes AST, SQL, params, and semantic metadata
- Ephemeral fields like timing, row counts, and connection info are excluded
- Canonicalization rules ensure identical hashes across platforms

## Details

### Plan shape (conceptual)
- `ast`: typed AST for the lane (relational, typed SQL, migration ops)
- `sql|ops`: compiled statement or ordered operations for migrations
- `params`: positional or named parameters
- `meta`: { coreHash, target, refs { tables, columns }, compilerVersion, planVersion }
- `id`: stable UUIDv7 assigned at creation for join keys in logs and telemetry

### Immutability enforcement
- Objects are frozen at boundary creation (Object.freeze)
- Deep immutability for nested structures used by hooks
- Runtime throws if a plugin attempts mutation during hooks

### Derivation and transforms
- Lints and budgets observe Plans and may reject or wrap by producing a new Plan with explicit changes
- Preflight may emit a diagnostic record stored separately from the Plan and referenced by planId
- Migrations re-plan by producing a new edge Plan rather than editing an existing one

### Caching and reproducibility
- Execution caches keyed by { planHash, coreHash, role, env }
- Golden tests snapshot AST → SQL and plan hashes to detect unintended compiler changes
- CI change detection flags unexpected planHash drift in the same code revision

### Plugin model
- Hooks receive a read-only Plan and may return either the same Plan or a new Plan
- Annotations are emitted via a side channel emitDiagnostic(planId, payload)
- Telemetry attaches metrics to planId and persists separately

### Serialization
- Plans serialize to canonical JSON for hashing and artifact upload
- planVersion guards format evolution
- Redaction rules apply when serializing diagnostics

## Alternatives considered

### Mutable plans with defensive copies
- Simpler to start but easy to mutate accidentally and hard to audit
- Complicates plugin ordering and makes caching ambiguous

### SQL strings without AST or Plan wrapper
- Lightweight but loses verification, linting, and stable hashing
- Not agent-friendly and limits PPg preflight

### Mutable plans with internal version counters
- Adds complexity and still weakens determinism and caching semantics

## Consequences

### Positive
- Deterministic verification and caching keyed by plan hash
- Clean audit trail and reproducible CI checks
- Safer plugin ecosystem with clear input/output semantics
- Easier agent workflows due to stable, serializable artifacts

### Trade-offs
- Slight overhead for freezing and copy-on-write transforms
- More explicit API surface for transforms instead of in-place edits
- Diagnostics must be handled via side channels, not by mutating the Plan

## Scope and non-goals

### In scope for MVP
- Immutable Plans for query and migration lanes
- Canonical serialization and hashing
- Plugin API returning new Plans on modification

### Out of scope for MVP
- Cross-process Plan cache store and eviction policies
- Signed Plans and tamper-evident logs
- Plan diffing UX beyond golden tests

## Backwards compatibility and migration

### From the current ORM
- Introduce a lightweight wrapper that turns $queryRaw and TypedSQL into Plan factories
- Gradually move runtime features to operate on Plans while maintaining raw SQL escape hatches

## Open questions
- Exact redaction policy for serialized Plans in CI logs
- Whether to include optimizer hints in the Plan hash when they are non-semantic
- Param canonicalization for large arrays and JSON values
- Plan size limits and chunking for very large migration opsets

## Decision record

We adopt immutable Plans for both queries and migrations. Plans are frozen at creation, hashed deterministically, transformed by producing new Plans, and annotated via side channels keyed by planId or planHash. This enables reliable verification, caching, auditing, and a safe plugin ecosystem suitable for human and agent workflows.
