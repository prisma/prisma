# Brief: S3-D4 R2 — design correction (guard `connect` too) + finish write integration tests

## Situation

The R1 implementer ran out of budget but **correctly surfaced a real bug**: nested **`connect`** on a required-payload junction (`User.roles`, where `user_roles.level` is `NOT NULL` no-default) **fails with a DB not-null violation** — connect INSERTs a `(user_id, role_id)` junction row, leaving `level` unset. It was about to `it.skip` the test; **don't skip it**. There is **uncommitted WIP** (`git status`): `test/integration/test/sql-orm-client/mn-nested-write.test.ts` (the new tests, one `it.skip`'d) + `runtime-helpers.ts` (Role/UserRole seeds — keep these).

**Orchestrator design correction (decision #9):** `connect` AND `create` both write a junction row the sugar can't complete, so **both are disabled** on required-payload junctions; **`disconnect` (DELETE) stays allowed**. (The original spec wrongly said connect was safe.)

## Task

1. **Production fix** — extend the runtime guard in `mutation-executor.ts` (`applyJunctionOwnedMutation`, the guard S3-D3 added to the `create` branch) to **also fire on the `connect` branch** when `through.requiredPayloadColumns` is non-empty. Same clean, actionable error (adjust wording so it fits both `connect` and `create`, e.g. *"Cannot `connect`/`create` on relation `roles`: its junction `user_roles` has required column(s) `level` …; use the `Role` model directly or the SQL builder."*). **`disconnect` stays allowed.**
2. **Flip the D3 unit test** — in `mutation-executor.test.ts`, the test that asserts *connect on `User.roles` succeeds* must become *connect on `User.roles` **rejects*** (asserts the guard throw). Keep the disconnect-succeeds and create-rejects tests.
3. **Finish the integration tests** (`mn-nested-write.test.ts`) — **remove the `it.skip`**; assert `connect` on `User.roles` **throws** the guard (`.rejects.toThrow(/required column.*\`level\`/)` style). Keep: connect/create on the pure `User.tags` junction work (readback via `include('tags')`), both `create()`+`update()` flows; `disconnect` on `User.roles` succeeds; whole-row `toEqual`; explicit `.select` in most + ≥1 implicit.
4. **Commit** the whole thing (production guard extension + unit-test flip + integration tests) as one coherent commit.

## Completed when

- [ ] Runtime guard rejects **both** `connect` and `create` on a required-payload junction (clear message); `disconnect` still works.
- [ ] `mutation-executor.test.ts`: connect-on-`User.roles` now asserts rejection; create-rejects + disconnect-succeeds intact.
- [ ] `mn-nested-write.test.ts`: no `it.skip`; connect-on-`User.roles` asserts throw; pure-junction connect/create/disconnect readback pass; both flows; standard (whole-row, explicit-most, ≥1 implicit).
- [ ] Gates: `pnpm --filter @internal/sql-orm-client typecheck` + `test` green; `cd test/integration && pnpm test test/sql-orm-client/mn-nested-write.test.ts` green.

## Standing instruction

Make the production fix (guard connect too) + finish the tests with **no skips**. The **type-level** disable stays deferred (decision #8) — runtime only. No bare `as` casts.

## References

- Decision #9 (`wip/unattended-decisions.md`) + corrected slice-3 spec.
- S3-D3 guard (`mutation-executor.ts`, commit `3bccd80b3`) — extend it to `connect`.
- Slice 1 `mn-include.test.ts` readback pattern; the WIP `mn-nested-write.test.ts`.

## Operational metadata

- **Model tier:** sonnet — small production guard extension + test work.
- **Branch:** `tml-2787-slice-3-write` (WIP on it). Explicit staging + `-s` sign-off. **Do not push.** Commit when green.
- **Time-box:** ~60 min — production guard + unit-test flip first (fast), then finish/unskip the integration tests.
- **Halt + surface to me:** if disabling `connect` turns out to break a legitimate pure-junction connect path (it shouldn't — the guard keys on `requiredPayloadColumns` being non-empty, which is empty for `User.tags`); if a pure-junction write still returns the wrong readback state.
