# Slice: 07-contributed-aggregate-operations

_(Parent project `projects/codec-json-projections/`. Outcome this slice contributes: the aggregate operation set becomes a target/extension contribution end to end — no literal operation names or per-operation logic remain in the sql-builder lane or sql-orm-client — so slice 08 can add operations without touching either package.)_

## At a glance

Behaviour-preserving but for two derived consequences, named below. Opens the descriptor vocabulary's `operation` field from the closed `AggregateFn` union to `string`, and replaces the literal-named aggregate methods in sql-orm-client and the hardcoded aggregate functions in the sql-builder lane with surfaces derived from the contract's emitted `aggregateTypes` — typed by mapped types, dispatched generically by operation name. Emitted contracts, rendered SQL, and fixtures stay byte-identical.

**Observable change 1 — runtime** (amended 2026-08-07 from D3): PostgreSQL declares `count` with `input: { kind: 'any' }`, so its emitted rows carry both `withoutInput` and `anyInput`, and the row-presence rule gives ORM `count` both arities honestly. A `count(field)` call previously dropped its argument silently and rendered `COUNT(*)`; it now renders `COUNT(<column>)`. Compile-time gating for statically-typed contracts is unchanged (a relation name is still absent from `AggregateFieldNames`), so the change is reachable only through dynamic invocation — and it removes a recorded deviation from Prisma, flipping an `it.fails` port assertion green.

**Observable change 2 — compile time, map-less contracts** (amended 2026-08-07 from slice review): for a contract whose `aggregateTypes` is unknown — an in-code `defineContract(...)`, or a contract emitted before aggregate types existed — the derived surfaces resolve to an empty guard type rather than the five literal methods. Calls that previously compiled (with an `as never` field argument, since `AggregateFieldNames` was already `never`) now need the builder itself cast; two integration tests in this slice show the shape. Statically-typed emitted contracts are unaffected. The earlier claim that "compile-time gating is unchanged" holds only for contracts carrying an aggregate map.

## Chosen design

Settled in [`design-notes.md` § Integer representation and the aggregate operation split (2026-08-04)](../../design-notes.md).

### Open operation names, closed SQL alphabet

`AggregateDescriptor.operation` (framework-components `shared/aggregate-descriptor.ts`) and `SqlAggregateDescriptor` (relational-core `aggregate-descriptor{,-registry}.ts`) widen from the `AggregateFn` union to `string`; registry keying and single-contributor validation are already name-keyed. The AST union itself — `AggregateFn = AggregateCountFn | AggregateOpFn` at `packages/2-sql/4-lanes/relational-core/src/ast/types.ts:15-16` — **stays closed**: it is SQL's alphabet, not the operation namespace. An operation whose name is in the alphabet lowers to `AggregateExpr(name, expr)` by default; any other operation must carry a `lower` hook building existing nodes (`AggregateExpr` + `CastExpr`, or the slice-01 function nodes), validated at composition time. Renderers are untouched.

### Derived method surfaces

The contract's `aggregateTypes` (`Record<string, AggregateOperationTypes>`, `packages/2-sql/1-core/contract/src/types.ts:115-122`) already carries the full operation vocabulary and, per operation, the rows that determine its call shape. The consumer surfaces derive from it:

