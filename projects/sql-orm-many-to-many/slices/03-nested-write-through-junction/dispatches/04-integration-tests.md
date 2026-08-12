# Brief: S3-D4 — M:N nested-write integration tests (operator standard)

## Task

Prove M:N nested writes work end-to-end against the database, following the project's **integration-test standard**. D1 added the junction write path; D2 added the `User.roles` required-payload fixture; D3 added the runtime `.create` disable. Add integration tests under `test/integration/test/sql-orm-client/` (PGlite, `withCollectionRuntime`). Reuse slice 1's `seedTags`/`seedUserTags` + add `Role`/`UserRole` seeds as needed.

**Cases (all required):**
- **`connect`** — `db.orm.User.update({ ... tags: (t) => t.connect({ id }) })`; read back via `include('tags')` → the tag is linked. Also exercise `connect` in the **`create()`** parent flow.
- **`disconnect`** — link then `disconnect`; read back → gone. (`update()` flow — disconnect is update-only.)
- **`create`** (pure junction `User.tags`) — nested `create` inserts the target Tag + the junction link; read back → present.
- **Runtime disable** — nested `create` on `User.roles` (required-payload junction) **throws** the D3 guard error (`expect(...).rejects.toThrow(/required column.*level/)` or similar); `connect`/`disconnect` on `User.roles` **succeed** + read back.
- Cover **both `create()` and `update()`** parent flows for connect/create.

**Standard (all three):** (1) whole-row `toEqual` on the readback (via `include('tags')`); (2) explicit `.select(...)` in most tests; (3) **≥1** implicit/default-selection readback.

## Scope

**In:** new integration test file under `test/integration/test/sql-orm-client/`; `Role`/`UserRole` seed helpers if needed (extend `runtime-helpers.ts`).

**Out:** production changes (D1/D3 own the write path + guard — if a test reveals a write bug, surface it, don't patch production here); the **type-level** disable (deferred — only the **runtime** throw is testable now). Don't modify the fixture contract (D2 owns it).

## Completed when

- [ ] Integration tests pass on PGlite: connect (both flows) / disconnect / create (pure junction) with whole-row readback via `include('tags')`; the runtime `.create` disable on `User.roles` throws; connect/disconnect on `User.roles` succeed.
- [ ] Most tests explicit `.select`; **≥1** implicit/default-selection readback.
- [ ] Gate: `cd test/integration && pnpm test test/sql-orm-client/<your-file>` green.

## Standing instruction

Match the existing integration corpus. The type-level disable is NOT testable here (deferred) — only assert the **runtime** throw for required-payload `create`. If a write returns the wrong state on readback, **surface it to me** (a D1/D3 bug — must-fix), don't patch the test around it.

## References

- Slice spec: `projects/sql-orm-many-to-many/slices/03-nested-write-through-junction/spec.md` (note: type-level disable deferred per `wip/unattended-decisions.md` #8).
- Slice 1's `mn-include.test.ts` (readback-via-include pattern) + `runtime-helpers.ts` seeds; slice 2's `mn-filter.test.ts`.
- D1 write path (`74a778816`), D3 runtime guard (`3bccd80b3`), D2 fixture (`926bdc849`).

## Operational metadata

- **Model tier:** sonnet.
- **Branch:** `tml-2787-slice-3-write`. Explicit staging + `-s` sign-off. **Do not push.** Commit when green.
- **Time-box:** ~75 min — core connect/disconnect/create readback first, then both-flows + the runtime-disable + implicit-selection; don't over-explore.
- **Halt + surface to me:** if the harness can't run in-sandbox (PGlite spin-up failure unrelated to your tests — describe it, don't fake green); if a nested write produces the wrong readback state (D1/D3 bug).
