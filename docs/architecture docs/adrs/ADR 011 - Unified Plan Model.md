# ADR 011 — Unified Plan model across lanes

## Context

We support multiple query authoring lanes: SQL DSL, ORM extension over the DSL, Raw SQL escape hatch, future TypedSQL CLI. To keep the runtime simple and safe, every lane must converge on a single execution contract: a Plan that the runtime can verify, lint, budget, and execute. Prior designs leaked lane-specific behavior into execution or required generated clients; we want one immutable object that captures everything needed for safety and observability.

## Decision

Define a Unified Plan model used by all lanes and runtimes:
- A Plan carries compiled sql and params plus lane-agnostic meta used for verification, guardrails, and diagnostics
- `ast` is optional for lanes that build a relational AST (DSL, ORM)
- `annotations` are optional metadata for lanes that do not provide an AST (Raw SQL, TypedSQL) to enable policy checks
- Plans are immutable by convention and enforced by tests and TypeScript types
- Plan identity and hashing are lane-agnostic and based on (sql, params, normalized meta) per ADR 013

## Plan shape

```typescript
export interface ExecutionPlan<Row = unknown, Ast = unknown> {
  // Optional dialect-agnostic AST when available
  ast?: Ast;

  // Always present
  sql: string;
  params: unknown[];

  meta: {
    target: 'postgres' | 'mysql' | 'sqlite';
    coreHash: string;
    profileHash?: string;
    lane: 'dsl' | 'orm' | 'raw-sql' | 'typed-sql';
    createdAt: string;

    // Optional structural hints for guardrails and DX
    refs?: { tables: string[]; columns: Array<{ table: string; column: string }> };
    projection?: Record<string, string>; // alias → table.column

    // Optional annotations for policy when AST is absent or incomplete
    annotations?: {
      intent?: 'read' | 'write' | 'admin';
      isMutation?: boolean;
      requiresWhereForMutation?: boolean;
      hasWhere?: boolean;
      hasLimit?: boolean;
      sensitivity?: 'none' | 'pii' | 'phi' | 'secrets';
      ownerTag?: string;
      budget?: { maxRows?: number; maxLatencyMs?: number };
      ext?: Record<string, unknown>;
    };

    // Optional codec info for param/row checks at boundaries
    codecs?: { params?: unknown; row?: unknown };
  };
}
```

For compatibility with existing code and documentation, `Plan<Row>` in the
implementation is a type alias for `ExecutionPlan<Row, unknown>`. New code
should prefer the more explicit `ExecutionPlan<Row, Ast>` form when referring
to the generic execution shape.

### Notes
- `coreHash` and `profileHash` reference the canonical contract.json per ADR 004 and ADR 010
- `lane` is informative and must not affect hashing or applicability checks
- `Row` is a TypeScript-only generic representing the inferred result type and is not serialized

### Immutability
- Plans are treated as immutable value objects
- The compiler and runtime never mutate a Plan after construction
- Plugins receive Plans as read-only and must return derived objects to change behavior
- Tests enforce immutability by freezing sample Plans and verifying no writes occur

### Lane responsibilities
- **SQL DSL and ORM**: provide ast, fill refs and projection deterministically during lowering
- **Raw SQL escape hatch**: omit ast, supply minimal annotations and, when possible, refs and projection
- **TypedSQL CLI**: emit factories that return Plans with coreHash stamped at emit time and optional refs/projection

### Runtime expectations
- Verify meta.coreHash against the active contract marker before execution
- Apply lint rules and budgets against ast when present, otherwise against annotations and refs
- Execute sql with params using the selected adapter and driver, returning immediately as `AsyncIterable<Row>`
- Stream rows incrementally, allowing plugins to observe per-row or aggregated results
- Enforce budgets dynamically during iteration and can terminate streaming early on violation
- Record timing, row count, and violations in a standard envelope keyed by Plan identity
- Never rely on lane to determine safety behavior; all lanes execute with identical streaming semantics

### Hashing and identity
- Plan identity and change detection are defined in ADR 013
- Hashing excludes volatile fields and lane, focuses on sql, params, and normalized structural metadata
- Used for golden tests, CI drift detection, and runtime telemetry keys

### Canonicalization and determinism
- Plans originate from a canonical contract.json emitted per ADR 010
- Lowering must be deterministic given the same contract, inputs, and adapter version
- Golden SQL tests guard against nondeterministic rendering

## Alternatives considered

### Per-lane plan models
- Increases complexity in the runtime and plugins and makes safety uneven

### Forcing a full AST for all lanes by parsing SQL
- Heavy, brittle across dialects, and unnecessary for safety if annotations exist

### Embedding generated clients per schema
- Reintroduces rebuild cost and opaque behavior that agents cannot inspect

## Consequences

### Positive
- One execution and verification pipeline regardless of authoring lane
- Clear extension point for community lanes and alternate runtimes
- Strong compatibility with agent workflows that only need to produce a Plan
- Easier testing via golden Plans and stable hashing

### Trade-offs
- Raw SQL lanes must provide annotations to get full safety guarantees
- Some advanced guardrails are less precise without an AST, which is acceptable for escape hatches

## Scope and non-goals

### In scope for MVP
- Implement the Plan interface and freeze semantics
- Update DSL compiler and runtime to produce and consume Plans
- Add raw escape hatch helpers that construct annotated Plans
- Basic guardrails working with both AST-backed and annotated Plans

### Out of scope for MVP
- Full SQL parsing to backfill AST for raw Plans
- Cross-process Plan serialization guarantees beyond JSON structures

## Backwards compatibility and migration
- Existing prototype Plans can adapt by adding lane and annotations where needed
- No breaking changes to the contract or compiler required
- Plugins written against earlier prototypes will continue to work if they only read sql and params

## Testing strategy
- Golden tests for Plan construction per lane with stable hashing
- Freeze checks to enforce immutability and plugin non-mutation
- Runtime integration tests ensuring identical guardrail outcomes for equivalent DSL and raw Plans
- Contract mismatch tests that fail fast on coreHash differences

## Open questions
- Minimum required annotation set for raw Plans in MVP
- Whether to standardize projection keys beyond alias → fully qualified column
- How to represent admin DDL Plans in the same model without overloading intent

## Decision record
Adopt a single, immutable Plan model across all lanes with optional ast and annotations. Make runtime verification, guardrails, and execution depend only on the Plan contract and the data contract, not on lane-specific behavior. Define hashing and identity in ADR 013 to keep change detection lane-agnostic.
