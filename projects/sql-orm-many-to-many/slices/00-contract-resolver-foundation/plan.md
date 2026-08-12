# Slice 0: contract + resolver foundation — Dispatch plan

**Spec:** `projects/sql-orm-many-to-many/slices/00-contract-resolver-foundation/spec.md`
**Linear:** [TML-2784](https://linear.app/prisma-company/issue/TML-2784)

Three dispatches, sequential. Dispatch 1 is a contract-substrate change; dispatch 2 is a mechanical cardinality rename; dispatch 3 is the resolver design-judgment (split from 2 so the judgment isn't buried in the rename, per `sizing.md`). All dispatches are test-first per the repo rule.

### Dispatch 1: contract shape validates M:N

- **Outcome:** An M:N relation (`rel.manyToMany('Tag', { through: 'UserTag', from, to })`) emits a contract that **passes `validateContract`** — `cardinality: 'N:M'` and a `through: { table, parentColumns[], childColumns[], targetColumns[] }` object are both accepted (both rejected on `main` today).
- **Builds on:** The slice spec's chosen contract shape.
- **Hands to:** A contract relation that carries `through` + accepts `N:M`, validated end-to-end — the shape dispatch 3's resolver reads from. `ContractReferenceRelation` TS type carries optional `through`; the `as ContractRelation['cardinality']` cast is gone.
- **Focus:** `validators.ts` (`ContractReferenceRelationSchema`: add `'N:M'` to the enum + optional `through` object with its own `'+': 'reject'`, array columns); `data-contract-sql-v1.json` `ModelRelation`; the `ContractReferenceRelation` TS type; `build-contract.ts` (delete the cast, rename emitted `parentCols/childCols` → `parentColumns/childColumns`, populate `targetColumns` from the target anchor). Test-first: a round-trip test that authors M:N → emits → `validateContract` passes.
- **Gates (`Completed when`):** the round-trip test passes; `pnpm --filter @internal/sql-contract build` then downstream `pnpm typecheck` (the relation type is consumed elsewhere) green; `pnpm fixtures:check` green — the change is *additive* (existing non-M:N contracts emit byte-identically), so expect **no** golden drift; investigate and do not commit any unrelated drift.

### Dispatch 2: sql-orm-client canonicalises on `'N:M'`

- **Outcome:** sql-orm-client speaks one cardinality tag, `'N:M'`; `parseRelationCardinality('N:M')` returns the tag; **no `'M:N'` literal remains** in `packages/3-extensions/sql-orm-client/src/`.
- **Builds on:** None (independent correctness fix — orm-client matches the `'N:M'` the contract already emits). Can run alongside dispatch 1; sequenced after it only for review coherence.
- **Hands to:** A resolver/runtime that recognises `'N:M'` — without which a real M:N relation parses to `undefined` and the mutation guard silently never fires.
- **Focus:** flip the four sites — `RelationCardinalityTag` (`types.ts`), the `partitionByOwnership` guard (`mutation-executor.ts`), the to-many check (`collection-internal-types.ts`), `parseRelationCardinality` (`collection-contract.ts`). Move the existing M:N-rejection unit test off its hand-built `'M:N'` to `'N:M'` so it exercises the live branch (it stays a rejection test until slice 3 flips it positive).
- **Gates:** `rg "'M:N'" packages/3-extensions/sql-orm-client/src` returns empty; `pnpm --filter @internal/sql-orm-client typecheck` + tests green.

### Dispatch 3: resolver surfaces the `through` descriptor

- **Outcome:** `ResolvedRelation.through` is populated for an M:N relation — `{ table, parentColumns, childColumns, targetColumns, requiredPayloadColumns }` — and a resolver unit test asserts the full shape, including a composite-key case and a junction with a required payload column.
- **Builds on:** Dispatch 1's `through`-carrying contract relation **and** dispatch 2's `'N:M'` recognition (non-linear: needs both hand-offs).
- **Hands to:** The complete `through` descriptor on the shared `resolveModelRelations` → `ResolvedRelation` — the foundation slices 1 (read), 2 (filter), 3 (write) consume.
- **Focus:** `resolveModelRelations` (`collection-contract.ts`) reads `through` from the contract relation; derives `requiredPayloadColumns` (junction storage columns that are NOT NULL, no default, not in `parentColumns ∪ childColumns`) per the slice spec's working position (surface the **array**, not a boolean); carries `targetColumns` explicitly so downstream slices don't re-derive the target PK. Test-first: resolver unit test.
- **Gates:** resolver unit test green (incl. composite-key + required-payload cases); `pnpm --filter @internal/sql-orm-client typecheck` + tests green.

## Handoff completeness

The slice-DoD is reachable: round-trip validation (D1) + `ResolvedRelation.through` populated (D3) + no `'M:N'` literal (D2) + `fixtures:check` green (D1 gate). Dispatch 3's hand-off (complete `through` descriptor) is exactly what slices 1–3 build on.
