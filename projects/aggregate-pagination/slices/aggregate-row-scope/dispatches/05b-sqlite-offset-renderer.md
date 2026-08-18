# Brief: D5b — SQLite `OFFSET` without `LIMIT`

_Authorised conditionally on 2026-08-17; the condition is now met. D5 confirmed the defect empirically: `.skip(5).aggregate(...)` on SQLite throws `near "OFFSET": syntax error`, verified against the raw driver error before being asserted. See the project spec's amended § Adapter impact._

## Task

SQLite's grammar is `LIMIT expr [ (OFFSET | ,) expr ]` — there is no standalone `OFFSET` clause. `packages/3-targets/6-adapters/sqlite/src/core/adapter.ts:254-255` renders `LIMIT` and `OFFSET` as two independent, independently-omittable clauses, so an AST carrying an offset and no limit emits SQL SQLite cannot parse.

Make the renderer emit `LIMIT -1 OFFSET n` when an offset is present and a limit is not. `-1` is SQLite's documented idiom for an unbounded limit.

**This is a renderer correction, not a branch on target.** The plan does not change shape per target; the SQL text does. `.agents/rules/no-target-branches.mdc` holds.

## Why it belongs in this slice

It is pre-existing — `db.orm.User.skip(5).all()` is broken on SQLite today, and has been. But this project makes `skip` without `take` a named DoD item and pairs it with "integration tests assert values on both PGlite and SQLite for each chain position." Closing that item on one target while the other errors would be a checked box over a broken behaviour, which is the failure mode this project exists to eliminate. The operator's decision, taken on 2026-08-17 and confirmed by D5's evidence.

The fix reaches further than aggregates: every `.all()`, `.first()` and include path that carries an offset without a limit is fixed by the same change.

## Scope

**In:** `packages/3-targets/6-adapters/sqlite/src/core/adapter.ts` and its renderer test. Un-skipping or re-pointing the SQLite integration case D5 left in place as a known gap.

**Out:** the Postgres renderer — it handles standalone `OFFSET` correctly and needs nothing. Any ORM-layer change; the ORM already emits a correct AST and this is purely a rendering defect. The `LIMIT`/`OFFSET` *values* — no clamping, no validation, no normalising of negative or zero inputs. `take(0)` already works and must keep working.

## Completed when

- [ ] An AST with `offset` set and `limit` undefined renders `LIMIT -1 OFFSET n` on SQLite.
- [ ] An AST with both set renders exactly what it renders today — **byte-identical**. This is the regression that matters; the existing renderer test only covers the both-set case, which is why the gap survived.
- [ ] An AST with limit only, and one with neither, are both unchanged.
- [ ] A renderer-level unit test covers all four combinations (neither / limit only / offset only / both).
- [ ] The SQLite integration case D5 left as a known gap now passes with an **asserted value** — `.skip(n)` without `take` reduces over all-but-the-first-n. Update the comment that describes it as a confirmed known gap; it is no longer one.
- [ ] Gates green.

## Validation gates

- `pnpm --filter @internal/adapter-sqlite test` (or the correct package name — confirm it)
- `pnpm --filter @internal/adapter-sqlite lint`
- `pnpm typecheck`
- `pnpm --filter integration-tests exec vitest run test/sql-orm-client` — the invocation D5 established, since the integration case lives there
- **The baseline snapshot is byte-unchanged.** It should be trivially so — this dispatch touches no plan construction — but check it, because a snapshot move here would mean the change reached somewhere it should not have.

## Standing instruction

Stay focused on the goal; control scope. Anything that pulls you off the goal halts and surfaces.

## Halt conditions

- The both-set rendering changes at all. That is a regression in shipped behaviour and the whole reason this dispatch names byte-identity as a completion condition.
- The fix cannot be expressed without restructuring how the renderer assembles clauses. A narrow conditional is what is authorised here; a renderer refactor is not.
- Another target's renderer turns out to have the same defect. **Report it; do not fix it.** The operator authorised SQLite specifically, on the evidence of a confirmed failure — extending to a target on the strength of reading rather than evidence is how a slice's scope stops being decidable.
- 60 minutes.

## House rules that apply

- `.agents/rules/no-target-branches.mdc` — this is a renderer emitting valid SQL for its own dialect, not the plan branching on target. If the change starts to look like the latter, halt.
- `.agents/rules/omit-should-in-tests.mdc`, `.agents/rules/no-transient-project-ids-in-code.mdc`.

## References

- Project spec § Place in the larger world, amended 2026-08-17 — the operator decision and its reasoning.
- Slice plan § Dispatch 5b.
- D5's evidence: the exact error string, and the integration case left in place awaiting this fix.

## Operational metadata

- **Model tier:** mid — a narrow, well-specified renderer conditional with a strong test gate.
- **Time-box:** 60 minutes.
