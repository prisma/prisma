# Brief: S3-D1 — runtime junction write path

## Task

Lift the M:N nested-mutation guard and route nested writes through the junction. Today `partitionByOwnership` (`packages/3-extensions/sql-orm-client/src/mutation-executor.ts:~351`) throws `'N:M nested mutations are not supported yet'`. Replace that with a third bucket — **`junctionOwned`** (relations carrying `through`) — and execute junction mutations in the `create()` and `update()` graph flows **after the parent row exists** (parent PK known):

- **`connect({criteria})`** → resolve the target row(s) by criteria, then `INSERT INTO junction (parentColumns…, childColumns…) VALUES (parentPk…, targetPk…)` per resolved target.
- **`disconnect({criteria})`** → `DELETE FROM junction WHERE parentColumns = parentPk AND childColumns = targetPk`. (Keep `disconnect` gated to the `update()` flow — the existing rule.)
- **`create(data)`** → insert the target row, then INSERT the junction link. (For THIS dispatch, the junction is the pure `User↔Tag` one — no required payload; the required-payload guard is D3. Don't build the guard here.)

Composite keys: INSERT/DELETE across all `parentColumns`/`childColumns` pairs. Use slice 0's `ResolvedRelation.through`.

**Flip the rejection unit test** (`mutation-executor.test.ts`, currently `.rejects.toThrow(/N:M nested mutations are not supported yet/)`) to a **positive** assertion that the M:N nested mutation now produces the expected junction write. Add unit tests for connect/disconnect/create junction DML (both flows).

## Scope

**In:** `partitionByOwnership` + the `junctionOwned` execution branch in the `create()`/`update()` graph flows (`mutation-executor.ts`); composite-key junction INSERT/DELETE; flip + extend the rejection unit test.

**Out:** the required-payload guard (D3); the required-payload fixture (D2); integration tests (D4); `set`/`connectOrCreate`/nested-`update` kinds (TML-2781). Don't regress FK (parent/child-owned) nested writes.

## Completed when

- [ ] `connect`/`disconnect`/`create` over the pure M:N relation route to junction INSERT/DELETE (create = target-insert + link), under both `create()` and `update()`; the `'not supported yet'` guard is gone.
- [ ] The rejection unit test is flipped to a positive assertion; unit tests cover connect/disconnect/create junction DML (composite-key AND-ed).
- [ ] FK nested writes unchanged (existing mutation-executor tests pass).
- [ ] Gate: `pnpm --filter @internal/sql-orm-client typecheck` + `test` green.

## Standing instruction

Stay focused on the junction write routing. Mirror the existing parent/child-owned flow structure (ordering relative to the parent insert). No bare `as` casts (use `castAs`/`blindCast` or a type predicate — siblings were bounced for bare casts; a `hasThrough` predicate already exists in `model-accessor.ts` if useful). Implement → unit-test → gate; don't over-explore (sibling write/judgment dispatches truncated from over-exploration).

## References

- Slice spec: `projects/sql-orm-many-to-many/slices/03-nested-write-through-junction/spec.md`.
- `mutation-executor.ts`: `partitionByOwnership` (~338), the `create()` graph flow (~159-200) + `update()` flow (~206-290) — the parent/child-owned execution to mirror.
- Slice 0 `ResolvedRelation.through`; slice 2's `hasThrough` type predicate (`model-accessor.ts`).

## Operational metadata

- **Model tier:** **opus** — complex routing across two graph flows + composite keys; the slice's main runtime judgment.
- **Branch:** `tml-2787-slice-3-write`. Explicit staging + `-s` sign-off. **Do not push.**
- **Time-box:** ~90 min. Commit when the gate is green even if you'd like to polish — bank the work.
- **Halt + surface to me:** if junction writes can't be ordered correctly within the existing graph-flow structure (parent PK not available where needed); if completing the routing requires touching the required-payload guard (that's D3) or an out-of-scope kind.
