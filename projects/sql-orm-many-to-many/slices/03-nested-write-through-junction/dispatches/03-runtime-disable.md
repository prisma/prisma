# Brief: S3-D3 — runtime `.create` disable on required-payload junctions (runtime half only)

> **Scope note (orchestrator decision, unattended):** the **type-level** disable is **deferred** — it requires the contract `.d.ts` type emitter to carry `through` (it currently doesn't), which is a contract-surface decision for the operator (see `wip/unattended-decisions.md` #8). This dispatch does the **runtime** disable only. Do **not** attempt the type-level/conditional-type disable; do **not** change the contract `.d.ts` emitter.

## Task

In the `junctionOwned` `create` branch added in S3-D1 (`mutation-executor.ts`, `applyJunctionOwnedMutation` / the create path), guard against nested `.create` when the junction has required payload columns. The resolved relation's `through.requiredPayloadColumns` (slice 0, runtime) lists them. When a nested `create` targets an M:N relation whose `requiredPayloadColumns` is non-empty:

- **Throw a clear, actionable error** naming the relation + the offending column(s), and pointing the user to the junction model's own relations / the SQL query builder (the supported path for payload-bearing junctions). E.g. *"Cannot nest `create` on relation `roles`: its junction `user_roles` has required column(s) `level` the relation API can't populate. Use the `UserRole` model directly or the SQL builder."*
- **`connect` and `disconnect` are unaffected** — they only touch the FK pair, never the payload columns; they must still work on a required-payload junction.

Write a **runtime** test: nested `.create` on `User.roles` (the required-payload junction from S3-D2) throws the guard error; `connect`/`disconnect` on `User.roles` succeed (compile the expected junction DML). The pure `User.tags` junction's nested `create` is unaffected (still works).

## Scope

**In:** the runtime required-payload guard in the junction `create` branch (`mutation-executor.ts`); a unit/runtime test for the throw + connect/disconnect-still-work.

**Out:** the **type-level** disable (deferred — operator decision; do not touch `.d.ts` emission or add conditional types); the write path (D1, done); integration tests (D4); other kinds.

## Completed when

- [ ] Nested `.create` on a required-payload junction (`User.roles`) throws a clear error naming the relation + required column(s) + the recommended alternative; uses runtime `requiredPayloadColumns`.
- [ ] `connect`/`disconnect` on the required-payload junction still produce correct junction DML (unaffected by the guard).
- [ ] Nested `.create` on the pure junction (`User.tags`, no required payload) is unaffected.
- [ ] Gate: `pnpm --filter @internal/sql-orm-client typecheck` + `test` green.

## Standing instruction

Runtime guard only. Do NOT attempt the type-level disable (it's blocked on an operator contract decision — see the scope note). No bare `as` casts.

## References

- Slice spec: `projects/sql-orm-many-to-many/slices/03-nested-write-through-junction/spec.md` (note the type-level disable is deferred per decision #8).
- S3-D1 junction write path (`applyJunctionOwnedMutation`, commit `74a778816`); slice 0 `through.requiredPayloadColumns` (`collection-contract.ts`).
- S3-D2 fixture: `User.roles` via `UserRole` w/ required `level` (commit `926bdc849`).

## Operational metadata

- **Model tier:** sonnet — bounded runtime guard + test.
- **Branch:** `tml-2787-slice-3-write`. Explicit staging + `-s` sign-off. **Do not push.** Commit when green.
- **Time-box:** ~40 min.
- **Halt + surface to me:** if the runtime guard can't access `requiredPayloadColumns` at the create branch (it should — `RelationDefinition.through` carries it after D1); if anything pulls you toward the type-level disable.
