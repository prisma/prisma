# Brief: D1 — contract shape validates M:N

## Task

Extend the SQL contract relation shape so a many-to-many relation is **validatable** and round-trips. In the three places that define the relation shape, add `'N:M'` to the relation cardinality enum and an optional `through` object `{ table, parentColumns[], childColumns[], targetColumns[] }`: the arktype validator (`packages/2-sql/1-core/contract/src/validators.ts`, `ContractReferenceRelationSchema` — it currently rejects both `'N:M'` and the undeclared `through` key via `'+': 'reject'`), the JSON schema (`packages/2-sql/2-authoring/contract-ts/schemas/data-contract-sql-v1.json`, `ModelRelation`), and the `ContractReferenceRelation` TS type (in `@internal/sql-contract` types — grep for the type the `as ContractRelation['cardinality']` cast in `build-contract.ts` references). Then update `build-contract.ts`: delete that cast (now unnecessary), rename the emitted `parentCols/childCols` → `parentColumns/childColumns` (match lowering), and populate `targetColumns` from the target model's anchor (PK the junction's child FK references). **Write the test first**: author an M:N relation via `rel.manyToMany('Tag', { through: 'UserTag', from: 'userId', to: 'tagId' })`, emit the contract, assert `validateContract` passes (it fails on `main` today).

## Scope

**In:** `validators.ts` (`ContractReferenceRelationSchema`: cardinality enum + optional `through` object, give `through` its own `'+': 'reject'`, array columns); `data-contract-sql-v1.json` `ModelRelation`; the `ContractReferenceRelation` TS type; `build-contract.ts` (cast deletion + `parentCols/childCols`→`parentColumns/childColumns` + `targetColumns`); the new round-trip test.

**Out:** anything in `packages/3-extensions/sql-orm-client/` (the `'M:N'`→`'N:M'` rename is D2, the resolver is D3); any include/filter/write runtime; `IncludeExpr`. Do not touch these even if adjacent.

## Completed when

- [ ] A new round-trip test authors an M:N relation, emits, and `validateContract` **passes** (fails on `main`).
- [ ] `through` emits as `{ table, parentColumns, childColumns, targetColumns }` — no `parentCols`/`childCols` remain (`rg "parentCols|childCols" packages/2-sql` empty).
- [ ] The `as ContractRelation['cardinality']` cast in `build-contract.ts` is removed (no bare cast reintroduced — use the now-correct type).
- [ ] Gate: `pnpm --filter @internal/sql-contract build` then downstream `pnpm typecheck` green (the relation type is consumed elsewhere — the optional `through` must not break consumers).
- [ ] Gate: `pnpm fixtures:check` green. The change is **additive** (existing non-M:N relations emit byte-identically), so expect **no** golden drift; if any fixture changes, investigate and surface before committing — non-additive drift is a halt condition.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note in your wrap-up. Anything that pulls you off the goal — even if useful — halts and surfaces.

## References

- Slice spec: `projects/sql-orm-many-to-many/slices/00-contract-resolver-foundation/spec.md` — chosen design (the `through`/`ResolvedRelation` shapes), pre-investigated edge cases.
- Slice plan: same dir `plan.md` § Dispatch 1.
- Project spec: `projects/sql-orm-many-to-many/spec.md` § Contract-impact.
- Pre-investigated edge cases that apply here: arktype `'+': 'reject'` (must declare `through` explicitly + give it its own reject policy); `parentCols/childCols` vs `parentColumns/childColumns` drift; composite-key junctions (columns are arrays, never scalar); implicit target PK (derive `targetColumns`); fixtures additivity.

## Operational metadata

- **Model tier:** mid — contract substrate change with one design judgment (the `through` schema shape), bounded surface.
- **Branch:** `tml-2784-slice-0-contract-resolver-foundation`. Commit with explicit staging + `-s` sign-off. **Do not push** (the orchestrator pushes at slice DoD).
- **Time-box:** ~90 min wall-clock. Overrun → halt and surface.
- **Halt conditions:** an out-of-scope surface (esp. anything under `sql-orm-client/`) needs touching to complete the task; `fixtures:check` shows non-additive golden drift; the `ContractReferenceRelation` type change ripples to a consumer that needs migration (would mean the change isn't purely additive — surface it).
