# Brief: S1-D2 R3 — clear F1 + F2

The read-path commit `e587b433c` is structurally accepted (correct LATERAL-free M:N correlation; FK path intact). Two `should-fix` findings remain; both block dispatch close.

## F1 (should-fix) — bare casts

`packages/3-extensions/sql-orm-client/src/query-plan-select.ts`, in `buildManyToManyJunctionArtifacts`: two bare `as AnyExpression` casts — `(joinOnPairs[0] as AnyExpression)` and `(correlationPairs[0] as AnyExpression)`. Both are pure widenings (`BinaryExpr` is a member of `AnyExpression`). Replace with `castAs<AnyExpression>(…)` (import `castAs` from `@internal/utils/casts`).

## F2 (should-fix) — missing test for M:N + distinct + non-leaf

`buildDistinctNonLeafChildRowsSelect` applies `junctionJoins` (lines ~582–587) but no test exercises **M:N + `.distinct(…)` + nested include** together. Add a unit test in `test/query-plan-select.test.ts`: build an M:N include whose `nested` state carries a `distinct` + a further (non-leaf) include, call `compileSelectWithIncludes`, and assert (a) the junction join attaches to the innermost `baseInner` SELECT and (b) the correlated WHERE is present at that level. Reuse/extend the existing `buildManyToManyContract` / `buildManyToManyIncludeExpr` helpers. The test must genuinely exercise the distinct-non-leaf branch (not the plain branch).

## Completed when

- [ ] No bare `as` casts in `buildManyToManyJunctionArtifacts` (only `castAs<…>`); `pnpm lint:casts` passes (no count increase from this branch).
- [ ] New M:N + distinct + non-leaf unit test added and **passing**, asserting the junction join + correlation at the inner select.
- [ ] `pnpm --filter @internal/sql-orm-client typecheck` + `test` green.

## Standing instruction

Surgical: the two cast sites + one new test. Don't reshape the accepted builder logic.

## References

- Findings F1, F2 in `projects/sql-orm-many-to-many/reviews/code-review.md § Findings log` (exact locations + recommended actions).
- `.agents/rules/no-bare-casts.mdc`.
- R2 commit: `e587b433c`.

## Operational metadata

- **Model tier:** sonnet — surgical fix + one test.
- **Branch:** `tml-2785-slice-1-correlated-read`. New commit (do not amend `e587b433c`). Explicit staging + `-s` sign-off. **Do not push.**
- **Time-box:** ~40 min.
- **Halt:** if the M:N + distinct + non-leaf path turns out to be **incorrect** when you write the test (the test fails because the junction join is mis-placed), that's a real bug in `e587b433c` — surface it to me with the evidence rather than papering over it (it would mean F2 is a `must-fix`, not just missing coverage).
