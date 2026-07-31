# Brief: D6 post-rebase lint compatibility

## Task

Fix the branch-local `lint/correctness/noUnsafeOptionalChaining` diagnostic in the touched where-binding regression without weakening its assertion that the nested bound branch condition contains a `FunctionCallExpr` on the left side.

## Scope

**In:** `packages/3-extensions/sql-orm-client/test/where-binding.test.ts` at the reported assertion; the narrowest idiomatic test-only rewrite; focused where-binding tests; SQL ORM lint and typecheck; explicit staging and signed-off commit.

**Out:** Production code; behavioral changes; unrelated lint cleanup; PostgreSQL infrastructure failures; test timeout/worker changes; fixtures/contracts; later-slice work; project artifact edits.

## Completed when

- [ ] The assertion no longer uses optional chaining in a position that can throw on the subsequent `.left` access, while retaining equivalent type/nesting evidence.
- [ ] The focused where-binding test, `pnpm --filter @internal/sql-orm-client lint`, and `pnpm --filter @internal/sql-orm-client typecheck` pass.
- [ ] Only the one test file is explicitly staged and committed with sign-off; do not amend or push.

## Standing instruction

Stay focused on the current-`main` lint compatibility defect. If the assertion cannot be made safe without changing production behavior or broad test helpers, halt instead of expanding scope.

## Operational metadata

- **Model tier:** implementer/thorough — a narrow correction on a type-sensitive AST assertion.
- **Time-box:** 15 minutes wall clock.
- **Halt conditions:** production code must change; assertion semantics would weaken; another actionable branch-local gate fails; any destructive Git or `git stash*` action. Preserve the repository-global prototype stash.
