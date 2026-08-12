# Brief: S3-D2 — required-payload-junction fixture

## Task

Add a second M:N relation to the integration fixture whose junction has a **required non-FK payload column**, so D3 can test the `.create` disable. Add to the fixture **source** (`test/integration/test/sql-orm-client/fixtures/contract.ts`):

- A `Role` model (`id`, `name`) — mirror the existing `Tag` shape.
- A `UserRole` junction with `userId`, `roleId`, **and a required non-FK column** — e.g. `level` (`int`/`text`, **NOT NULL, no default**) — composite PK `(userId, roleId)`, table `user_roles`.
- `User.roles = rel.manyToMany(() => Role, { through: () => UserRole, from: 'userId', to: 'roleId' })` (the `User.roles` direction only — the reverse is unnecessary, consistent with the project's one-directional convention).

Re-emit `contract.json` + `contract.d.ts`. After emit, `resolveModelRelations` must resolve `User.roles`'s `through.requiredPayloadColumns` to **`['level']`** (the NOT-NULL no-default non-FK column) — this is what D3's disable keys on.

## Scope

**In:** the fixture source (`Role` + `UserRole` w/ required `level` + `User.roles`); the re-emitted `contract.json`/`contract.d.ts`.

**Out:** the disable logic (D3); the write path (D1, done); integration tests (D4); the existing `User.tags` relation. Don't hand-edit generated files except as the emitter produces them.

## Completed when

- [ ] The fixture declares `User.roles` M:N via `UserRole(user_id, role_id, level NOT NULL no-default)`; emits `cardinality:'N:M'` + populated `through`.
- [ ] For `User.roles`, `resolveModelRelations(...).through.requiredPayloadColumns` resolves to `['level']` (verify with a tiny scratch assertion or by inspecting the junction storage in the emitted `contract.json` — `level` is NOT NULL, no default, not a FK col).
- [ ] Re-emitted `contract.json`/`.d.ts` committed; additive (existing models + `User.tags` unchanged).

## Standing instruction

Add exactly the `Role`/`UserRole`/`User.roles` shapes with one required payload column (`level`). No reverse relation, no extra columns beyond the required one. Same emit approach as slice 1's fixture dispatch.

## References

- Slice spec: `projects/sql-orm-many-to-many/slices/03-nested-write-through-junction/spec.md`.
- Slice 1 fixture dispatch (commit `fcecac5b3`) added `User.tags`/`UserTag` + re-emitted the same way — mirror it (incl. the `tsx`-bypass emit; CLI `contract emit` fails on the known config-load env issue).
- Slice 0 `requiredPayloadColumns` derivation (NOT NULL ∧ no default ∧ not FK) in `collection-contract.ts`.

## Operational metadata

- **Model tier:** sonnet — schema authoring + re-emit (mechanical, mirrors slice 1).
- **Branch:** `tml-2787-slice-3-write`. Explicit staging + `-s` sign-off. **Do not push.** Commit the re-emit (don't leave uncommitted).
- **Time-box:** ~50 min.
- **Halt + known-env:** local `fixtures:emit`/CLI fails on the pre-existing config-load issue — emit via the same `tsx`-bypass slice 1 used; verify the generated `contract.json` by inspection + that `requiredPayloadColumns` resolves to `['level']`; note it. If re-emit is genuinely impossible in-sandbox, surface to me (don't hand-fabricate). Halt if adding the relation forces touching the disable logic (D3) or trips a type regression in existing tests (describe it).
