# Brief: S1-D1 — integration fixture gains an M:N relation

## Task

The sql-orm-client integration fixture has no many-to-many relation, so M:N read tests have nothing to run against. Add a **User ↔ Tag** M:N relation through a **`UserTag`** junction model (`userId`, `tagId`, composite primary key, **no payload columns** — the canonical pure-junction case) to the integration fixture's **source schema**, then **re-emit** the generated `contract.json` + `contract.d.ts`. The `Tag` model already exists in the fixture (`id`, `name`); add the junction + the `rel.manyToMany` relation on `User` (and the reverse on `Tag` if the fixture convention declares both sides).

Find the fixture source: the generated artifacts live under `test/integration/test/sql-orm-client/fixtures/generated/` (and/or `packages/3-extensions/sql-orm-client/test/fixtures/generated/`); the emit is wired via a `package.json` script (grep for `emit` / `contract emit`). Modify the **source**, not the generated files by hand; re-run the emit.

## Scope

**In:** the fixture source schema (add `UserTag` junction + User↔Tag M:N); the re-emitted `contract.json` + `contract.d.ts`.

**Out:** any read/projection code (S1-D2); any test (S1-D3); other fixture relations. Do not hand-edit generated files except as the emitter produces them.

## Completed when

- [ ] The fixture source declares an M:N User↔Tag relation via a `UserTag` junction (composite PK `userId`,`tagId`); the relation emits with `cardinality: 'N:M'` and a populated `through { table, parentColumns, childColumns, targetColumns }`.
- [ ] `contract.json` + `contract.d.ts` are re-emitted from source and committed; the emitted M:N relation **round-trips `validateContract`**.
- [ ] Change is additive — existing fixture models/relations emit unchanged (verify by diffing the generated files: only the new junction + relation appear).

## Standing instruction

Stay focused: add exactly the pure-junction M:N relation and re-emit. No extra models, no payload columns (a payload-junction fixture is a later concern if a test needs it).

## References

- Slice spec: `projects/sql-orm-many-to-many/slices/01-correlated-read-through-junction/spec.md` (§ Open Questions fixes the User↔Tag shape).
- Slice 0 added `rel.manyToMany` validation; commit `f962fd47d` shows the emitted `through` shape.

## Operational metadata

- **Model tier:** mid (sonnet) — schema authoring + mechanical re-emit.
- **Branch:** `tml-2785-slice-1-correlated-read`. Explicit staging + `-s` sign-off. **Do not push.**
- **Time-box:** ~45 min.
- **Halt conditions:** the local `fixtures:emit` / `pnpm fixtures:check` fails on the pre-existing CLI-on-PATH / config env issue (known) — if so, emit via the most direct working path you can (e.g. the package's own emit script) and verify the generated `contract.json` by inspection + `validateContract`; note it. If re-emit is genuinely impossible in-sandbox, surface to the orchestrator (do not hand-fabricate `contract.json`). Halt if adding the relation forces touching read/test code.
