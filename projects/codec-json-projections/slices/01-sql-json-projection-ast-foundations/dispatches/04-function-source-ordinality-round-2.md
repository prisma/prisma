# Brief: D4 function-source aliases and ordinality — round 2

## Task

Close reviewer finding F1 by making the immutable `FunctionSource` API reject an empty returned-column alias list before rendering. Write the regression test first and preserve every accepted D4 construction and SQL result.

## Scope

**In:** The narrow `withColumnAliases([])` invariant, its actionable error, a focused relational-core regression test, and directly affected validation gates.

**Out:** Any new function-source grammar, array lifting, renderer behavior for valid states, JSON projection behavior, descriptor/codec work, fixtures/contracts, prototype work, unrelated cleanup, and project artifact edits.

## Completed when

- [ ] A focused test proves `withColumnAliases([])` fails clearly before PostgreSQL can render `AS "alias"()`.
- [ ] Existing function-source tests and the directly affected relational-core build/test/typecheck/lint gates pass.
- [ ] The fix is committed with explicit staging and sign-off; do not amend or push.

## Standing instruction

Stay focused on the one invalid-state invariant. If rejecting the empty list requires a broader API or renderer change, halt and surface it instead of expanding D4.

## Operational metadata

- **Model tier:** persistent implementer/thorough — resume the D4 implementer with its existing context.
- **Time-box:** 15 minutes wall clock. Overrun halts rather than widening scope.
- **Halt conditions:** a broader function-source redesign is required; valid D4 SQL changes; an unrelated gate is red; any destructive Git or `git stash*` action. Preserve the repository-global prototype stash.
