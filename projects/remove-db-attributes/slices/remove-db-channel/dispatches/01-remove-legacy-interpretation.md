# Brief: D1 remove legacy interpretation and add migration diagnostics

## Task

Remove the SQL PSL interpreter's legacy `@db.*` storage-lowering channel and replace it with actionable migration diagnostics in named-type and field validation. Write failing diagnostic coverage before changing implementation, then delete the family-owned native-type specification and resolver path so `db.` is recognized only for migration help.

## Scope

**In:** `packages/2-sql/2-authoring/contract-psl` tests and implementation for named-type and field attribute validation; deletion of `NativeTypeSpec`, `NATIVE_TYPE_SPECS`, `resolveDbNativeTypeAttribute`, and `allowDbNativeType`; the smallest shared formatter that strips the exact `db.` prefix and mechanically renders resolved arguments in source order.

**Out:** Documentation, ADRs, skills, upgrade instructions, parser grammar, contract shapes, TypeScript builders, unrelated attribute diagnostics, and changes to any non-`db.` extension namespace behavior.

## Completed when

- [ ] Red-first tests prove zero-argument, parameterized, duplicate, malformed, unknown, named-type, and field-position `@db.X(args)` spellings fail without producing storage types and recommend `X(args)` in type position with mechanically preserved rendered arguments.
- [ ] Named-type diagnostics use `PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE`; field diagnostics use `PSL_UNSUPPORTED_FIELD_ATTRIBUTE`; exact examples include `@db.VarChar(191) is no longer supported; use VarChar(191) in type position` and `@db.Uuid is no longer supported; use Uuid in type position`.
- [ ] `NativeTypeSpec`, `NATIVE_TYPE_SPECS`, `resolveDbNativeTypeAttribute`, and `allowDbNativeType` have no production references, while non-`db.` dotted attributes retain existing behavior.
- [ ] The focused contract-PSL test and typecheck gates pass, and the deleted-symbol scan is empty.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note in your wrap-up message. Anything that pulls you off the goal — even if it looks useful — halts and surfaces.

## References

- Slice spec: `projects/remove-db-attributes/slices/remove-db-channel/spec.md` — chosen diagnostic contract, edge cases, and slice done conditions.
- Slice plan entry: `projects/remove-db-attributes/slices/remove-db-channel/plan.md` § Dispatch 1 — outcome, handoff, and focus.
- Project background: `projects/remove-db-attributes/spec.md`, `projects/remove-db-attributes/plan.md`.
- Review log, read-only: `projects/remove-db-attributes/reviews/code-review.md`.
- Required techniques: `psl-ast-layers` and `no-bare-casts`; tests must precede implementation.

## Validation gates

- Focused test file(s) that replace `packages/2-sql/2-authoring/contract-psl/test/interpreter.db-native-types-compatibility.test.ts`, using the package's existing local `pnpm test` script or equivalent repository-standard focused invocation.
- The contract-PSL package's local `pnpm typecheck` script.
- `rg -n 'NativeTypeSpec|NATIVE_TYPE_SPECS|resolveDbNativeTypeAttribute|allowDbNativeType' packages/2-sql/2-authoring/contract-psl/src` must return no matches.

## Operational metadata

- **Model tier:** `implementer/fast` (`mid`) — focused interpreter/test surgery with a fully pinned diagnostic contract.
- **Time-box:** 45 minutes. Overrun halts and surfaces rather than expanding scope.
- **Halt conditions:** A parser or contract-shape change is required; a non-`db.` namespace behavior must change; the resolved attribute arguments cannot preserve the required source-like rendering; an out-of-scope surface is needed; or a slice assumption is false.

## Constraints

- Tests first: demonstrate the new expectations fail before implementation changes.
- Explicit staging only; no amend; no push.
- One coherent implementation commit is preferred; use a separate red-test commit only if that creates a clearer history.
- No side quests.
- Do not edit project spec, plan, trace, or review artifacts.
- Do not touch unrelated untracked `agent/` or `skills/*` paths.