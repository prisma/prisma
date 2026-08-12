# Brief: D3 — resolver surfaces the `through` descriptor

## Task

Make the single shared ORM resolver surface a **complete** `through` descriptor for M:N relations, so the later slices (read / filter / write) consume one uniform primitive instead of each re-deriving the junction walk. All in `packages/3-extensions/sql-orm-client/src/collection-contract.ts`:

1. Extend the `ResolvedRelation` interface (~line 199) with an optional `through?: { readonly table: string; readonly parentColumns: readonly string[]; readonly childColumns: readonly string[]; readonly targetColumns: readonly string[]; readonly requiredPayloadColumns: readonly string[] }`.
2. In `resolveModelRelations` (~line 249), read `through` from the contract relation — D1 (commit `f962fd47d`) emits it as `{ table, parentColumns, childColumns, targetColumns }` — and populate the resolved `through`.
3. **Derive `requiredPayloadColumns`**: the junction model's storage columns that are (a) NOT NULL, (b) have no default, and (c) are not in `parentColumns ∪ childColumns`. This is what slice 3 uses to disable nested `.create` on required-payload junctions. Surface it as an **array of column names** (decided working position — not a boolean).

**Write the resolver unit test FIRST**, covering four cases: (a) a simple single-column-FK M:N — `through` populated, `requiredPayloadColumns` empty; (b) a **composite-key** junction (multi-column FKs) — arrays carry all columns; (c) a junction with a **required non-FK payload column** — `requiredPayloadColumns` contains it; (d) a junction whose only extra columns are nullable or defaulted — `requiredPayloadColumns` empty.

## Scope

**In:** `collection-contract.ts` (`ResolvedRelation.through` + `resolveModelRelations` population + `requiredPayloadColumns` derivation); the resolver unit test.

**Out:** `resolveIncludeRelation` / `buildJoinWhere` / `mutation-executor` *consumption* of `through` (those are slices 1/2/3 — do not wire them); any SQL emission; `IncludeExpr`. Do not touch the contract packages (D1, done).

## Completed when

- [ ] `ResolvedRelation.through` is populated for an M:N relation including `targetColumns` and `requiredPayloadColumns`.
- [ ] The resolver unit test covers cases (a)–(d) above and passes.
- [ ] Gate: `pnpm --filter @internal/sql-orm-client typecheck` + `pnpm --filter @internal/sql-orm-client test` green.

## Standing instruction

Stay focused on the goal; control scope. The judgment site here is the `requiredPayloadColumns` derivation — get it right against the real contract storage shape; don't wire any consumer.

## References

- Slice spec: `projects/sql-orm-many-to-many/slices/00-contract-resolver-foundation/spec.md` — the `ResolvedRelation` shape + § Open Questions working positions (array not boolean; carry `targetColumns` explicitly).
- D1 commit `f962fd47d` — the contract `through` shape you read from.
- Grounding: `collection-contract.ts:199` (`ResolvedRelation`), `:249` (`resolveModelRelations`). You'll need to find how the contract model storage exposes a column's **nullability and default-presence** (to compute `requiredPayloadColumns`) — grep the contract storage types (`ModelStorageField` / `ModelStorage` in `@internal/contract` or `@internal/sql-contract`).

## Operational metadata

- **Model tier:** mid (sonnet) — bounded surface, but real judgment in the `requiredPayloadColumns` derivation; take care.
- **Branch:** `tml-2784-slice-0-contract-resolver-foundation`. Explicit staging + `-s` sign-off. **Do not push.**
- **Time-box:** ~60 min.
- **Halt conditions (surface, do not work around):** the contract relation doesn't carry `targetColumns`, OR the junction model storage doesn't expose column nullability / default-presence in a usable way — either means a slice-spec assumption is **false** (D1's emit or the contract shape needs adjustment); halt and surface as a falsified assumption rather than approximating `requiredPayloadColumns`. Also halt if completing the task requires touching an out-of-scope consumer.
