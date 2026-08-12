# Brief: S1-D3 — M:N include integration tests (operator standard)

## Task

Prove the M:N include works end-to-end against the database, following the project's **integration-test standard**. The fixture (S1-D1) defines `User.tags` (→ `Tag` via `UserTag`); the read path (S1-D2) compiles the correlated junction subquery. Add integration tests under `test/integration/test/sql-orm-client/` (alongside `include.test.ts` / `nested-includes.test.ts`), using the existing harness (`withCollectionRuntime`, PGlite). Seed users, tags, and `user_tags` junction rows, then assert `db.orm.User.include('tags')` returns the expected shape.

**The standard (all three apply):**
1. **Whole-row assertions** — `toEqual` (or snapshot) on the complete returned rows; never cherry-pick individual fields.
2. **Explicit `.select(...)` in most tests** — project the fields each test asserts (user-level and nested `tags`-level), so adding a field to `User`/`Tag` later doesn't churn these assertions. Assert the whole *selected* shape.
3. **≥1 implicit/default-selection test** — at least one test does `include('tags')` with **no** `.select`, asserting the full default row shape (all `User` fields + `tags: Tag[]` with all `Tag` fields) comes back.

Plus:
- **Single execution** — assert the M:N include runs in **one** SQL execution (the harness's query-count/exec hook if available; otherwise assert no `LATERAL` in the emitted SQL). Mirror how `include.test.ts` / `nested-includes-strategy.test.ts` verify execution count if they do.
- **Depth-2** — a test that nests another include under the M:N read (or M:N nested under a 1:N), to prove the junction walk composes with deeper includes.
- Edge: a user with **no** tags returns `tags: []`; a tag connected to multiple users still resolves correctly.

## Scope

**In:** new integration test file(s) under `test/integration/test/sql-orm-client/`; any seed/helper needed there.

**Out:** filter (slice 2); write (slice 3); production code changes (D2 owns the read path — if a test reveals a read **bug**, surface it, don't fix production here without flagging). Do not modify the fixture (D1 owns it).

## Completed when

- [ ] M:N `include('tags')` integration tests pass on PGlite: whole-row `toEqual`; **most** use explicit `.select`; **≥1** uses implicit/default selection; depth-2 covered; empty-tags and shared-tag cases covered.
- [ ] A single-execution assertion (no `LATERAL`, one query) for the M:N include.
- [ ] Gate: the new tests run green — `cd test/integration && pnpm test test/sql-orm-client/<your-file>` (this is how the sql-orm-client integration suite runs in-sandbox; the CLI-journey e2e tests are the ones with the known env limitation, not these).

## Standing instruction

Match the existing integration corpus's style (whole-row `toEqual`); add the explicit-select-dominant + implicit-select cases the standard requires. If a test surfaces a real read-path bug, **surface it to me** with the failing assertion — that would be a `must-fix` against D2, not something to patch here.

## References

- Existing corpus: `test/integration/test/sql-orm-client/include.test.ts`, `nested-includes.test.ts`, `nested-includes-strategy.test.ts` (assertion + execution-count patterns to mirror).
- Slice spec: `projects/sql-orm-many-to-many/slices/01-correlated-read-through-junction/spec.md` (§ done conditions — the standard).
- Fixture: `User.tags` M:N via `UserTag` (commit `fcecac5b3`).

## Operational metadata

- **Model tier:** sonnet.
- **Branch:** `tml-2785-slice-1-correlated-read`. Explicit staging + `-s` sign-off. **Do not push.**
- **Time-box:** ~75 min — write the core whole-row + implicit-select tests first, get them green, then add depth-2/edge cases; don't over-explore.
- **Halt + surface to me:** if the sql-orm-client integration harness genuinely cannot run in-sandbox (PGlite spin-up failure unrelated to your tests), describe the failure — don't claim green without running. If `include('tags')` returns a wrong shape (read-path bug in D2), surface it.