- **Call-shape rule:** a `withoutInput` row ⇒ a zero-argument call; `byCodec`/`anyInput` rows ⇒ a field-taking call gated by `AggregateFieldNames`; both ⇒ both overloads (`count()` and `count(field)` — the slice-05 D2 amendment's input-agnostic kind is what makes the dual shape a data fact rather than a special case).
- **sql-orm-client:** the literal methods `count`/`sum`/`avg`/`min`/`max` on the include-refinement collection (`src/collection.ts:735` ff.), the top-level and grouped `AggregateSelector` surfaces (`src/types.ts:556-585`), and the grouped `.aggregate()` builder become one mapped-type surface over `AggregateTypesOf<TContract>`, dispatched at runtime by operation name (same proxy mechanism the client already uses for model access). `createIncludeScalar('count', …)`-style literal calls disappear.
- **sql-builder lane:** `CountField`'s static typing and `numericAgg`'s fixed function list (`src/expression.ts`, `src/runtime/functions.ts:168-173`) derive from the same map; the type-level machinery (`AggregateField`, `AggregateRow`) is already generic over `Op extends string` and needs no change.

Existing user call sites compile unchanged — the five methods still exist, now because both built-in targets contribute them.

### What proves extensibility

A registry + type test contributes a hypothetical operation (descriptor with a `lower` hook onto function nodes) and asserts it surfaces as a typed method with the right result type and arity — mirroring slice 05's choice to prove the mechanism without inventing a production extension aggregate.

## Coherence rationale

One migration of every aggregate consumer onto one derivation. Splitting by package would leave two dispatch systems alive in one merged state, each half-covering the operation set — the transitional shape the project's lockstep constraint exists to prevent.

## Scope

**In:** the `operation: string` widening and composition-time lowering validation; the derived method surface and generic dispatch in sql-orm-client (top-level, grouped, include reducers) and the sql-builder lane; reserved-name validation (a contributed operation may not shadow non-aggregate builder members); the extensibility registry/type test; doc updates to the aggregate descriptor guide.

**Out:** any behaviour, naming, or output-codec change (slice 08); new operations; AST or renderer changes; Mongo; changes to `aggregateTypes` emission (the map already carries what the derivation needs).

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --------- | ----------- | ----- |
| `count`'s dual arity | Derived from row presence (`withoutInput` + `anyInput`), not special-cased | The one operation with both shapes today; the derivation must not re-hardcode it |
| A contributed operation named like an existing builder member (`select`, `variant`, …) | Rejected at composition time with a structured error | Flat namespace on the collection surface makes collisions possible by construction |
| JSDoc on the current literal methods (worked examples on `count`/`sum`/`avg`) | Curated doc comments move to the derived generic signatures; per-operation examples live in docs | DX regression risk of mapped-type surfaces; reviewer should confirm hover experience |

## Slice-specific done conditions

- [ ] `rg -n "'count'|'sum'|'avg'|'min'|'max'" packages/3-extensions/sql-orm-client/src packages/2-sql/4-lanes/sql-builder/src` returns no operation-dispatch literals (type-test and doc-comment hits exempt by inspection).
- [ ] `pnpm fixtures:check` passes with **no** regeneration — emitted contracts are byte-identical.
- [ ] The extensibility test proves a contributed operation surfaces as a typed method end to end.

## Open Questions

1. **Runtime dispatch mechanism.** Working position: the same proxy pattern the ORM uses for model access, keyed by `aggregateTypes` membership; generated methods only if the proxy defeats type-level narrowing.
2. **Home of reserved-name validation.** Working position: ORM extension composition (where the collection surface is assembled), not `ControlStack` — the collision is a client-surface concern, not a registry concern.

## Contract impact

None. `aggregateTypes` shape and contents are unchanged; this slice only changes who reads them and how.

## Adapter impact

None behavioural. PostgreSQL and SQLite already contribute their descriptor matrices (slice 05); their contributions become the sole source of the operation set.

## ADR pointer

Architectural shift — the operation namespace moves from framework vocabulary to target/extension contribution, with a closed SQL alphabet underneath. ADR 020 (aggregate availability and lowering-position rules) is extended in this slice.

## References

- Parent project: [`projects/codec-json-projections/spec.md`](../../spec.md) (scope extension of 2026-08-04)
- Settled design: [`projects/codec-json-projections/design-notes.md`](../../design-notes.md) § Integer representation and the aggregate operation split
- Linear issue: [TML-3164](https://linear.app/prisma-company/issue/TML-3164/contributed-aggregate-operations-de-hardcode-the-sql-builder-and-orm)
- Predecessor: [slice 05 spec](../05-aggregate-codec-typing-and-extension-testkits/spec.md) — descriptor contributions, registries, `aggregateTypes` emission, and the D2 input-agnostic amendment this slice's arity rule reads off
- Descriptor reference: [`docs/reference/aggregate-descriptor-guide.md`](../../../../docs/reference/aggregate-descriptor-guide.md)
