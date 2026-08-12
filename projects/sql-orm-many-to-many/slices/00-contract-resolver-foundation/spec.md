# Slice 0: contract + resolver foundation

_Parent project: `projects/sql-orm-many-to-many/`. Outcome: an M:N relation becomes a validatable contract shape whose junction is surfaced by the shared resolver — the foundation slices 1–3 build on._

## At a glance

Today an emitted M:N contract is **unvalidatable**: the relation validator's cardinality enum is `'1:1' | '1:N' | 'N:1'` and its objects use `'+': 'reject'`, so `cardinality: 'N:M'` and the `through` key both fail `validateContract`. This slice makes the M:N relation shape (`through` + `N:M`) first-class through the contract — validator, JSON schema, TS type, emitter — and surfaces a uniform `through` descriptor on the one shared ORM resolver (`resolveModelRelations` → `ResolvedRelation`). It teaches no consumer to *use* `through` (that's slices 1–3); it makes `through` exist, validate, and be resolvable.

## Chosen design

**Contract shape — relation gains optional `through`, cardinality gains `'N:M'`.**

```jsonc
// data-contract-sql-v1.json :: ModelRelation
"cardinality": { "enum": ["1:1", "1:N", "N:1", "N:M"] },
"through": {                       // optional; present only for N:M
  "table": "string",
  "parentColumns": ["string"],     // junction → parent FK (array: composite-key ready)
  "childColumns":  ["string"],     // junction → target FK
  "targetColumns": ["string"]      // target anchor (PK) the childColumns reference
}
```

- **`validators.ts`** — extend `ContractReferenceRelationSchema`: add `'N:M'` to the cardinality enum, add an optional `through` object (own `'+': 'reject'`, array columns). 
- **`build-contract.ts`** — delete the `as ContractRelation['cardinality']` cast (the comment "until the contract type is extended to cover many-to-many" is now resolved); rename emitted `parentCols/childCols` → `parentColumns/childColumns` (match lowering); populate `targetColumns` from the target anchor.
- **`ContractReferenceRelation` TS type** (`@internal/sql-contract/types`) — add the optional `through` field so the cast is unnecessary.

**Resolver — `ResolvedRelation` carries `through`.**

```ts
interface ResolvedRelation {
  readonly to: string;
  readonly cardinality: RelationCardinalityTag | undefined;
  readonly on: { localFields; targetFields };
  readonly through?: {                       // populated for N:M
    readonly table: string;
    readonly parentColumns: readonly string[];
    readonly childColumns: readonly string[];
    readonly targetColumns: readonly string[];
    readonly requiredPayloadColumns: readonly string[];  // non-FK NOT-NULL-no-default cols on the junction (slice 3's guard)
  };
}
```

`resolveModelRelations` (`collection-contract.ts`) reads `through` from the contract relation and computes `requiredPayloadColumns` from the junction model's storage (columns that are NOT NULL, no default, not in `parentColumns ∪ childColumns`).

**Cardinality tag canonicalised on `'N:M'`.** The orm-client is the lone `'M:N'` holdout (contract, schema, PSL, lowering already use `'N:M'`). Four sites flip: `RelationCardinalityTag` (`types.ts`), the `partitionByOwnership` guard (`mutation-executor.ts`), the to-many check (`collection-internal-types.ts`), and `parseRelationCardinality` (`collection-contract.ts`).

## Coherence rationale

One reviewable story: *teach the contract stack and the ORM resolver that an M:N relation has a junction.* The validator/schema/type/emitter changes are inseparable — a `through` declared in the schema but rejected by the validator (or vice versa) is incoherent — and the resolver change is what proves the contract shape is consumable. The `'M:N'`→`'N:M'` flip rides along because the resolver can't surface a correct cardinality without it. Fixture regen is mechanical fallout of the hash change.

## Scope

**In:** `validators.ts` (cardinality enum + optional `through`); `data-contract-sql-v1.json` `ModelRelation`; `ContractReferenceRelation` TS type; `build-contract.ts` (cast deletion, field-name reconciliation, `targetColumns`); `collection-contract.ts` (`ResolvedRelation.through` + `requiredPayloadColumns`, `parseRelationCardinality` accepts `'N:M'`); the four `'M:N'`→`'N:M'` sites in sql-orm-client; a round-trip test fixture with `rel.manyToMany`; `pnpm fixtures:check` regen.

**Out:** teaching the include/filter/write paths to *walk* `through` (slices 1/2/3); any `IncludeExpr` change; any runtime SQL emission for M:N.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
|---|---|---|
| Cardinality split: contract emits `'N:M'`, orm-client expects `'M:N'` → real M:N parses to `undefined`; the mutation guard would silently not fire | Canonicalise on `'N:M'`; flip all four sites | The existing rejection test hand-builds `'M:N'` — it must move to `'N:M'` or it tests a dead branch |
| Field-name drift: `build-contract` emits `parentCols/childCols`, lowering uses `parentColumns/childColumns` | Canonicalise on `parentColumns/childColumns` across schema + type + emit + resolver | A mismatch here means the resolver reads `undefined` |
| arktype `'+': 'reject'` on relation + `on` | `through` must be *explicitly declared*; give `through` its own reject policy | Can't rely on pass-through of an undeclared key |
| Composite-key junctions (columns are arrays) | Descriptor + `requiredPayloadColumns` handle arrays, never assume scalar | Lowering already arrays these |
| Junction→target join column is implicit (target PK) | Resolver derives + carries `targetColumns` so slices 1–3 don't re-derive | `through` from lowering omits the explicit target-side column |
| `fixtures:check` blast radius (contract hash changes) | Regen in-scope; verify drift is hash/expected-only, investigate any unrelated golden drift | Per slice-DoD overlay: `fixtures:check` dispatch step required for `3-*-extensions` touch |

## Slice-specific done conditions

- [ ] A round-trip test: an M:N contract (`rel.manyToMany('Tag', { through: 'UserTag', from, to })`) emits and **passes `validateContract`** (fails on `main` today).
- [ ] `ResolvedRelation.through` (incl. `targetColumns` + `requiredPayloadColumns`) is populated for an M:N relation; resolver unit test asserts it.
- [ ] Grep gate: no `'M:N'` string literal remains in `packages/3-extensions/sql-orm-client/src/`.
- [ ] `pnpm fixtures:check` green; contract-hash golden drift is expected-only (no unrelated fixture churn committed).

## Open Questions

1. **Shape of the required-payload signal.** Working position: surface the **array of required non-FK column names** (`requiredPayloadColumns`), not a boolean — gives slice 3 freedom over messaging and lets it name the offending columns.
2. **Does `through` carry `targetColumns` explicitly?** Working position: **yes** — slice 0 derives the target anchor and stores it, so slices 1–3 share one complete descriptor rather than each re-deriving the PK.

## References

- Parent project: `projects/sql-orm-many-to-many/spec.md`
- Linear issue: [TML-2784](https://linear.app/prisma-company/issue/TML-2784)
- Contract-shape ADRs: ADR 121 (relation typing), ADR 172 (domain-storage separation) — amendment committed at project close-out
