# Brief: S2-D2 — M:N filter integration tests (operator standard)

## Task

Prove M:N relation filters work end-to-end against the database, following the project's **integration-test standard**. D1 made `.some`/`.every`/`.none` emit a junction EXISTS; slice 1's fixture has `User.tags` (→ `Tag` via `UserTag`) and `seedTags`/`seedUserTags` helpers. Add integration tests under `test/integration/test/sql-orm-client/` (PGlite, `withCollectionRuntime`). Seed users/tags/junction rows, then assert `db.orm.User.filter((u) => u.tags.some/every/none(...))` returns the right users.

**Cases (all required):**
- **`some`** — users having ≥1 tag matching a predicate (e.g. `t.name.eq('x')`).
- **`none`** — users with no matching tag.
- **`every`** — users all of whose tags match (include a user with a non-matching tag to prove they're excluded; and verify the vacuous case — a user with **no** tags satisfies `every`).
- **empty-match edge** — a predicate no tag matches → `some` returns none, `none`/`every` behave correctly.

**Standard (all three):** (1) whole-row `toEqual` on the **filtered result set** (assert exactly which users come back, full row shape); (2) explicit `.select(...)` in **most** tests; (3) **≥1** test uses implicit/default selection (no `.select`, asserts full default row shape of the returned users).

## Scope

**In:** new integration test file under `test/integration/test/sql-orm-client/`; reuse slice 1's seed helpers (extend if a filter test needs more seed data).

**Out:** filter code (D1); include reads (slice 1); writes (slice 3); production changes (if a test reveals a filter bug, surface it — don't patch production here). Don't modify the fixture contract.

## Completed when

- [ ] Integration tests pass on PGlite covering `some`, `none`, `every` (incl. the vacuous no-tags case) and an empty-match edge, asserting the exact filtered user set as **whole rows** (`toEqual`).
- [ ] Most tests use explicit `.select`; **≥1** uses implicit/default selection.
- [ ] Gate: `cd test/integration && pnpm test test/sql-orm-client/<your-file>` green (the in-sandbox path for this suite).

## Standing instruction

Match the existing integration corpus style. If a test surfaces a real filter bug (wrong users returned), **surface it to me** with the failing assertion — that's a `must-fix` against D1, not something to patch in the test.

## References

- Slice spec: `projects/sql-orm-many-to-many/slices/02-filter-exists-through-junction/spec.md` (§ done conditions — the standard).
- Slice 1's `mn-include.test.ts` + `runtime-helpers.ts` (`seedTags`/`seedUserTags`) — the harness + seed pattern to reuse.
- Existing filter integration tests (if any) for `.some/.every/.none` on FK relations — mirror their structure.

## Operational metadata

- **Model tier:** sonnet.
- **Branch:** `tml-2786-slice-2-filter`. Explicit staging + `-s` sign-off. **Do not push.**
- **Time-box:** ~60 min — core `some`/`none`/`every` whole-row tests first, then the implicit-selection + empty-match cases; don't over-explore.
- **Halt + surface to me:** if the integration harness can't run in-sandbox (PGlite spin-up failure unrelated to your tests — describe it, don't fake green); if a filter returns the wrong user set (D1 bug).
