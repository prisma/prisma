# ADR 205 — Execution metadata lives on AST

## Context

Query plans reach the runtime through two distinct construction paths. A builder path (SQL builder lane, SQL ORM client) constructs an AST and lowers it to `sql + params`. The raw SQL escape hatch, per [ADR 012](ADR%20012%20-%20Raw%20SQL%20Escape%20Hatch.md), skips the AST entirely and accepts a sql string with caller-supplied metadata. Both paths produce an `ExecutionPlan` with the same shape defined in [ADR 011](ADR%20011%20-%20Unified%20Plan%20Model.md).

The plan metadata (`PlanMeta`) currently carries several fields that describe the query's shape independently of any AST:

- `refs` — tables, columns, and indexes the query touches.
- `paramDescriptors` — a parallel array to `params` carrying codec IDs, native types, nullability, and an origin tag per parameter.
- `annotations.codecs` — an alias → codec ID map used during row decoding, with an additional `$N` → codec ID half for parameters.
- `projectionTypes` — a second alias → codec ID map that mirrors `annotations.codecs` for projections.

ADR 012 introduced these fields as the **sidecar annotation channel for raw plans**. Lines 11, 25-27, and 56-61 describe `refs`, `projection`, and `codecs` as structured hints an author supplies alongside raw SQL to recover the lints, codec-based decoding, and diagnostics that are otherwise automatic for AST-backed plans. The design was explicit: "When present, these unlock the same quality of guardrails available to AST-backed Plans." The implicit assumption is that AST-backed plans do not need the sidecar.

