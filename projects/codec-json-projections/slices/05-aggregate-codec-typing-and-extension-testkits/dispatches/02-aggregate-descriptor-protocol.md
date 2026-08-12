# Brief: D2 — aggregate descriptor protocol and registries

## Task

Introduce `SqlAggregateDescriptor` — the declarative mapping from `(aggregate operation, optional input CodecRef)` to output codec identity, nullability, and lowering — together with its contribution channel and validated registries, consumed by nothing yet. Resolution semantics are settled (design-notes § Aggregate descriptors): input matching supports no-input operations (`count(*)`), exact codec IDs, and codec traits, with exact matches winning over traits; output codec identity is declarative — `self` or a concrete codec ID, with a function permitted to resolve only output type parameters; lowering may construct AST but cannot select a different output codec than declared. Contributions flow beside `codecDescriptors` through the component system, are single-contributor-validated at `ControlStack` collection, assembled once into a validated registry at runtime composition (beside `buildCodecDescriptorRegistry` in `packages/2-sql/5-runtime/src/sql-context.ts`), and exposed on `QueryLaneContext` beside `codecDescriptors`. Tests first: precedence (exact-over-trait), single-contributor validation, malformed-contribution failure at composition time (never at query time).

## Scope

**In:** the descriptor type and its matcher/output vocabulary (home per spec open question 1's working position: SQL family core, `packages/2-sql`, since the type is SQL-specific — record the exact placement decision and rationale in your report); the contribution key and its collection/validation; registry construction and its exposure on `QueryLaneContext`; unit tests for all of the above.

**Out:** built-in descriptor sets and database matrices (D3/D4); `aggregateTypes` emission (D5); any ORM or sql-builder consumption (D6/D7); testkit packages (D1, done); any change to existing codec-descriptor behaviour.

## Completed when

- [ ] `SqlAggregateDescriptor` and its registry exist with tests proving exact-over-trait precedence, declarative output identity (a lowering hook cannot change the declared output codec), single-contributor validation, and composition-time failure for malformed contributions.
- [ ] The registry is reachable from `QueryLaneContext` and assembled in `sql-context.ts`, but `grep -rn "aggregateDescriptors\|SqlAggregateDescriptor" packages/*/src` reaches only definition, contribution, validation, and assembly sites — no planner or renderer resolves through it yet (the dormancy pattern slices 1–3 used).
- [ ] Validation gates green for every touched package (see § Validation gates), including `pnpm lint:framework-vocabulary` if the contribution surface touches `packages/1-framework`.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note in your wrap-up message. Anything that pulls you off the goal — even if it looks useful — halts and surfaces.

## References

- Slice spec: `projects/codec-json-projections/slices/05-aggregate-codec-typing-and-extension-testkits/spec.md` — § Aggregate descriptors and resolution; open question 1.
- Design notes: `projects/codec-json-projections/design-notes.md` § Aggregate descriptors and emitted aggregate types — the settled semantics; § Alternatives considered ("Put aggregate behavior on codec descriptors" — rejected; do not relitigate).
- Codec-descriptor precedent: `packages/1-framework/1-core/framework-components/src/shared/framework-components.ts` (`codecDescriptors` on `types.codecTypes`), `packages/1-framework/1-core/framework-components/src/control/control-stack.ts` (collection + one-contributor-per-codecId validation), `packages/2-sql/5-runtime/src/sql-context.ts` (`buildCodecDescriptorRegistry`), `packages/2-sql/4-lanes/relational-core/src/query-lane-context.ts` (`codecDescriptors` exposure).
- Constraint: `.agents/rules/no-family-vocabulary-in-framework.mdc` — if the contribution key cannot live beside `codecDescriptors` without importing SQL vocabulary into `packages/1-framework`, that is a fork to surface (with your recommendation), not a placement to invent. A family-neutral generic base in framework with the SQL specialization in `packages/2-sql` — mirroring how codec descriptors do it — is the pattern to weigh first.
- Repo patterns: interface + factory for stateful services; frozen-class conventions if any AST vocabulary is added; arktype for runtime validation; no bare `as` in production code.

## Operational metadata

- **Model tier:** `orchestrator` — substrate/design judgment; the protocol's shape constrains four later dispatches.
- **Time-box:** 2 hours wall-clock. Overrun → halt and surface.
- **Halt conditions:** the contribution surface fork above; any need to touch ORM/sql-builder/emitter surfaces to make the registry reachable; discovery that `QueryLaneContext` cannot carry the registry without breaking an existing public type; any spec assumption observed false (invariant I12 — surface, never silently amend).

## Validation gates

```bash
pnpm build
pnpm typecheck
pnpm lint:deps
pnpm lint --filter <every touched package>
pnpm test --filter <every touched package>
pnpm fixtures:check   # must be a no-op this dispatch
```

Run gates in the foreground; save long output once to a file under `wip/` and read the file.
