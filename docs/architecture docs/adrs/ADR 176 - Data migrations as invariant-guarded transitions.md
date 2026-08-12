# ADR 176 — Data migrations as invariant-guarded transitions

> **Refined by [ADR 208 — Invariant-aware migration routing](ADR%20208%20-%20Invariant-aware%20migration%20routing.md).** ADR 208 records how the model described here is implemented and resolves the open questions below. The conceptual model in this ADR remains accurate.

## At a glance

A data migration is a guarded transition: it has a precondition (the data needs changing), an execution step, and a postcondition (a **data invariant** that proves the work is done). "Desired state" for a database is not just a contract hash — it is the target contract hash plus the set of required data invariants that must hold.

```
Desired state = target contract hash + required data invariants {I₁, I₂, …}
```

If the postcondition already holds, the migration is a no-op — that's the idempotence story. This decouples correctness from a single canonical migration history.

## Context

The migration system's structural routing model works well for schema state: "reach contract hash H." Structural migrations move the database from one schema to another, and the contract hash captures the target.

But once data transformations enter the picture, two databases can share the same schema (same contract hash) while having meaningfully different content. "Schema state matches" does not imply "data state is correct." This is exactly why teams fall back to golden-history thinking — a single linear sequence is a crude way of saying "we know these data transformations happened."

We need a model that says that directly, without abandoning the graph-based routing model that makes structural migrations flexible.

## Problem

How should the migration system represent and verify data migrations, given that:

1. Data correctness is not captured by the contract hash
2. The system should not require a single canonical migration history (golden history)
3. Data migrations have schema dependencies (they need specific tables/columns to exist)
4. Completion should be verifiable — the system must know when a migration is done

## Decision

### Data invariants as the correctness primitive

A **data invariant** is a named property with a checkable predicate:

- *Name*: "all user phone numbers are normalized to E.164"
- *Predicate*: `SELECT COUNT(*) FROM users WHERE phone NOT LIKE '+%' = 0`

This is better than "did we run migration X?" because it is verifiable, composable, and decouples correctness from a specific migration path.

### Desired state includes invariants

Desired state for an environment is:

- **Target contract hash** (structural state)
- **Required data invariants** (data state)

The environment's ref head (the same mechanism that declares "prod should be at contract hash H") also declares "prod requires invariants {I₁, I₂}". This keeps ownership consistent and makes promotions explicit and reviewable.

### Data migrations are guarded transitions

A data migration has the same shape as a structural migration:

- **Precondition**: the database is in a data state where applying the migration makes sense (often "invariant does not yet hold")
- **Execution**: SQL/code that moves data toward the desired shape
- **Postcondition**: the data invariant that proves completion

If the postcondition already holds, the migration is a no-op. This makes migrations safe to retry and handles partial failure gracefully.

### Compatibility: when is it safe to run?

Data migrations have schema dependencies — they can only run when the database schema supports the queries they need. Two mechanisms:

1. **Contract-based compatibility**: Use schema-verify to check "is the current database schema compatible with contract C?" This turns schema compatibility into a concrete, checkable property.
2. **Explicit schema requirements** (preferred): The data migration declares the specific tables, columns, types, and constraints it needs. This is more auditable than "match contract C" as an all-or-nothing proxy.

Once compatibility is confirmed, the runner can provide a typed query interface derived from the compatible schema.

### Two integration models

**Model A — Co-located**: A single migration package contains both structural operations (A → B) and data operations that establish invariants. The effective destination is "contract B with invariants I satisfied."

**Model B — Independent**: Data migrations are independent of structural transitions. The runner applies data migrations as soon as their schema requirements are met. Invariants are enforced by the invariant layer, not the structural routing layer.

Both are viable. Model B avoids baking priority logic into structural routing.

### Pure data migrations

A data migration with no schema change (A → A) is naturally expressed as an "invariant enforcer" — it doesn't move the contract hash, it just establishes a data property. In a hash-only router, A → A would never be selected; the invariant model makes it first-class.

### Routing with invariants

When invariants matter, "shortest path" cannot mean only "fewest structural steps." A reasonable policy:

1. Choose a route that can satisfy required invariants
2. Minimize steps / risk / time
3. Deterministic tie-break

The runner should fail closed (with clear diagnostics) when:

- A required invariant has no provider migration
- A provider exists but its schema requirements are unsatisfiable on any reachable route
- Multiple routes satisfy invariants but are not provably equivalent

## Consequences

### Benefits

- **Verifiable correctness**: "Is the data right?" has a concrete answer — check the invariant predicates — rather than relying on "did we run migration #47?"
- **Decoupled from golden history**: Multiple migration paths can establish the same invariants. No single canonical sequence required.
- **Composable**: Invariants are independent properties. New invariants can be added without replaying history.
- **Idempotent by design**: If the postcondition holds, the migration is a no-op.
- **Pure data migrations are first-class**: Schema-only systems have no way to express "fix this data without changing the schema."

### Costs

- **Invariant predicates can be expensive**: Checking "all phone numbers are normalized" requires scanning rows. A ledger (recording which invariants have been established) can optimize this — but the ledger is an optimization, not the source of truth.
- **Routing complexity increases**: The router must now consider invariant satisfaction alongside structural path length.
- **Environment ref management**: Declaring "prod requires {I₁, I₂}" needs infrastructure — format, storage, and a promotion workflow.

### Open questions

- ~~**Concrete format/location of environment refs**: Who updates them — human or CI/CD automation?~~ **Resolved** by [ADR 208](ADR%20208%20-%20Invariant-aware%20migration%20routing.md): per-file `migrations/refs/<name>.json` carrying `{ hash, invariants }`, edited manually.
- ~~**Model A vs Model B preference**: Co-located or independent? Both are viable; the system could support both with a clear default.~~ **Resolved as Model A (co-located)** in [ADR 208](ADR%20208%20-%20Invariant-aware%20migration%20routing.md).
- ~~**Default routing policy**: When multiple invariant-satisfying routes exist, how does the router choose?~~ **Resolved** in [ADR 208](ADR%20208%20-%20Invariant-aware%20migration%20routing.md): shortest path covering `ref.invariants − marker.invariants` with the deterministic tie-break from [ADR 039](ADR%20039%20-%20Migration%20graph%20path%20resolution%20&%20integrity.md).
- **Ledger design**: What does the optional ledger look like? Minimal: invariant name + timestamp + success/failure. *Deferred — the marker stores applied-at-least-once; per-invariant ledger provenance is a separable feature on top. See [ADR 208](ADR%20208%20-%20Invariant-aware%20migration%20routing.md).*

## Related

- [7. Migration System](../subsystems/7.%20Migration%20System.md) — structural migration routing and graph model
- [ADR 208 — Invariant-aware migration routing](ADR%20208%20-%20Invariant-aware%20migration%20routing.md) — v1 implementation
