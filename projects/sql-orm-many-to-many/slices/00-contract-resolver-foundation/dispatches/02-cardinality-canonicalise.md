# Brief: D2 — sql-orm-client canonicalises on `'N:M'`

## Task

The SQL contract emits relation cardinality as `'N:M'` (and D1 just made that validatable). `sql-orm-client` is the lone holdout still spelling it `'M:N'`, which means a real emitted M:N relation parses to `undefined` (and the mutation guard silently never fires). Flip the four `'M:N'` sites in `packages/3-extensions/sql-orm-client/src/` to `'N:M'`:

1. `types.ts` — `RelationCardinalityTag = '1:1' | 'N:1' | '1:N' | 'M:N'` → `'N:M'`.
2. `mutation-executor.ts` — the `partitionByOwnership` guard `cardinality === 'M:N'`.
3. `collection-internal-types.ts` — the to-many type-level check `... extends '1:N' | 'M:N' ? ...`.
4. `collection-contract.ts` — `parseRelationCardinality` accepting `'M:N'`.

Also move the existing M:N-nested-mutation **rejection** unit test (in `mutation-executor.test.ts`) off its hand-built `'M:N'` literal to `'N:M'` so it exercises the live guard branch. It **stays a rejection test** — do not flip it to a positive assertion (that's a later slice).

## Scope

**In:** the 4 `'M:N'` literal sites in `sql-orm-client/src/` + the rejection test's cardinality literal.

**Out:** any `through`/resolver logic (that's the next dispatch, D3); any read/filter/write behaviour change; flipping the rejection test to positive (a later slice). Do not touch the contract packages (D1, done) or mongo-orm.

## Completed when

- [ ] `rg "'M:N'" packages/3-extensions/sql-orm-client/src` returns empty (only `'N:M'` remains).
- [ ] The M:N rejection unit test uses `'N:M'` and still passes as a rejection.
- [ ] Gate: `pnpm --filter @internal/sql-orm-client typecheck` + `pnpm --filter @internal/sql-orm-client test` green.

## Standing instruction

Stay focused on the goal; control scope. This is a mechanical spelling canonicalisation — resist refactoring adjacent code. Anything that pulls you off the goal halts and surfaces.

## References

- Slice spec: `projects/sql-orm-many-to-many/slices/00-contract-resolver-foundation/spec.md` (the cardinality-split edge case).
- Slice plan: same dir `plan.md` § Dispatch 2.
- D1 landed `'N:M'` + `through` in the contract (commit `f962fd47d`) — the contract side already speaks `'N:M'`.

## Operational metadata

- **Model tier:** mid (sonnet) — mechanical rename + one test-literal move; small bounded surface.
- **Branch:** `tml-2784-slice-0-contract-resolver-foundation`. Explicit staging + `-s` sign-off. **Do not push.**
- **Time-box:** ~30 min.
- **Halt conditions:** a 5th `'M:N'` site outside the four named (surface, don't silently expand); any site where flipping the spelling changes behaviour beyond the literal (would mean a real semantic dependency — surface it).