The implementation has drifted. Both the SQL builder lane and the SQL ORM client populate these fields by walking the AST they just constructed and flattening per-node information (a `ProjectionItem`'s inferred output codec, a `ParamRef`'s codec, a `TableSource`'s name) into per-alias and per-index maps. The sidecar is no longer a raw-only channel — it has become the primary channel consumed by the runtime for every plan, and the AST is retained as a parallel source that lowering and some middleware happen to read.

## Problem

Three problems follow from carrying sidecar metadata on `PlanMeta`.

**Rewriters cannot keep sidecar maps in sync.** The `beforeCompile` middleware hook lets plugins rewrite the AST after construction and before lowering. A rewriter that renames a projection alias, swaps a column for a computed expression, reorders parameters, or adds a join silently invalidates every alias-keyed or index-keyed sidecar map. To remain correct, each rewriter would need to enumerate every sidecar shape and patch the entries it affected — a responsibility that is currently undocumented, unenforced, and, in practice, unmet. A middleware that appears to work in isolation may miscode results or skip lints once it runs in combination with other rewrites.

**It is ambiguous which channel is authoritative.** The row decoder reads `annotations.codecs` first, then falls back to `projectionTypes`. The parameter encoder reads `paramDescriptors`. Index-coverage lints read `refs`. Row-count heuristics read `refs.tables[0]`. Each consumer implicitly treats a different field as primary, and there is no invariant specifying which source wins when the AST and the sidecar disagree — a situation that middleware rewrites make routine rather than hypothetical.

**The sidecar's value for raw plans does not justify the surface area.** The only capabilities the sidecar fields enable for raw plans are a narrow set of lints and diagnostics: `refs.indexes` drives the unindexed-predicate lint, `refs.tables` drives a rough row-count budget heuristic, and `paramDescriptors` / `annotations.codecs` drive per-parameter and per-column codec handling. The lints are shallow (string-match index coverage without considering predicate shape or query planner behavior), the budget heuristic is crude (first-table row count times a limit), and codec-based encoding and decoding for raw SQL is something the author can just as easily do at the call site by passing driver-native values and post-processing rows. The cost of keeping the sidecar alive — two channels through the runtime, schema validation rules, drift against the AST, per-lane patching obligations — is disproportionate to the diagnostic benefit.

## Decision

The runtime execution stack reads everything it needs to encode parameters, execute the statement, and decode rows from the AST. Plans without an AST carry no execution-level sidecar metadata; the author is responsible for producing driver-ready parameters and interpreting wire-level row values.

Concretely:

1. **`refs`, `paramDescriptors`, `annotations.codecs`, and `projectionTypes` are removed from `PlanMeta`.** They are not populated for any construction path and not read by any runtime consumer.

2. **`ProjectionItem` carries the projection's output codec, including for RETURNING.** The builder stamps the codec ID it already infers for each projected expression onto the AST node at construction time. Insert, update, and delete ASTs change their `returning` field from `ReadonlyArray<ColumnRef>` to `ReadonlyArray<ProjectionItem>`, so that every output alias in the system — whether from a SELECT projection or a RETURNING clause — carries its codec the same way. The row decoder walks the AST's projection list (or RETURNING list) once at decode setup and assembles an alias → codec lookup from the nodes themselves. `ParamRef` already carries its codec ID; the encoder continues to read from it.

3. **Raw plans execute without per-parameter codec encoding or per-alias codec decoding.** Parameters are passed to the driver as supplied by the caller. Rows come back with whatever wire-level shape the driver produces and are handed to the caller without codec-based transformation. Raw SQL is an escape hatch; serialization is the escape-hatch caller's responsibility, consistent with the "you're on your own" character of raw execution.

4. **Lints and budget heuristics that depend on structural knowledge apply only to AST-backed plans.** Index-coverage lints and row-count estimation walk the AST. For raw plans, these guardrails degrade to the SQL-string-based heuristics that already exist (select-star detection, LIMIT presence, mutation-without-where detection). ADR 012's minimal annotation set — `intent`, `isMutation`, `hasWhere`, `hasLimit` under `PlanMeta.annotations` — remains the policy-routing channel for raw plans; it is distinct from the removed execution-metadata fields and is unaffected.

5. **`PlanMeta` shrinks.** After this change, `PlanMeta` carries identification and policy information only: `target`, `targetFamily`, `storageHash`, `profileHash`, `lane`, and the subset of `annotations` used by policy and telemetry ([ADR 018](ADR%20018%20-%20Plan%20Annotations%20Schema.md)). Execution-level metadata is either on the AST or absent.

## Motivation

The primary motivation is middleware composability. A rewriting middleware should be able to transform an AST — rename an alias, add a predicate, wrap a projection, inject a join — without having to understand or patch a parallel metadata representation. A single authoritative source makes every rewrite correct-by-construction for codec resolution, parameter encoding, and downstream lints. The cost of maintaining sidecar maps in every rewriter is higher than the cost of walking the AST at runtime, and the correctness risk of forgetting to patch a sidecar is entirely eliminated.

A second, reinforcing motivation is surface-area reduction. The sidecar fields do not pay their way even in the raw-plan role ADR 012 assigned them: the lints they enable are limited, the codec transforms they support are trivially replaced by caller-side conversion, and every field we keep alive is a field that has to be documented, validated, and maintained as the AST evolves. Removing them is simpler than narrowing their scope to raw plans and trying to hold the boundary against future drift.

## Scope and non-goals

### In scope

- `ProjectionItem` gains an optional `codecId` field.
- Insert, update, and delete ASTs change their `returning` field type from `ReadonlyArray<ColumnRef>` to `ReadonlyArray<ProjectionItem>`.
- SQL builder lane and SQL ORM client stamp the codec onto each emitted `ProjectionItem` (both SELECT projections and RETURNING items) using type information they already track in their scope-field machinery.
- SQL runtime decoder assembles its alias → codec lookup from the AST's projection list or RETURNING list — one code path covers both.
- SQL runtime encoder continues reading from `ParamRef.codecId`.
- `PlanMeta.refs`, `PlanMeta.paramDescriptors`, `PlanMeta.annotations.codecs`, and `PlanMeta.projectionTypes` are removed from the type and from every producer and consumer.
- The index-coverage lint and the ref-based row-count heuristic are restricted to AST-backed plans or removed where they cannot be supported.
- The `RawFunctionOptions` / `RawTemplateOptions` surface stops accepting the removed fields as inputs.

### Not in scope

- The ADR 012 minimal annotation schema (`intent`, `isMutation`, `hasWhere`, `hasLimit`, `sensitivity`, `budget`, `ownerTag`, `ext`). These are policy-routing annotations, not execution metadata, and continue to travel on `PlanMeta.annotations` for both construction paths.
- Plan-identity rules. [ADR 013](ADR%20013%20-%20Lane%20Agnostic%20Plan%20Identity.md) already excludes the removed fields from identity hashing, so identity behavior is unchanged.
- Telemetry fields. Timing, row counts, and error codes flow through paths independent of the removed sidecars.
- Cross-family applicability beyond the SQL family. The invariant — "the AST is the execution-metadata source when one exists" — applies uniformly to any family that carries its own AST; specific migration work for the Mongo family is addressed separately.

## Consequences

### Positive

- AST-rewriting middleware is correct-by-construction for codec resolution, parameter encoding, and lint accuracy. Authors do not need to learn or maintain a parallel sidecar.
- The row decoder, parameter encoder, and guardrails all consult a single source of truth, removing the current ambiguity about which field wins when they disagree.
- `PlanMeta` becomes a small, stable identity-and-policy record. Redundant channels (`annotations.codecs` / `projectionTypes`) disappear, and the "optional structured annotations" branch of ADR 012 is retired.
- The plan object is smaller; plan construction does no duplicated work.

### Negative

- Raw plans lose the unindexed-predicate lint and the refs-based row-count budget heuristic. Raw SQL is already under-annotated in practice, so the live value of these lints is small, but they are gone.
- Raw plans lose per-parameter codec-based encoding and per-alias codec-based decoding. Callers must pass driver-compatible parameter values (for example, ISO strings for timestamps where the driver expects strings) and must interpret wire-level row values themselves. This matches the "escape hatch" character of raw SQL and is called out in the raw helper's documentation.
- The SQL runtime decoder and the guardrails middleware gain an import of the SQL AST module. They previously operated only on framework-level `PlanMeta`. The coupling is acceptable because decoding and these lints are already SQL-specific and live in the SQL runtime package.
- Any middleware, test, or tool that currently reads the removed fields must be updated to consult the AST. Test fixtures that construct plans by hand with codec maps migrate to construct projection items with codec IDs. Call sites that construct insert, update, or delete ASTs with `returning: [ColumnRef.of(...)]` migrate to `returning: [ProjectionItem.of(alias, ColumnRef.of(...))]` and supply codec IDs on the projection items.

## Alternatives considered

### Keep the sidecars but populate them only for raw plans

Rejected. This was the intermediate design that ADR 012 originally specified. It preserves the lints and codec-based transforms for raw plans, but keeps four fields alive, their JSON Schema entries, their type surface, and the boundary rules that say "populate these only when there is no AST." Every future change to plan metadata has to consider the raw-plan branch. In exchange, we get a lint surface that is limited to begin with and that authors rarely populate fully enough to benefit from. The surface-area cost outweighs the lint value.

### Keep the sidecars and document that middleware must patch them

Rejected. Every rewriting middleware would need to understand every sidecar shape and keep the maps consistent with its AST transformation. Mistakes cause silent miscoding at decode time or missed lints, which are difficult to diagnose in production. Correctness-by-construction is worth more than the marginal runtime cost of walking the AST once per plan.

### Promote sidecar fields to authoritative and derive the AST from them

Rejected. The AST is strictly richer than any flat metadata — it captures expression structure, join topology, subqueries, and the full projection graph. Lowering requires the AST in any case. Flattening the AST during construction and reconstructing an AST-shaped view during rewrites is strictly worse than using the AST directly.

### Treat sidecar fields as an opportunistic cache of AST-derived information

Rejected. A cache needs a correctness invariant that specifies when it is valid and when it is stale. The rewrite problem returns as soon as middleware enters the picture: any rewrite invalidates the cache, but there is no mechanism to detect or express that invalidation. A cache is an optimization, and the AST walk is not on a hot path that warrants the complexity.

### Require `ProjectionItem.codecId`

Rejected for now. An optional field preserves the ability to construct projection items in tests and synthetic middleware without supplying a codec. The decoder tolerates missing codecs by passing the wire value through; a required field would add construction friction without preventing any real bug.

## Implementation notes

The change has a small surface area. The two builder producers (`buildQueryPlan` in the SQL builder lane and `buildOrmQueryPlan` in the SQL ORM client) stop emitting the removed fields. The row decoder switches to walking the AST's projection list (or RETURNING list) to resolve per-alias codecs. The guardrails and budgets middleware drop their `refs`-based code paths; AST-backed plans get AST-based index and row-count checks, raw plans fall through to the existing SQL-string-based heuristics.

Promoting `returning` to `ReadonlyArray<ProjectionItem>` is the one non-trivial piece. It touches the AST class definitions for `InsertAst`, `UpdateAst`, and `DeleteAst`, their rewriters and folders (visitor methods that today walk `ColumnRef[]` get a one-line change to walk `ProjectionItem[]` and descend into `item.expr`), the Postgres adapter's RETURNING lowering (which today emits `col` and now emits `col AS alias` when alias differs from column name), and the call sites that construct these ASTs. The scope-field machinery the builder lanes already use to stamp codecs onto SELECT projections is reused unchanged for RETURNING.

`PlanMeta` is pruned: the removed fields come out of the type and out of the JSON Schema. The ADR 012 minimal annotation schema stays. Documentation for the raw helper is updated to state that callers are responsible for parameter serialization and row interpretation; the option keys for `refs`, `paramDescriptors`, and codec maps are removed from the raw-plan API.

Middleware test fixtures that construct plans with hand-written `annotations.codecs` maps migrate to construct projection items with codec IDs. The migration is mechanical and can be done per test file without coordination.

## References

- [ADR 011 — Unified Plan Model](ADR%20011%20-%20Unified%20Plan%20Model.md)
- [ADR 012 — Raw SQL Escape Hatch](ADR%20012%20-%20Raw%20SQL%20Escape%20Hatch.md) — this ADR retires the optional `refs` / `projection` / `codecs` annotation branch of ADR 012; the minimal annotation schema (`intent`, `isMutation`, `hasWhere`, `hasLimit`) is unchanged.
- [ADR 013 — Lane Agnostic Plan Identity](ADR%20013%20-%20Lane%20Agnostic%20Plan%20Identity.md)
- [ADR 018 — Plan Annotations Schema](ADR%20018%20-%20Plan%20Annotations%20Schema.md)
- [ADR 019 — TypedSQL as Separate CLI](ADR%20019%20-%20TypedSQL%20as%20Separate%20CLI.md)
- [ADR 030 — Result decoding & codecs registry](ADR%20030%20-%20Result%20decoding%20%26%20codecs%20registry.md)
